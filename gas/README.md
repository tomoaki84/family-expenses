# Google Apps Script (GAS) LINE Bot セットアップ手順

このディレクトリのコード（`Code.gs`）は、LINEトークからのメッセージを Gemini 2.5 Flash で自然言語解析し、Supabase の `expenses` テーブルに登録する Webhook サーバーです。完全無料枠で動作します。

---

## 1. 必要な環境変数（スクリプトプロパティ）

Google Apps Script エディタの **「プロジェクトの設定（歯車アイコン）」➔「スクリプト プロパティ」** に以下を追加してください。

| プロパティ名 | 設定値の取得先・説明 |
| :--- | :--- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) で取得した無料APIキー |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers コンソールの Messaging API チャネル「チャネルアクセストークン（長期）」 |
| `SUPABASE_URL` | Supabase プロジェクト設定（Settings ➔ API）の `Project URL` (例: `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase プロジェクト設定の `anon public key` |
| `LIFF_URL` | (任意) LIFFアプリのURL (例: `https://liff.line.me/xxxx-xxxx`) |
| `SPREADSHEET_ID` | (任意) Google Drive 上の既存スプレッドシートID (URLの `/d/XXXXX/edit` の部分。空欄時は自動作成) |

---

## 2. デプロイ手順

1. [Google Apps Script](https://script.google.com/) で新規プロジェクトを作成します。
2. `Code.gs` の内容をコピー＆ペーストします。
3. 右上の **「デプロイ」➔「新しいデプロイ」** をクリックします。
4. 種類の選択で **「ウェブアプリ」** を選択します：
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: **全員 (Anyone)**
5. 「デプロイ」をクリックし、生成された **「ウェブアプリの URL」** をコピーします。

---

## 3. LINE Developers での Webhook 設定

1. [LINE Developers コンソール](https://developers.line.biz/) を開きます。
2. 作成した Messaging API チャネルの **「Messaging API設定」** タブを開きます。
3. **Webhook URL** に上記 2 でコピーした「ウェブアプリの URL」を貼り付けます。
4. **「Webhookの利用」** を **オン** にします。
5. **「検証」** ボタンを押して「成功」と表示されることを確認します。
6. **「応答メッセージ」** を **オフ** にします（LINE公式アカウント設定の「あいさつメッセージ」「応答メッセージ」をオフにして、Botのスクリプト応答のみにするため）。

---

## 4. LINE送信者（智明／康子）の自動認識設定

送信元LINEアカウントから名前を自動認識させたい場合、以下の手順でIDを登録します：

1. 智明さん、康子さんがそれぞれLINE Botに何かしらメッセージを送信します。
2. GASの **「実行数」ログ** または LINE Developers のログから、それぞれの `source.userId`（`U` から始まる英数字のID）を確認します。
3. Supabase の `app_settings` テーブルで、
   - `tomoaki_line_user_id` の `value` に智明さんの userId
   - `yasuko_line_user_id` の `value` に康子さんの userId
   を設定します。
4. 以降はメッセージ内に名前を書かなくても、自動で「智明」「康子」と判定されます。

---

## 5. Google スプレッドシート自動エクスポート（既存ファイル上書き）

LINEトークから `「スプレッドシート」` `「エクスポート」` `「スプシ」` などと送信すると、Google Drive 上のスプレッドシートに最新全データが上書き出力され、完了メッセージとともに直リンクURLが返信されます。

### 既存のスプレッドシートに上書き出力する場合:
1. Google Drive 上で対象のスプレッドシートを開きます。
2. ブラウザのアドレスバーのURLからIDをコピーします：
   - 例: `https://docs.google.com/spreadsheets/d/`**`1a2b3c4d5e...`**`/edit`
3. GASのスクリプトプロパティに `SPREADSHEET_ID` として上記IDを登録します（未設定の場合は新規スプレッドシートが自動作成されます）。
4. LINEで `「スプレッドシート」` と送信すれば、同ファイルの「支出調整」シートが常に最新フォーマットで上書き更新されます。
