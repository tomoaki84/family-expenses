# 夫婦間支出調整システム

LINE Bot（Gemini 2.5 Flash API）による日常の自然言語入力と、LIFF（Next.js Webアプリ）による閲覧・インライン編集・削除・グラフ分析・精算管理を組み合わせた、完全無料枠で運用可能な支出調整システムです。

---

## 📁 ディレクトリ構成

- **`supabase/`**: データベース定義およびシードデータ
  - `schema.sql`: テーブル定義（`expenses`, `app_settings`, `settlement_history`）、インデックス、RLS
  - `seed.sql`: `支出調整.xlsx` から移行した初期データ（105件、未精算18件）
- **`scripts/`**: データ移行・メンテナンススクリプト
  - `migrate_xlsx.py`: `支出調整.xlsx` (Sheet1) をパースし `seed.sql` を生成するPythonスクリプト（標準ライブラリのみで動作）
- **`gas/`**: LINE Bot サーバー（Google Apps Script）
  - `Code.gs`: LINE Webhook、Gemini 2.5 Flash Structured Outputs、Supabase REST API連携、取消・照会コマンド
  - `README.md`: GASデプロイとスクリプトプロパティ設定手順
- **`web/`**: LIFF Webビューワ（Next.js 15, Tailwind CSS, Recharts）
  - 4つのタブ: ホーム（要精算額 & 一括精算）、支出一覧（検索・フィルタ・編集・削除）、グラフ分析、設定（デフォルト割合変更）
- **`docs/`**: セットアップ・運用ドキュメント
  - `setup_guide.md`: Supabase、GAS、Vercel、LINE Developers、リッチメニューの完全設定ガイド
  - `richmenu.json`: LINE公式アカウント リッチメニュー設定データ

---

## 🚀 クイックスタート

詳細な手順は **[docs/setup_guide.md](docs/setup_guide.md)** をご覧ください。

1. **Supabase**:
   - `supabase/schema.sql` ➔ `supabase/seed.sql` の順に SQL Editor で実行。
2. **LINE Bot (GAS)**:
   - `gas/Code.gs` を Google Apps Script に貼り付けてウェブアプリとしてデプロイ。
3. **LIFF Webアプリ**:
   - `web/` を GitHub 経由で Vercel にデプロイ。
4. **LINE Developers**:
   - Messaging API の Webhook URL に GAS のURLを設定。
   - LIFFアプリのエンドポイントに Vercel のURLを設定。
