#!/usr/bin/env python3
"""
JCB明細ディレクトリ内の月別CSVファイル (*meisai.csv) を読み込み、
サマリー行を除いて「お支払日」列を先頭に追加し、
1つのExcelファイル (JCB明細/JCB明細_まとめ.xlsx) にまとめるスクリプト。
標準ライブラリのみで動作します。
"""

import csv
import glob
import os
import zipfile
from xml.sax.saxutils import escape

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JCB_DIR = os.path.join(BASE_DIR, "JCB明細")
OUTPUT_XLSX = os.path.join(JCB_DIR, "JCB明細_まとめ.xlsx")

# 金額として数値変換する列インデックス（出力13列ベース、0始まり）
# 0:お支払日, 1:ご利用者, 2:カテゴリ, 3:ご利用日, 4:ご利用先など,
# 5:ご利用金額(￥), 6:支払区分, 7:今回回数, 8:訂正サイン,
# 9:お支払い金額(￥), 10:国内／海外, 11:摘要, 12:備考
NUMERIC_COLS = {5, 9}

# 列幅の設定 (1始まり: A〜M列)
COL_WIDTHS = [
    13,  # A: お支払日
    42,  # B: ご利用者
    24,  # C: カテゴリ
    13,  # D: ご利用日
    36,  # E: ご利用先など
    15,  # F: ご利用金額(￥)
    11,  # G: 支払区分
    10,  # H: 今回回数
    11,  # I: 訂正サイン
    16,  # J: お支払い金額(￥)
    12,  # K: 国内／海外
    32,  # L: 摘要
    8,   # M: 備考
]


def col_letter(col_idx_0: int) -> str:
    """0始まりの列インデックスをExcelの列名 (A, B, ..., Z, AA...) に変換"""
    result = ""
    n = col_idx_0 + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def parse_number(val: str):
    """カンマ区切り数値文字列をintに変換（空文字や非数値はNone）"""
    cleaned = val.strip().replace(",", "")
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def load_jcb_csvs(jcb_dir: str):
    """JCB明細ディレクトリ内の *meisai.csv をファイル名順に読み込む"""
    csv_files = sorted(glob.glob(os.path.join(jcb_dir, "*meisai.csv")))
    if not csv_files:
        raise FileNotFoundError(f"CSVファイルが見つかりません: {jcb_dir}")

    header = None
    all_rows = []

    for path in csv_files:
        with open(path, encoding="cp932", newline="") as f:
            rows = list(csv.reader(f))

        if len(rows) < 6:
            continue

        # 1行目: "","","今回のお支払日","YYYY/MM/DD"
        pay_date = rows[0][3].strip() if len(rows[0]) > 3 else ""

        # 6行目: テーブルヘッダー
        file_header = [c.strip() for c in rows[5]]
        if header is None:
            header = ["お支払日"] + file_header

        # 7行目以降: 明細データ行
        for r in rows[6:]:
            if not any(cell.strip() for cell in r):
                continue
            # ご利用日などの前後空白をトリム
            cleaned_row = [cell.strip() for cell in r]
            all_rows.append([pay_date] + cleaned_row)

    return csv_files, header, all_rows


def write_xlsx(output_path: str, header: list, rows: list):
    """標準ライブラリのみで整形済み .xlsx ファイルを生成"""
    shared_strings = []
    string_map = {}

    def get_shared_string_idx(text: str) -> int:
        if text not in string_map:
            string_map[text] = len(shared_strings)
            shared_strings.append(text)
        return string_map[text]

    total_rows = 1 + len(rows)
    total_cols = len(header)
    last_col_letter = col_letter(total_cols - 1)
    dim_ref = f"A1:{last_col_letter}{total_rows}"

    sheet_rows_xml = []

    # 1行目: ヘッダー行 (style s="1")
    header_cells = []
    for c_idx, h_text in enumerate(header):
        cell_ref = f"{col_letter(c_idx)}1"
        s_idx = get_shared_string_idx(h_text)
        header_cells.append(f'<c r="{cell_ref}" t="s" s="1"><v>{s_idx}</v></c>')
    sheet_rows_xml.append(
        f'<row r="1" ht="22" customHeight="1">{"".join(header_cells)}</row>'
    )

    # 2行目以降: データ行
    for r_offset, row_data in enumerate(rows, start=2):
        row_cells = []
        for c_idx, val in enumerate(row_data):
            cell_ref = f"{col_letter(c_idx)}{r_offset}"
            if c_idx in NUMERIC_COLS:
                num_val = parse_number(val)
                if num_val is not None:
                    row_cells.append(f'<c r="{cell_ref}" s="3"><v>{num_val}</v></c>')
                elif val == "":
                    row_cells.append(f'<c r="{cell_ref}" s="3"/>')
                else:
                    s_idx = get_shared_string_idx(val)
                    row_cells.append(f'<c r="{cell_ref}" t="s" s="2"><v>{s_idx}</v></c>')
            else:
                if val == "":
                    row_cells.append(f'<c r="{cell_ref}" s="2"/>')
                else:
                    s_idx = get_shared_string_idx(val)
                    row_cells.append(f'<c r="{cell_ref}" t="s" s="2"><v>{s_idx}</v></c>')
        sheet_rows_xml.append(f'<row r="{r_offset}">{"".join(row_cells)}</row>')

    cols_xml = "".join(
        f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(COL_WIDTHS, start=1)
    )

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="{dim_ref}"/>'
        '<sheetViews>'
        '<sheetView tabSelected="1" workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
        '</sheetView>'
        '</sheetViews>'
        '<sheetFormatPr defaultRowHeight="19"/>'
        f'<cols>{cols_xml}</cols>'
        f'<sheetData>{"".join(sheet_rows_xml)}</sheetData>'
        f'<autoFilter ref="{dim_ref}"/>'
        '</worksheet>'
    )

    si_items = "".join(
        f'<si><t xml:space="preserve">{escape(s)}</t></si>' for s in shared_strings
    )
    shared_strings_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(shared_strings)}" uniqueCount="{len(shared_strings)}">'
        f"{si_items}"
        "</sst>"
    )

    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<numFmts count="1">'
        '<numFmt numFmtId="164" formatCode="#,##0"/>'
        '</numFmts>'
        '<fonts count="2">'
        '<font><sz val="10.5"/><name val="Yu Gothic"/></font>'
        '<font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/></font>'
        '</fonts>'
        '<fills count="3">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="2">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '<border>'
        '<left style="thin"><color rgb="FFD9D9D9"/></left>'
        '<right style="thin"><color rgb="FFD9D9D9"/></right>'
        '<top style="thin"><color rgb="FFD9D9D9"/></top>'
        '<bottom style="thin"><color rgb="FFD9D9D9"/></bottom>'
        '<diagonal/>'
        '</border>'
        '</borders>'
        '<cellStyleXfs count="1">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
        '</cellStyleXfs>'
        '<cellXfs count="4">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
        '<alignment vertical="center"/>'
        '</xf>'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">'
        '<alignment vertical="center"/>'
        '</xf>'
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">'
        '<alignment horizontal="right" vertical="center"/>'
        '</xf>'
        '</cellXfs>'
        '</styleSheet>'
    )

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>'
        '<sheet name="JCB明細一覧" sheetId="1" r:id="rId1"/>'
        '</sheets>'
        '</workbook>'
    )

    workbook_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        '</Relationships>'
    )

    root_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>'
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        '</Types>'
    )

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/styles.xml", styles_xml)
        zf.writestr("xl/sharedStrings.xml", shared_strings_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def main():
    csv_files, header, rows = load_jcb_csvs(JCB_DIR)
    write_xlsx(OUTPUT_XLSX, header, rows)
    print(f"統合対象ファイル数: {len(csv_files)} 件")
    print(f"出力明細行数: {len(rows)} 行 (ヘッダー含め {len(rows) + 1} 行)")
    print(f"出力先: {OUTPUT_XLSX}")


if __name__ == "__main__":
    main()
