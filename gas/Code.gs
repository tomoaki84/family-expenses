/**
 * ==============================================================================
 * 夫婦間支出調整システム - Google Apps Script (GAS)
 * LINE Messaging API ＋ Gemini 2.5 Flash API ＋ Supabase REST API ＋ Google Sheets
 * ==============================================================================
 */

// スクリプトプロパティ（設定値）の取得
function getEnv(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * LINE Webhook エンドポイント
 */
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    const events = json.events;
    if (!events || events.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        handleTextMessage(event);
      }
    }
  } catch (err) {
    console.error('Webhook Error:', err);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * テキストメッセージ処理
 */
function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const userMessage = event.message.text.trim();
  const lineUserId = event.source.userId;

  // 1. Supabase の設定取得
  const settings = getAppSettings();
  const defaultRatio = settings['default_split_ratio'] || '6:4';
  const tomoakiUserId = settings['tomoaki_line_user_id'] || '';
  const yasukoUserId = settings['yasuko_line_user_id'] || '';
  const liffUrl = getEnv('LIFF_URL') || '';

  // 2. 送信者ユーザーの判定 (智明 / 康子 / 未特定)
  let senderName = '智明'; // デフォルト
  if (lineUserId === tomoakiUserId) {
    senderName = '智明';
  } else if (lineUserId === yasukoUserId) {
    senderName = '康子';
  } else {
    senderName = settings['default_payer'] || '智明';
  }

  // 2-B. LINEユーザーIDのワンタップ自動登録コマンド
  if (['私は智明', '智明です', '智明登録'].includes(userMessage)) {
    const ok = saveAppSetting('tomoaki_line_user_id', lineUserId);
    replyToLine(
      replyToken,
      ok
        ? `✅ このLINEアカウントを【智明】として登録しました！\n\nこれからは支払者の名前を省略して「スーパー 3200」のように送るだけで、自動的に【智明】の支払いとして記録されます。`
        : '⚠️ ユーザーIDの登録に失敗しました。'
    );
    return;
  }

  if (['私は康子', '康子です', '康子登録'].includes(userMessage)) {
    const ok = saveAppSetting('yasuko_line_user_id', lineUserId);
    replyToLine(
      replyToken,
      ok
        ? `✅ このLINEアカウントを【康子】として登録しました！\n\nこれからは支払者の名前を省略して「スーパー 3200」のように送るだけで、自動的に【康子】の支払いとして記録されます。`
        : '⚠️ ユーザーIDの登録に失敗しました。'
    );
    return;
  }

  // 3. 即時取消・キャンセルコマンドの判定
  if (['取消', 'キャンセル', 'とりけし'].includes(userMessage)) {
    const cancelResult = cancelLastExpense(senderName);
    replyToLine(replyToken, cancelResult);
    return;
  }

  // 4. 残高照会・状況確認コマンドの判定
  if (['今いくら', '今いくら？', '精算', '未精算', '残高', 'いくら'].includes(userMessage)) {
    const statusResult = getSettlementSummary();
    replyToLine(replyToken, statusResult);
    return;
  }

  // 5. スプレッドシート出力コマンドの判定 (直接判定)
  if (['スプレッドシート', 'スプシ', 'エクスポート', '書き出し', 'シート出力', 'スプレッドシート更新', 'シート更新', 'スプシ更新'].includes(userMessage)) {
    const exportResult = exportToSpreadsheet();
    replyToLine(replyToken, exportResult);
    return;
  }

  // 6. Gemini 2.5 Flash による自然言語パース
  const geminiResult = parseWithGemini(userMessage, senderName, defaultRatio);

  if (!geminiResult || !geminiResult.action) {
    replyToLine(replyToken, '申し訳ありません。支出内容を読み取れませんでした。\n例: 「スーパー 3200」や「スギ薬局 1980 家族カード」のように送信してください。');
    return;
  }

  if (geminiResult.action === 'check_status') {
    replyToLine(replyToken, getSettlementSummary());
    return;
  }

  if (geminiResult.action === 'cancel_last') {
    replyToLine(replyToken, cancelLastExpense(senderName));
    return;
  }

  if (geminiResult.action === 'export_spreadsheet') {
    const exportResult = exportToSpreadsheet();
    replyToLine(replyToken, exportResult);
    return;
  }

  // 7. 支出データの登録
  const expenses = geminiResult.expenses || [];
  if (expenses.length === 0) {
    replyToLine(replyToken, '支出内容が見つかりませんでした。金額が含まれているかご確認ください。');
    return;
  }

  const insertedRecords = [];
  for (const item of expenses) {
    // 負担割合と支払者の補正
    let payer = item.payer;
    if (!payer || payer === '未指定') {
      payer = senderName; // 送信元を支払者に適用
    }

    // 「智明負担」「智明全額」「康子負担」「康子全額」の場合の推測
    let splitRatio = item.split_ratio;
    if (splitRatio === '智明全額' || splitRatio === '智明負担') {
      splitRatio = '智明全額';
      if (!item.payer || item.payer === '未指定') {
        payer = '家族カード'; // 個人負担指定時は家族カード決済と推測
      }
    } else if (splitRatio === '康子全額' || splitRatio === '康子負担') {
      splitRatio = '康子全額';
      if (!item.payer || item.payer === '未指定') {
        payer = '家族カード';
      }
    } else if (!splitRatio || splitRatio === '未指定') {
      splitRatio = defaultRatio;
    }

    // 負担額計算
    let tomoakiAmt = 0;
    let yasukoAmt = 0;
    if (item.custom_tomoaki_amount !== undefined && item.custom_yasuko_amount !== undefined) {
      tomoakiAmt = item.custom_tomoaki_amount;
      yasukoAmt = item.custom_yasuko_amount;
    } else {
      const shares = calculateShares(item.amount, splitRatio);
      tomoakiAmt = shares.tomoaki;
      yasukoAmt = shares.yasuko;
    }

    const payload = {
      date: item.date || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'),
      title: item.title,
      amount: item.amount,
      payer: payer,
      split_ratio: splitRatio,
      tomoaki_amount: tomoakiAmt,
      yasuko_amount: yasukoAmt,
      settlement_status: '未精算',
      category: item.category || 'その他',
      entry_type: item.entry_type || (item.amount < 0 ? 'income_offset' : 'expense'),
      memo: item.memo || null,
      registered_by: senderName
    };

    const inserted = insertExpense(payload);
    if (inserted) {
      insertedRecords.push(inserted);
    }
  }

  // 8. LINE返信メッセージ生成
  const replyMessage = buildSuccessReply(insertedRecords, liffUrl);
  replyToLine(replyToken, replyMessage);

  // （オプション）登録時に自動同期が設定されている場合はスプレッドシートも上書き更新
  if (settings['auto_sync_spreadsheet'] === 'true') {
    try {
      exportToSpreadsheet();
    } catch (e) {
      console.error('Auto sync spreadsheet failed:', e);
    }
  }
}

/**
 * 負担額の計算ロジック
 */
function calculateShares(amount, ratio) {
  if (ratio === '智明全額') {
    return { tomoaki: amount, yasuko: 0 };
  }
  if (ratio === '康子全額') {
    return { tomoaki: 0, yasuko: amount };
  }
  if (ratio === '5:5' || ratio === '折半' || ratio === '半分') {
    const t = Math.round(amount * 0.5);
    return { tomoaki: t, yasuko: amount - t };
  }
  if (ratio === '6:4') {
    const t = Math.round(amount * 0.6);
    return { tomoaki: t, yasuko: amount - t };
  }
  if (ratio === '1:2') {
    const t = Math.round(amount * (1.0 / 3.0));
    return { tomoaki: t, yasuko: amount - t };
  }
  const m = ratio.match(/^(\d+):(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a + b > 0) {
      const t = Math.round(amount * (a / (a + b)));
      return { tomoaki: t, yasuko: amount - t };
    }
  }
  const t = Math.round(amount * 0.6);
  return { tomoaki: t, yasuko: amount - t };
}

/**
 * Gemini 2.5 Flash API で自然言語パース
 */
function parseWithGemini(userText, senderName, defaultRatio) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return null;
  }

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  const prompt = `あなたは夫婦（夫: 智明, 妻: 康子）の支出調整アシスタントです。
送信者: ${senderName}
本日の日付: ${todayStr}
現在のデフォルト負担割合: ${defaultRatio}

ユーザーのLINEメッセージから支出や操作を解析し、指定のJSONスキーマのみを出力してください。

【抽出・解釈ルール】
1. action:
   - 新規支出の登録 -> "create_expenses"
   - 精算状況の照会（「今いくら」「精算額教えて」等） -> "check_status"
   - 直前登録の取消（「取消」「キャンセル」等） -> "cancel_last"
   - スプレッドシート出力（「スプレッドシート」「エクスポート」「スプシ更新」等） -> "export_spreadsheet"

2. expenses（1メッセージ内に複数品目がある場合は配列に分割）:
   - title: 店名・品目名（用途や割引理由はmemoへ）
   - amount: 支出金額（数値のみ）。
     - 「16000円」「16,000」等の単位・カンマを除去。
     - クーポンやポイント利用がある場合（例: 「4990円 クーポン500円引き」）、実質支払額（4490）をamountとし、クーポン情報はmemoへ。
     - お祝い金や出産一時金・給付金等の受領・相殺は「負の金額（例: -20000）」とする。
   - payer: "智明", "康子", "家族カード", "未指定" のいずれか。
   - split_ratio: "5:5", "6:4", "1:2", "智明全額", "康子全額", "未指定", "実額指定"。
     - 「折半」「半分」「半分こ」-> "5:5"
     - 「智明全額」「智明負担」-> "智明全額"（家族カード決済と推定）
     - 「康子全額」「康子負担」-> "康子全額"（家族カード決済と推定）
   - custom_tomoaki_amount / custom_yasuko_amount: 「智明5000 康子2500」等の実額割り勘指定時に設定。
   - date: YYYY-MM-DD形式。「昨日」「一昨日」「10/5」等の相対・月日表記は本日の日付（${todayStr}）を基準に正確な日付へ変換。省略時は本日の日付。
   - category: "食費", "日用品", "家電", "医療費", "子供/教育", "光熱費/固定費", "交通/旅行", "その他" から最も適切なものを選択。
   - memo: 補足情報や割引内容。
   - entry_type: "expense" (支出), "income_offset" (相殺受領), "kotora_charge" (ことら家族口座入金), "kotora_settle" (ことら精算送金)。`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt + '\n\n【ユーザー入力】\n' + userText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['create_expenses', 'check_status', 'cancel_last', 'export_spreadsheet'] },
          expenses: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                amount: { type: 'INTEGER' },
                payer: { type: 'STRING', enum: ['智明', '康子', '家族カード', '未指定'] },
                split_ratio: { type: 'STRING' },
                custom_tomoaki_amount: { type: 'INTEGER' },
                custom_yasuko_amount: { type: 'INTEGER' },
                date: { type: 'STRING' },
                category: { type: 'STRING', enum: ['食費', '日用品', '家電', '医療費', '子供/教育', '光熱費/固定費', '交通/旅行', 'その他'] },
                memo: { type: 'STRING' },
                entry_type: { type: 'STRING', enum: ['expense', 'income_offset', 'kotora_charge', 'kotora_settle'] }
              },
              required: ['title', 'amount']
            }
          }
        },
        required: ['action']
      }
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) {
    console.error('Gemini API Error:', res.getContentText());
    return null;
  }

  const resData = JSON.parse(res.getContentText());
  const jsonText = resData.candidates[0].content.parts[0].text;
  return JSON.parse(jsonText);
}

/**
 * Supabase app_settings 取得
 */
function getAppSettings() {
  const sbUrl = getEnv('SUPABASE_URL');
  const sbKey = getEnv('SUPABASE_ANON_KEY');
  if (!sbUrl || !sbKey) return {};

  const url = `${sbUrl}/rest/v1/app_settings?select=key,value`;
  const options = {
    method: 'get',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`
    },
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      const map = {};
      data.forEach(item => { map[item.key] = item.value; });
      return map;
    }
  } catch (e) {
    console.error('Fetch app_settings failed:', e);
  }
  return {};
}

/**
 * Supabase app_settings 保存（upsert）
 */
function saveAppSetting(key, value) {
  const sbUrl = getEnv('SUPABASE_URL');
  const sbKey = getEnv('SUPABASE_ANON_KEY');
  if (!sbUrl || !sbKey) return false;

  const url = `${sbUrl}/rest/v1/app_settings`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    payload: JSON.stringify({
      key: key,
      value: value,
      updated_at: new Date().toISOString()
    }),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    return code === 200 || code === 201 || code === 204;
  } catch (e) {
    console.error('Save app_settings failed:', e);
    return false;
  }
}

/**
 * Supabase expenses 登録
 */
function insertExpense(record) {
  const sbUrl = getEnv('SUPABASE_URL');
  const sbKey = getEnv('SUPABASE_ANON_KEY');
  const url = `${sbUrl}/rest/v1/expenses`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify(record),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() === 201) {
    const inserted = JSON.parse(res.getContentText());
    return inserted[0];
  }
  console.error('Insert expense failed:', res.getContentText());
  return null;
}

/**
 * 直前登録の取消（DELETE）
 */
function cancelLastExpense(senderName) {
  const sbUrl = getEnv('SUPABASE_URL');
  const sbKey = getEnv('SUPABASE_ANON_KEY');
  
  const getUrl = `${sbUrl}/rest/v1/expenses?order=created_at.desc&limit=1`;
  const options = {
    method: 'get',
    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(getUrl, options);
  if (res.getResponseCode() !== 200) return '取消対象のデータが見つかりませんでした。';

  const rows = JSON.parse(res.getContentText());
  if (rows.length === 0) return '登録済みのデータがありません。';

  const target = rows[0];
  const delUrl = `${sbUrl}/rest/v1/expenses?id=eq.${target.id}`;
  const delOptions = {
    method: 'delete',
    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    muteHttpExceptions: true
  };

  const delRes = UrlFetchApp.fetch(delUrl, delOptions);
  if (delRes.getResponseCode() === 200 || delRes.getResponseCode() === 204) {
    return `🗑️ 直前の登録を取り消しました。\n━━━━━━━━━━━━━━\n【内容】${target.title}\n【金額】¥${target.amount.toLocaleString()} (${target.payer})\n\n正しい内容があれば再度送信してください。`;
  }
  return 'データの取消に失敗しました。';
}

/**
 * 未精算サマリーの取得
 */
function getSettlementSummary() {
  const sbUrl = getEnv('SUPABASE_URL');
  const sbKey = getEnv('SUPABASE_ANON_KEY');

  const url = `${sbUrl}/rest/v1/expenses?settlement_status=eq.未精算&select=payer,tomoaki_amount,yasuko_amount`;
  const options = {
    method: 'get',
    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) return '精算データの取得に失敗しました。';

  const rows = JSON.parse(res.getContentText());
  if (rows.length === 0) {
    return '✨ 現在、未精算の支出はありません！（精算完了済み）';
  }

  let netTomoakiToYasuko = 0;
  for (const exp of rows) {
    const effectivePayer = exp.payer === '家族カード' ? '智明' : exp.payer;
    if (effectivePayer === '智明') {
      netTomoakiToYasuko -= exp.yasuko_amount;
    } else {
      netTomoakiToYasuko += exp.tomoaki_amount;
    }
  }

  let summaryText = '';
  if (netTomoakiToYasuko < 0) {
    summaryText = `康子 ➔ 智明: ¥${(-netTomoakiToYasuko).toLocaleString()}`;
  } else if (netTomoakiToYasuko > 0) {
    summaryText = `智明 ➔ 康子: ¥${netTomoakiToYasuko.toLocaleString()}`;
  } else {
    summaryText = '貸し借りなし (¥0)';
  }

  return `📊 現在の要精算額 (未精算 ${rows.length}件)\n━━━━━━━━━━━━━━\n👉 ${summaryText}\n━━━━━━━━━━━━━━\n※ LINEで「取消」と送ると直前入力を取り消せます。`;
}

/**
 * 登録完了メッセージの組み立て
 */
function buildSuccessReply(records, liffUrl) {
  if (records.length === 0) return '登録に失敗しました。';

  let text = `✅ 登録しました！（${records.length}件）\n━━━━━━━━━━━━━━\n`;
  for (const r of records) {
    text += `【内容】${r.title}\n`;
    text += `【金額】¥${r.amount.toLocaleString()} (${r.payer})\n`;
    text += `【負担】智明 ¥${r.tomoaki_amount.toLocaleString()} / 康子 ¥${r.yasuko_amount.toLocaleString()} (${r.split_ratio})\n`;
    if (r.memo) text += `【メモ】${r.memo}\n`;
    text += `──────────────────\n`;
  }

  const summary = getSettlementSummary();
  text += summary;

  if (liffUrl) {
    const lastId = records[records.length - 1].id;
    text += `\n\n✏️ 修正・削除:\n${liffUrl}?edit=${lastId}`;
  }

  return text;
}

/**
 * ==============================================================================
 * Google Drive スプレッドシートへの最新データ上書きエクスポート
 * ==============================================================================
 */
function exportToSpreadsheet() {
  try {
    const sbUrl = getEnv('SUPABASE_URL');
    const sbKey = getEnv('SUPABASE_ANON_KEY');
    let ssId = getEnv('SPREADSHEET_ID');

    if (!sbUrl || !sbKey) {
      return '⚠️ Supabaseの接続設定が見つかりません。';
    }

  // 1. スプレッドシートの取得または自動生成
  let ss = null;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      console.warn('Cannot open by SPREADSHEET_ID, creating new one:', e);
    }
  }

  if (!ss) {
    // 新規スプレッドシートを作成しプロパティに保存
    ss = SpreadsheetApp.create('夫婦間支出調整');
    ssId = ss.getId();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ssId);
  }

  // 2. Supabase から全支出データを取得 (日付降順)
  const url = `${sbUrl}/rest/v1/expenses?order=date.desc,created_at.desc&select=*`;
  const options = {
    method: 'get',
    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) {
    return '⚠️ 支出データの取得に失敗しました。';
  }
  const allExpenses = JSON.parse(res.getContentText());

  // 3. シート「支出調整」の取得と初期化
  let sheet = ss.getSheetByName('支出調整');
  if (!sheet) {
    sheet = ss.insertSheet('支出調整', 0);
  }
  sheet.clear(); // 既存データ・書式を上書きクリア

  // グリッド線の表示
  sheet.setHiddenGridlines(false);

  // 4. 未精算サマリーの集計
  const unsettled = allExpenses.filter(e => e.settlement_status === '未精算');
  let netTomoakiToYasuko = 0;
  let unsettledTotal = 0;
  for (const exp of unsettled) {
    unsettledTotal += exp.amount;
    const effectivePayer = exp.payer === '家族カード' ? '智明' : exp.payer;
    if (effectivePayer === '智明') {
      netTomoakiToYasuko -= exp.yasuko_amount;
    } else {
      netTomoakiToYasuko += exp.tomoaki_amount;
    }
  }

  let directionText = '精算なし';
  let netAmount = 0;
  if (netTomoakiToYasuko < 0) {
    directionText = '康子 ➔ 智明';
    netAmount = -netTomoakiToYasuko;
  } else if (netTomoakiToYasuko > 0) {
    directionText = '智明 ➔ 康子';
    netAmount = netTomoakiToYasuko;
  }

  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

  // 5. 【サマリーカード エリア】の作成 (行 1〜3)
  // A1:D3 -> 要精算額カード
  sheet.getRange('A1:D1').merge().setValue('📊 現在の要精算額 (未精算)');
  sheet.getRange('A2:D2').merge().setValue(directionText);
  sheet.getRange('A3:D3').merge().setValue(`¥${netAmount.toLocaleString()}`);
  const card1 = sheet.getRange('A1:D3');
  card1.setBackground('#1E293B').setFontColor('#FFFFFF').setFontFamily('Arial');
  sheet.getRange('A1').setFontSize(9).setFontWeight('normal');
  sheet.getRange('A2').setFontSize(11).setFontColor('#FDE68A').setFontWeight('bold');
  sheet.getRange('A3').setFontSize(16).setFontWeight('bold');
  card1.setHorizontalAlignment('center').setVerticalAlignment('middle');

  // E1:F3 -> 未精算件数カード
  sheet.getRange('E1:F1').merge().setValue('未精算件数');
  sheet.getRange('E2:F3').merge().setValue(`${unsettled.length} 件`);
  const card2 = sheet.getRange('E1:F3');
  card2.setBackground('#F0F9FF').setFontColor('#0369A1').setFontFamily('Arial');
  sheet.getRange('E1').setFontSize(9).setFontWeight('normal');
  sheet.getRange('E2').setFontSize(14).setFontWeight('bold');
  card2.setHorizontalAlignment('center').setVerticalAlignment('middle');

  // G1:H3 -> 未精算総支出カード
  sheet.getRange('G1:H1').merge().setValue('未精算 支出合計');
  sheet.getRange('G2:H3').merge().setValue(`¥${unsettledTotal.toLocaleString()}`);
  const card3 = sheet.getRange('G1:H3');
  card3.setBackground('#F5F3FF').setFontColor('#6D28D9').setFontFamily('Arial');
  sheet.getRange('G1').setFontSize(9).setFontWeight('normal');
  sheet.getRange('G2').setFontSize(14).setFontWeight('bold');
  card3.setHorizontalAlignment('center').setVerticalAlignment('middle');

  // I1:M3 -> 最終更新日時 & 説明
  sheet.getRange('I1:M1').merge().setValue('最終エクスポート日時 (LINE自動出力)');
  sheet.getRange('I2:M2').merge().setValue(nowStr);
  sheet.getRange('I3:M3').merge().setValue(`総登録件数: ${allExpenses.length} 件 (精算済: ${allExpenses.length - unsettled.length} 件)`);
  const card4 = sheet.getRange('I1:M3');
  card4.setBackground('#F0FDF4').setFontColor('#166534').setFontFamily('Arial');
  sheet.getRange('I1').setFontSize(9).setFontWeight('normal');
  sheet.getRange('I2').setFontSize(11).setFontWeight('bold');
  sheet.getRange('I3').setFontSize(9).setFontColor('#4B5563');
  card4.setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 枠線
  sheet.getRange('A1:M3').setBorder(true, true, true, true, true, true, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID);

  // 6. 【テーブルヘッダー】 (行 5〜6)
  sheet.getRange('A5:B5').merge().setValue('支出内容');
  sheet.getRange('C5').setValue('日付');
  sheet.getRange('D5:F5').merge().setValue('支払い元 (立替)');
  sheet.getRange('G5').setValue('負担割合');
  sheet.getRange('H5:I5').merge().setValue('負担額');
  sheet.getRange('J5:K5').merge().setValue('調整額 (+が払う / -がもらう)');
  sheet.getRange('L5').setValue('カテゴリ');
  sheet.getRange('M5').setValue('精算状況 / メモ');

  const subHeaders = [
    '支出内容 (大項目)', '詳細・品目', '日付',
    '家族カード', '智明', '康子',
    '割合',
    '智明負担', '康子負担',
    '智明 (調整)', '康子 (調整)',
    'カテゴリ', '精算状況'
  ];
  sheet.getRange(6, 1, 1, subHeaders.length).setValues([subHeaders]);

  // ヘッダーデザイン
  const headerRow5 = sheet.getRange('A5:M5');
  headerRow5.setBackground('#334155').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');

  const headerRow6 = sheet.getRange('A6:M6');
  headerRow6.setBackground('#475569').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  // 列ごとのヘッダー色分け（視認性向上）
  sheet.getRange('D6').setBackground('#EA580C'); // 家族カード (オレンジ)
  sheet.getRange('E6').setBackground('#0284C7'); // 智明 (青)
  sheet.getRange('F6').setBackground('#DB2777'); // 康子 (ピンク)
  sheet.getRange('H6').setBackground('#0284C7'); // 智明負担
  sheet.getRange('I6').setBackground('#DB2777'); // 康子負担

  // ヘッダー行フリーズ (スクロールしても常時表示)
  sheet.setFrozenRows(6);

  // 7. 【データ行】の展開 (行 7〜)
  if (allExpenses.length > 0) {
    const rows = [];
    const bgColors = [];

    for (let i = 0; i < allExpenses.length; i++) {
      const exp = allExpenses[i];

      // タイトル分割（空白がある場合は大項目と詳細に分ける）
      const parts = exp.title.split(/\s+/);
      const titleMain = parts[0] || '';
      const titleSub = parts.slice(1).join(' ') || '';

      // 支払い元ごとの金額
      let dCard = '';
      let eTomo = '';
      let fYasu = '';
      if (exp.payer === '家族カード') dCard = exp.amount;
      else if (exp.payer === '智明') eTomo = exp.amount;
      else if (exp.payer === '康子') fYasu = exp.amount;

      // 調整額の計算（智明・康子）
      // 家族カード(智明口座) or 智明立替: 智明調整 = -yasuko_amount, 康子調整 = +yasuko_amount
      // 康子立替: 智明調整 = +tomoaki_amount, 康子調整 = -tomoaki_amount
      let jAdj = 0;
      let kAdj = 0;
      const effectivePayer = exp.payer === '家族カード' ? '智明' : exp.payer;
      if (effectivePayer === '智明') {
        jAdj = -exp.yasuko_amount;
        kAdj = exp.yasuko_amount;
      } else {
        jAdj = exp.tomoaki_amount;
        kAdj = -exp.tomoaki_amount;
      }

      // 精算ステータス表示
      let statusStr = exp.settlement_status;
      if (exp.memo) {
        statusStr += ` (${exp.memo})`;
      }

      rows.push([
        titleMain,
        titleSub,
        exp.date,
        dCard,
        eTomo,
        fYasu,
        exp.split_ratio,
        exp.tomoaki_amount,
        exp.yasuko_amount,
        jAdj,
        kAdj,
        exp.category || 'その他',
        statusStr
      ]);

      // 行の背景色（未精算は薄黄色 #FEF3C7、精算済は白/淡グレー交互）
      if (exp.settlement_status === '未精算') {
        bgColors.push(Array(13).fill('#FEF3C7'));
      } else {
        const bg = (i % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
        bgColors.push(Array(13).fill(bg));
      }
    }

    const dataRange = sheet.getRange(7, 1, rows.length, 13);
    dataRange.setValues(rows);
    dataRange.setBackgrounds(bgColors);
    dataRange.setFontFamily('Arial').setFontSize(9);
    dataRange.setBorder(true, true, true, true, true, true, '#E2E8F0', SpreadsheetApp.BorderStyle.SOLID);

    // 8. 【合計行】 (行 7 + rows.length)
    const totalRowIdx = 7 + rows.length;
    sheet.getRange(totalRowIdx, 1).setValue('合計');
    sheet.getRange(totalRowIdx, 1, 1, 3).merge().setHorizontalAlignment('center').setFontWeight('bold');

    // SUM数式を設定 (D, E, F, H, I, J, K列)
    const formulaCols = ['D', 'E', 'F', 'H', 'I', 'J', 'K'];
    for (const col of formulaCols) {
      sheet.getRange(`${col}${totalRowIdx}`).setFormula(`=SUM(${col}7:${col}${totalRowIdx - 1})`);
    }

    const totalRange = sheet.getRange(totalRowIdx, 1, 1, 13);
    totalRange.setBackground('#E2E8F0').setFontWeight('bold').setFontSize(10);
    totalRange.setBorder(true, true, true, true, true, true, '#94A3B8', SpreadsheetApp.BorderStyle.DOUBLE);

    // 9. 書式フォーマットの適用
    // 日付 (C列)
    sheet.getRange(`C7:C${totalRowIdx}`).setNumberFormat('yyyy/MM/dd').setHorizontalAlignment('center');
    // 金額列 (D, E, F, H, I, J, K列)
    sheet.getRange(`D7:F${totalRowIdx}`).setNumberFormat('¥#,##0');
    sheet.getRange(`H7:K${totalRowIdx}`).setNumberFormat('¥#,##0');
    // 割合 (G列) & カテゴリ (L列)
    sheet.getRange(`G7:G${totalRowIdx}`).setHorizontalAlignment('center');
    sheet.getRange(`L7:L${totalRowIdx}`).setHorizontalAlignment('center');
  }

    // 10. 列幅の最適化（高速設定）
    const colWidths = [160, 120, 95, 95, 95, 95, 75, 95, 95, 100, 100, 90, 180];
    for (let c = 0; c < colWidths.length; c++) {
      sheet.setColumnWidth(c + 1, colWidths[c]);
    }
    SpreadsheetApp.flush();

    // スプレッドシートURL
    const ssUrl = ss.getUrl();

    return `📑 スプレッドシートのエクスポートが完了しました！\n━━━━━━━━━━━━━━\n【総件数】${allExpenses.length} 件 (未精算: ${unsettled.length} 件)\n【要精算額】${directionText} : ¥${netAmount.toLocaleString()}\n【更新シート】支出調整\n━━━━━━━━━━━━━━\n👇 こちらから開けます:\n${ssUrl}`;
  } catch (err) {
    console.error('Export Error:', err);
    return `⚠️ スプレッドシート出力中にエラーが発生しました:\n${err.message}\n\n(※初回のみGAS画面上部で「testExportToSpreadsheet」を選んで「実行」を押し、Googleスプレッドシートへのアクセス権限を承認してください)`;
  }
}

/**
 * LINEへのプッシュメッセージ送信
 */
function pushToLine(userId, text) {
  if (!userId) return;
  const channelToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
  if (!channelToken) return;

  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [{ type: 'text', text: text }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${channelToken}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error('Push to Line failed:', e);
  }
}

/**
 * LINEへのメッセージ返信
 */
function replyToLine(replyToken, text) {
  const channelToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
  if (!channelToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: text
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${channelToken}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch(url, options);
}

/**
 * GASエディタから手動テスト実行用
 */
function testExportToSpreadsheet() {
  const result = exportToSpreadsheet();
  console.log(result);
}
