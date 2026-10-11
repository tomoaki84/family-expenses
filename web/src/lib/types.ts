export type Payer = '智明' | '康子' | '家族カード';

export type SplitRatio = '6:4' | '5:5' | '1:2' | '智明全額' | '康子全額' | '実額指定' | string;

export type SettlementStatus = '未精算' | '精算済';

export type EntryType = 'expense' | 'income_offset' | 'kotora_charge' | 'kotora_settle';

export interface Expense {
  id: string;
  date: string;
  title: string;
  amount: number;
  payer: Payer;
  split_ratio: SplitRatio;
  tomoaki_amount: number;
  yasuko_amount: number;
  settlement_status: SettlementStatus;
  settlement_id?: string | null;
  category: string;
  memo?: string | null;
  entry_type: EntryType;
  registered_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export interface SettlementHistoryItem {
  id: string;
  settled_at: string;
  direction: string;
  settlement_amount: number;
  expense_count: number;
  memo?: string | null;
}

export interface NetSettlement {
  direction: '康子 ➔ 智明' | '智明 ➔ 康子' | '精算なし';
  amount: number;
  unsettledCount: number;
  totalExpenses: number;
  tomoakiTotalShare: number;
  yasukoTotalShare: number;
}
