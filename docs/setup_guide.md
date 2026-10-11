# 夫婦間支出調整システム 全体セットアップ＆運用ガイド

このガイドでは、LINE Bot（自然言語入力）と LIFF Webアプリ（閲覧・編集・グラフ・設定）を連携させ、完全無料枠で運用開始する手順を説明します。

---

## 全体アーキテクチャ概要

```
[iPhone / iPad]
  │
  ├─► ① 日常の入力: LINEトーク ──► Google Apps Script (GAS) ──► Gemini 2.5 Flash
  │                                           │                                │
  │                                           ▼                                ▼
  │                                    Supabase (DB) ◄─────────────────────────┘
  │                                           ▲
  └─► ② 変更/削除/グラフ/設定: リッチメニュータップ │
             └─► LIFF (Next.js / Vercel) ──────┘
```

---

## Step 1: Supabase (データベース) の作成

1. [Supabase](https://supabase.com/) にアクセスし、無料アカウントでログインして新規プロジェクトを作成します。
2. 左メニューの **「SQL Editor」** を開きます。
3. `supabase/schema.sql` の内容をすべて貼り付けて **「Run」** を実行します（テーブル・RLSが作成されます）。
4. `supabase/seed.sql` の内容を貼り付けて **「Run」** を実行します（既存の `支出調整.xlsx` 105件のデータがインポートされます）。
   - Row 95以前（87件）は **`精算済`**
   - Row 99以降（18件）は **`未精算`** として投入されます。
5. 左メニューの **「Project Settings」➔「API」** から以下をメモします：
   - **Project URL**
   - **anon public key**

---

## Step 2: Google Apps Script (LINE Bot ＋ Gemini API) のデプロイ

1. [Google AI Studio](https://aistudio.google.com/) で無料の Gemini API キーを発行します。
2. [Google Apps Script](https://script.google.com/) で新規プロジェクトを作成します。
3. `gas/Code.gs` の内容をコピー＆ペーストします。
4. **「プロジェクトの設定（歯車）」➔「スクリプト プロパティ」** に以下を設定します：
   - `GEMINI_API_KEY`: 手順1のGemini APIキー
   - `SUPABASE_URL`: 手順1のSupabase Project URL
   - `SUPABASE_ANON_KEY`: 手順1のSupabase anon key
   - `LINE_CHANNEL_ACCESS_TOKEN`: （Step 4で発行するLINEトークン）
   - `LIFF_URL`: （Step 3で発行するLIFF URL）
5. 右上 **「デプロイ」➔「新しいデプロイ」**：
   - 種類: **ウェブアプリ**
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員 (Anyone)**
6. 生成された **「ウェブアプリの URL」** をメモします。

---

## Step 3: Next.js (LIFFアプリ) を Vercel にデプロイ

1. 本リポジトリを GitHub にプッシュします。
2. [Vercel](https://vercel.com/) にログインし、「Add New Project」から本リポジトリをインポートします。
3. **Root Directory** に `web` を指定します。
4. **Environment Variables** に以下を設定します：
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
5. **「Deploy」** をクリックします。
6. デプロイ完了後、発行されたURL（例: `https://shishutsu-chosei.vercel.app`）をメモします。

---

## Step 4: LINE Developers (Messaging API & LIFF) の設定

1. [LINE Developers コンソール](https://developers.line.biz/) にログインします。
2. プロバイダーを作成し、**「Messaging API」** チャネルを新規作成します。
   - **「Messaging API設定」** タブで **「チャネルアクセストークン（長期）」** を発行し、GASのスクリプトプロパティ `LINE_CHANNEL_ACCESS_TOKEN` に貼り付けます。
   - **Webhook URL** に Step 2 で取得した GAS のウェブアプリURLを設定し、「Webhookの利用」を**オン**にします。
   - LINE Official Account Manager の「応答設定」で **「応答メッセージ」をオフ** にします。
3. 同じプロバイダー内に **「LINEログイン」** チャネルを作成（またはMessaging APIチャネル内）し、**「LIFF」** タブを開きます。
   - **LIFFアプリを追加**:
     - サイズ: **Full**
     - エンドポイントURL: Step 3 の Vercel URL（例: `https://shishutsu-chosei.vercel.app`）
     - Scope: `profile`, `openid`
   - 発行された **LIFF URL（例: `https://liff.line.me/xxxxxxxx-xxxxxx`）** を取得し、GASのスクリプトプロパティ `LIFF_URL` に設定します。

---

## Step 5: LINE公式アカウント リッチメニューの作成

[LINE Official Account Manager](https://manager.line.biz/) の **「リッチメニュー」** から作成します。

### 推奨レイアウト（下部3分割）
- **タイルA（左・小）**: `テキスト入力のヘルプ`
  - アクション: **テキスト**
  - 送信テキスト: `スーパー 3200`
- **タイルB（中央・大）**: `支出一覧・グラフを開く`
  - アクション: **リンク**
  - URL: `https://liff.line.me/xxxxxxxx-xxxxxx`
- **タイルC（右・小）**: `設定・精算`
  - アクション: **リンク**
  - URL: `https://liff.line.me/xxxxxxxx-xxxxxx?tab=settings`

---

## Step 6: 夫婦の日常の使い方

### 1. LINEトークでの手軽な登録
- `「スーパー 3200」` ➔ 送信元（智明／康子）から自動判定、デフォルト比率（6:4）で登録
- `「スギ薬局 1980 家族カード」` ➔ 家族カード決済として登録
- `「ワイシャツ 16000 智明負担」` ➔ 家族カード決済・智明全額負担として登録
- `「出産一時金 -100000」` ➔ 相殺分配データとして登録
- `「取消」` ➔ 直前の登録を即座にキャンセル

### 2. LIFFアプリでの確認・精算
- リッチメニューをタップするとアプリが開き、**要精算額（康子 ➔ 智明 ¥14,280 など）** が一目で確認できます。
- 精算が完了したら **「精算済みにする」** ボタンをワンタップするだけで、未精算データが一括で精算済みに更新されます。

### 3. Google Drive スプレッドシートへのエクスポート（上書き更新）
- LINEトークで **`「スプレッドシート」`** または **`「エクスポート」`** と送信すると、Google Drive上のスプレッドシートが最新データで上書き更新されます。
- 更新完了メッセージとともにスプレッドシートの直リンクURLが返信されるため、いつでもPCやスマホからExcel感覚で閲覧・バックアップが可能です。
- **レイアウトの特徴**:
  - 上部に「現在の要精算額」「未精算件数」「総支出」のサマリーカードを常時表示。
  - ヘッダーがスクロール固定（フリーズ行）。
  - 未精算行は薄黄色でハイライト。
  - 各金額列には自動で `=SUM(...)` 合計数式と `¥#,##0` 通貨フォーマットが適用。
