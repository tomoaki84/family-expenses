import { Expense, NetSettlement } from './types';

export interface SplitResult {
  tomoakiAmount: number;
  yasukoAmount: number;
}

/**
 * 金額と割合から智明・康子の負担額を計算
 * 端数は四捨五入し、tomoakiAmount + yasukoAmount === amount を常に保証
 */
export function calculateSplit(amount: number, ratio: string): SplitResult {
  if (ratio === '智明全額') {
    return { tomoakiAmount: amount, yasukoAmount: 0 };
  }
  if (ratio === '康子全額') {
    return { tomoakiAmount: 0, yasukoAmount: amount };
  }
  if (ratio === '5:5' || ratio === '折半' || ratio === '半分') {
    const tomo = Math.round(amount * 0.5);
    return { tomoakiAmount: tomo, yasukoAmount: amount - tomo };
  }
  if (ratio === '6:4') {
    const tomo = Math.round(amount * 0.6);
    return { tomoakiAmount: tomo, yasukoAmount: amount - tomo };
  }
  if (ratio === '1:2') {
    const tomo = Math.round(amount * (1.0 / 3.0));
    return { tomoakiAmount: tomo, yasukoAmount: amount - tomo };
  }

  // "7:3" などの汎用解析
  const match = ratio.match(/^(\d+):(\d+)$/);
  if (match) {
    const a = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    if (a + b > 0) {
      const tomo = Math.round(amount * (a / (a + b)));
      return { tomoakiAmount: tomo, yasukoAmount: amount - tomo };
    }
  }

  // デフォルト 6:4
  const tomo = Math.round(amount * 0.6);
  return { tomoakiAmount: tomo, yasukoAmount: amount - tomo };
}

/**
 * 1件の支出に対する「精算調整額」を算出（ExcelのJ列・K列の計算式に準拠）
 * - 家族カード口座は「ことら入金（智明60%:康子40%）」で既に6:4の共有資金になっている前提
 *   - 智明全額の買い物 ➔ 智明が40%（康子資金分）を精算 (+0.4)
 *   - 康子全額の買い物 ➔ 康子が60%（智明資金分）を精算 (-0.6)
 *   - 5:5の買い物 ➔ 康子が10%を精算 (-0.1)
 *   - 6:4の共通買い物 ➔ 精算0円（調整不要）
 * @returns tomoakiAdj: プラスなら「智明 ➔ 康子」、マイナスなら「康子 ➔ 智明」
 */
export function calculateItemAdjustment(exp: Pick<Expense, 'amount' | 'payer' | 'tomoaki_amount' | 'yasuko_amount'>): {
  tomoakiAdj: number;
  yasukoAdj: number;
} {
  if (exp.payer === '家族カード') {
    const familyCardTomoakiFunded = Math.round(exp.amount * 0.6);
    const tomoakiAdj = exp.tomoaki_amount - familyCardTomoakiFunded;
    return {
      tomoakiAdj,
      yasukoAdj: -tomoakiAdj,
    };
  } else if (exp.payer === '智明') {
    // 智明が個人の財布から全額立替 -> 康子負担分を康子が支払う
    return {
      tomoakiAdj: -exp.yasuko_amount,
      yasukoAdj: exp.yasuko_amount,
    };
  } else {
    // 康子が個人の財布から全額立替 -> 智明負担分を智明が支払う
    return {
      tomoakiAdj: exp.tomoaki_amount,
      yasukoAdj: -exp.tomoaki_amount,
    };
  }
}

/**
 * 未精算の支出リストからネット要精算額を算出（ExcelのJ列・K列方式に準拠）
 */
export function calculateNetSettlement(
  unsettledExpenses: Expense[],
  _familyCardPayer = '智明'
): NetSettlement {
  let netTomoakiToYasuko = 0; // プラスなら智明が康子に払う、マイナスなら康子が智明に払う
  let totalExpenses = 0;
  let tomoakiTotalShare = 0;
  let yasukoTotalShare = 0;

  for (const exp of unsettledExpenses) {
    totalExpenses += exp.amount;
    tomoakiTotalShare += exp.tomoaki_amount;
    yasukoTotalShare += exp.yasuko_amount;

    const { tomoakiAdj } = calculateItemAdjustment(exp);
    netTomoakiToYasuko += tomoakiAdj;
  }

  if (netTomoakiToYasuko < 0) {
    return {
      direction: '康子 ➔ 智明',
      amount: -netTomoakiToYasuko,
      unsettledCount: unsettledExpenses.length,
      totalExpenses,
      tomoakiTotalShare,
      yasukoTotalShare
    };
  } else if (netTomoakiToYasuko > 0) {
    return {
      direction: '智明 ➔ 康子',
      amount: netTomoakiToYasuko,
      unsettledCount: unsettledExpenses.length,
      totalExpenses,
      tomoakiTotalShare,
      yasukoTotalShare
    };
  } else {
    return {
      direction: '精算なし',
      amount: 0,
      unsettledCount: unsettledExpenses.length,
      totalExpenses,
      tomoakiTotalShare,
      yasukoTotalShare
    };
  }
}

