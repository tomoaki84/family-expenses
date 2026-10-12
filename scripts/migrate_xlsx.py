#!/usr/bin/env python3
"""
支出調整.xlsx (Sheet1) からデータを抽出し、
Supabase 移行用の SQL (seed.sql) または JSON を生成するスクリプト。
標準ライブラリ (zipfile, xml.etree.ElementTree) のみで動作します。
"""

import sys
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

XLSX_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), '支出調整.xlsx')
SEED_SQL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'supabase', 'seed.sql')

def excel_serial_to_date(val, default_year=2025):
    """Excelのシリアル値または文字列からYYYY-MM-DDを生成"""
    if not val:
        return None
    val_str = str(val).strip()
    try:
        n = float(val_str)
        # 1900-01-01基準 (Excel閏年バグ考慮で 1899-12-30 起算)
        d = datetime(1899, 12, 30) + timedelta(days=n)
        return d.strftime('%Y-%m-%d')
    except ValueError:
        pass
    
    # "5月" などの月表記
    m = re.match(r'(\d+)月', val_str)
    if m:
        month = int(m.group(1))
        return f"{default_year:04d}-{month:02d}-01"
    
    # "2024/05/12" などのスラッシュ表記
    m2 = re.match(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', val_str)
    if m2:
        return f"{int(m2.group(1)):04d}-{int(m2.group(2)):02d}-{int(m2.group(3)):02d}"
    
    return None

def guess_category(title):
    """支出内容からカテゴリを自動推論"""
    t = title.lower()
    if any(k in t for k in ['スーパー', '食', '飲食', 'カフェ', 'ケーキ', 'プリン', 'メロン', 'ほうとう', '肉', '野菜', 'パン', 'リンツ']):
        return '食費'
    if any(k in t for k in ['薬局', 'ドラッグ', 'サンドラッグ', 'スギ薬局', 'マツキヨ', '洗剤', 'シート', 'スポンジ', 'ペン', 'ネット', '日用品', '生活']):
        return '日用品'
    if any(k in t for k in ['家電', '炊飯器', 'ルンバ', '洗濯機', 'エアコン', 'ライト', '冷蔵庫']):
        return '家電'
    if any(k in t for k in ['病院', '検診', '健診', '医療', 'クリニック', '愛育', '共済', '処方箋', '検査']):
        return '医療費'
    if any(k in t for k in ['ベビー', '保育園', '絵本', '初節句', '入園', '雛人形', '出産', 'ハイドロジェル', 'オムツ', 'おむつ', 'ミルク', '動物園']):
        return '子供/教育'
    if any(k in t for k in ['旅行', '宿泊', 'ロッカー', 'チケット', 'ゆず', 'タクシー', '新幹線', '飛行機', '前撮り', '結婚式', '写真']):
        return '交通/旅行'
    if any(k in t for k in ['洋服', 'ワイシャツ', '靴下', '衣類', '服', '引き出し', '机', '椅子', 'ケーブル']):
        return '家具/衣服'
    if any(k in t for k in ['ことら', '送金', '入金', '給付金', '一時金', '還付金']):
        return '収入/入金'
    return 'その他'

def calculate_shares(amount, ratio):
    """割合に応じて智明と康子の負担額を計算（合算がamountと一致）"""
    if ratio == '智明全額':
        return amount, 0
    if ratio == '康子全額':
        return 0, amount
    if ratio == '5:5':
        tomo = round(amount * 0.5)
        return tomo, amount - tomo
    if ratio == '6:4':
        tomo = round(amount * 0.6)
        return tomo, amount - tomo
    if ratio == '1:2':
        tomo = round(amount * (1.0 / 3.0))
        return tomo, amount - tomo
    
    # デフォルトは 6:4
    tomo = round(amount * 0.6)
    return tomo, amount - tomo

def parse_sheet1(xlsx_path):
    with zipfile.ZipFile(xlsx_path) as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                texts = [t.text for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text]
                shared_strings.append(''.join(texts))

        stree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = stree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')

        records = []
        last_date = '2024-01-01'

        for row in rows:
            r_num = int(row.attrib.get('r'))
            if r_num < 4:
                continue # ヘッダー行

            cells = {}
            for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                col = ''.join(filter(str.isalpha, c.attrib.get('r')))
                t = c.attrib.get('t')
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = v.text if v is not None else ''
                if t == 's' and val.isdigit():
                    val = shared_strings[int(val)]
                cells[col] = val

            title_a = cells.get('A', '').strip()
            title_b = cells.get('B', '').strip()
            title = f"{title_a} {title_b}".strip() if title_b else title_a

            date_raw = cells.get('C', '').strip()
            d_card = cells.get('D', '').strip()
            e_tomo = cells.get('E', '').strip()
            f_yasu = cells.get('F', '').strip()
            ratio_raw = cells.get('G', '').strip()
            h_tomo_share = cells.get('H', '').strip()
            i_yasu_share = cells.get('I', '').strip()
            j_tomo_adj = cells.get('J', '').strip()
            k_yasu_adj = cells.get('K', '').strip()
            m_memo = cells.get('M', '').strip()

            # 精算まとめ行・空行のスキップ
            if r_num == 95 or '精算済' in m_memo:
                continue
            if not (title or d_card or e_tomo or f_yasu):
                continue

            # 金額・支払者の特定
            payer = '智明'
            amount_val = 0
            if d_card:
                payer = '家族カード'
                try: amount_val = float(d_card)
                except: pass
            elif e_tomo:
                payer = '智明'
                try: amount_val = float(e_tomo)
                except: pass
            elif f_yasu:
                payer = '康子'
                try: amount_val = float(f_yasu)
                except: pass

            amount = int(round(amount_val))

            # 日付の補正
            parsed_date = excel_serial_to_date(date_raw, default_year=2025 if r_num >= 86 else 2024)
            if parsed_date:
                last_date = parsed_date
            else:
                parsed_date = last_date

            # 割合の正規化（ExcelのG列およびJ・K列の調整額式から正確に判定）
            ratio = '6:4' # デフォルト
            try: j_val = float(j_tomo_adj) if j_tomo_adj else 0.0
            except: j_val = 0.0
            try: k_val = float(k_yasu_adj) if k_yasu_adj else 0.0
            except: k_val = 0.0

            if r_num < 50:
                excel_adj = round(j_val)
            elif r_num == 100:
                excel_adj = -880
            else:
                excel_adj = round(j_val) if j_val != 0 else -round(k_val)

            if ratio_raw in ['5:5?', '5:5？', '5:5']:
                ratio = '5:5'
            elif '1:2' in ratio_raw:
                ratio = '1:2'
            elif payer == '家族カード' and amount > 0:
                if abs(excel_adj - round(amount * 0.4)) <= 2:
                    ratio = '智明全額'
                elif abs(excel_adj - (-round(amount * 0.6))) <= 2:
                    ratio = '康子全額'
                elif abs(excel_adj - (-round(amount * 0.1))) <= 2:
                    ratio = '5:5'
                else:
                    ratio = '6:4'
            elif payer == '康子' and amount > 0:
                if abs(excel_adj - round(amount * 0.5)) <= 2:
                    ratio = '5:5'
                elif abs(excel_adj - amount) <= 2:
                    ratio = '智明全額'
            elif payer == '智明' and amount > 0:
                if abs(excel_adj - (-round(amount * 0.5))) <= 2:
                    ratio = '5:5'
                elif abs(excel_adj - (-amount)) <= 2:
                    ratio = '康子全額'
            
            # 負担額の算出
            tomo_share, yasu_share = calculate_shares(amount, ratio)

            # 精算ステータス (Row 95以前は精算済、Row 99以降は未精算)
            status = '精算済' if r_num <= 95 else '未精算'

            # 種別判定 (マイナスは相殺分配)
            entry_type = 'income_offset' if amount < 0 else 'expense'

            category = guess_category(title)

            records.append({
                'excel_row': r_num,
                'date': parsed_date,
                'title': title,
                'amount': amount,
                'payer': payer,
                'split_ratio': ratio,
                'tomoaki_amount': tomo_share,
                'yasuko_amount': yasu_share,
                'settlement_status': status,
                'category': category,
                'entry_type': entry_type,
                'memo': f"Excel行:{r_num}" + (f" ({m_memo})" if m_memo else "")
            })

        return records

def generate_seed_sql(records, output_path):
    lines = [
        "-- ==============================================================================",
        "-- 支出調整.xlsx Sheet1 既存データインポート用 SQL (seed.sql)",
        f"-- 総件数: {len(records)} 件 (精算済: {len([r for r in records if r['settlement_status'] == '精算済'])} 件, 未精算: {len([r for r in records if r['settlement_status'] == '未精算'])} 件)",
        "-- ==============================================================================",
        "",
        "INSERT INTO expenses (date, title, amount, payer, split_ratio, tomoaki_amount, yasuko_amount, settlement_status, category, entry_type, memo, registered_by)",
        "VALUES"
    ]

    values = []
    for r in records:
        title_escaped = r['title'].replace("'", "''")
        memo_escaped = r['memo'].replace("'", "''")
        val = f"  ('{r['date']}', '{title_escaped}', {r['amount']}, '{r['payer']}', '{r['split_ratio']}', {r['tomoaki_amount']}, {r['yasuko_amount']}, '{r['settlement_status']}', '{r['category']}', '{r['entry_type']}', '{memo_escaped}', 'migration')"
        values.append(val)

    lines.append(",\n".join(values) + ";")
    lines.append("")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
    print(f"Generated seed SQL: {output_path} ({len(records)} records)")

def main():
    if not os.path.exists(XLSX_PATH):
        print(f"Error: {XLSX_PATH} not found.")
        sys.exit(1)

    records = parse_sheet1(XLSX_PATH)
    print(f"Successfully parsed {len(records)} records from {XLSX_PATH}")

    settled = [r for r in records if r['settlement_status'] == '精算済']
    unsettled = [r for r in records if r['settlement_status'] == '未精算']
    incomes = [r for r in records if r['amount'] < 0]

    print(f" - 精算済: {len(settled)} 件")
    print(f" - 未精算: {len(unsettled)} 件")
    print(f" - 相殺・マイナス受領: {len(incomes)} 件")

    print("\n--- [未精算データプレビュー (直近)] ---")
    for r in unsettled:
        print(f"Row {r['excel_row']:3d} | {r['date']} | {r['title'][:16]:16s} | {r['amount']:7d}円 | {r['payer']:6s} | {r['split_ratio']} | 智:{r['tomoaki_amount']} 康:{r['yasuko_amount']}")

    generate_seed_sql(records, SEED_SQL_PATH)

if __name__ == '__main__':
    main()
