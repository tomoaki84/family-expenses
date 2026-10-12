-- ==============================================================================
-- カテゴリ更新用 SQL スクリプト: ことら送金・入金および給付金等のカテゴリ移行
-- ==============================================================================
-- 実行方法:
-- Supabase の管理画面（SQL Editor）にこの内容を貼り付けて「RUN」を実行してください。
-- ==============================================================================

-- 1. 「ことら送金」「ことら入金」などの送金・入金レコードを「収入/入金」に変更
UPDATE expenses
SET category = '収入/入金'
WHERE (
  title ILIKE '%ことら%' 
  OR memo ILIKE '%ことら%' 
  OR title ILIKE '%送金%' 
  OR memo ILIKE '%送金%'
  OR (category = 'その他' AND (title ILIKE '%入金%' OR memo ILIKE '%入金%'))
);

-- 2. 給付金・一時金・還付金・お祝い受領金等も「収入/入金」に変更
UPDATE expenses
SET category = '収入/入金'
WHERE (
  title ILIKE '%給付金%' 
  OR title ILIKE '%一時金%' 
  OR title ILIKE '%還付金%' 
  OR title ILIKE '%児童手当%'
  OR (title ILIKE '%祝い%' AND title NOT ILIKE '%お返し%' AND title NOT ILIKE '%内祝%')
  OR (title ILIKE '%祝儀%')
);

-- 確認用クエリ: 「収入/入金」カテゴリとして登録されたデータ一覧を表示
SELECT id, date, title, amount, payer, split_ratio, category, settlement_status, memo
FROM expenses
WHERE category = '収入/入金'
ORDER BY date DESC;
