-- ==============================================================================
-- 夫婦間支出調整システム - Supabase データベース定義 (DDL)
-- ==============================================================================

-- 1. アプリ全体設定テーブル（デフォルト負担割合、LINEユーザー紐付け等）
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期設定データの投入
INSERT INTO app_settings (key, value, description)
VALUES 
  ('default_split_ratio', '6:4', '新規入力時に割合指定がない場合のデフォルト値 (6:4, 5:5, 1:2 等)'),
  ('default_payer', '智明', '支払者が省略された場合のデフォルト支払者 (智明 または 康子)'),
  ('family_card_payer', '智明', '家族カードの引落口座名義人 (智明 または 康子)'),
  ('tomoaki_line_user_id', '', '智明のLINEユーザー固有ID (Uから始まるID)'),
  ('yasuko_line_user_id', '', '康子のLINEユーザー固有ID (Uから始まるID)'),
  ('export_spreadsheet_id', '', 'Google Drive 出力先スプレッドシートID (空欄時は自動作成)'),
  ('auto_sync_spreadsheet', 'false', '支出登録時にスプレッドシートも自動上書き更新するか (true / false)')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- 2. 支出管理テーブル (amountの負数[給付金・お祝い相殺]をサポート)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL, -- 負数（給付金やお祝い金等の相殺受領）も許容
  payer TEXT NOT NULL CHECK (payer IN ('智明', '康子', '家族カード')),
  split_ratio TEXT NOT NULL DEFAULT '6:4', -- '6:4', '5:5', '1:2', '智明全額', '康子全額', '実額指定' 等
  tomoaki_amount INTEGER NOT NULL DEFAULT 0,
  yasuko_amount INTEGER NOT NULL DEFAULT 0,
  settlement_status TEXT NOT NULL DEFAULT '未精算' CHECK (settlement_status IN ('未精算', '精算済')),
  settlement_id UUID,
  category TEXT DEFAULT 'その他',
  memo TEXT,
  entry_type TEXT NOT NULL DEFAULT 'expense' CHECK (entry_type IN ('expense', 'income_offset', 'kotora_charge', 'kotora_settle')),
  registered_by TEXT, -- 登録元ユーザー名（智明, 康子, system）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 精算履歴テーブル
CREATE TABLE IF NOT EXISTS settlement_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  direction TEXT NOT NULL, -- '康子 -> 智明' または '智明 -> 康子'
  settlement_amount INTEGER NOT NULL,
  expense_count INTEGER NOT NULL,
  memo TEXT
);

-- 4. 検索・集計用インデックス
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_settlement ON expenses(settlement_status);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer);
CREATE INDEX IF NOT EXISTS idx_expenses_settlement_id ON expenses(settlement_id);

-- 5. updated_at 自動更新関数 & トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expenses_updated_at ON expenses;
CREATE TRIGGER trigger_update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_app_settings_updated_at ON app_settings;
CREATE TRIGGER trigger_update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Row Level Security (RLS) 設定
-- 個人利用・完全無料枠構成のため、anonキーによるCRUD操作を許可
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public anon access for app_settings" ON app_settings
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for expenses" ON expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for settlement_history" ON settlement_history
  FOR ALL TO anon USING (true) WITH CHECK (true);
