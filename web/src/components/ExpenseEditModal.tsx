'use client';

import React, { useState, useEffect } from 'react';
import { Expense, Payer, SplitRatio } from '../lib/types';
import { calculateSplit, calculateItemAdjustment } from '../lib/calculator';
import { X, Trash2, Check } from 'lucide-react';

interface ExpenseEditModalProps {
  expense: Partial<Expense> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<Expense>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const CATEGORIES = ['食費', '日用品', '家電', '医療費', '子供/教育', '光熱費/固定費', '家具/衣服', '交通/旅行', '収入/入金', 'その他'];
const RATIOS: { label: string; value: SplitRatio }[] = [
  { label: '6:4 (智明6:康子4)', value: '6:4' },
  { label: '5:5 (折半)', value: '5:5' },
  { label: '1:2 (智明1:康子2)', value: '1:2' },
  { label: '智明全額', value: '智明全額' },
  { label: '康子全額', value: '康子全額' },
];

export const ExpenseEditModal: React.FC<ExpenseEditModalProps> = ({
  expense,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState('');
  const [payer, setPayer] = useState<Payer>('家族カード');
  const [splitRatio, setSplitRatio] = useState<SplitRatio>('6:4');
  const [category, setCategory] = useState('その他');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || '');
      setAmount(expense.amount || 0);
      setDate(expense.date || new Date().toISOString().split('T')[0]);
      setPayer(expense.payer || '家族カード');
      setSplitRatio(expense.split_ratio || '6:4');
      setCategory(expense.category || 'その他');
      setMemo(expense.memo || '');
    }
  }, [expense]);

  if (!isOpen) return null;

  const shares = calculateSplit(amount, splitRatio);
  const { tomoakiAdj } = calculateItemAdjustment({
    amount,
    payer,
    tomoaki_amount: shares.tomoakiAmount,
    yasuko_amount: shares.yasukoAmount,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('支出内容を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...expense,
        title: title.trim(),
        amount: Number(amount),
        date,
        payer,
        split_ratio: splitRatio,
        tomoaki_amount: shares.tomoakiAmount,
        yasuko_amount: shares.yasukoAmount,
        category,
        memo: memo.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense?.id || !onDelete) return;
    if (window.confirm(`「${title}」を削除してもよろしいですか？`)) {
      setIsSaving(true);
      try {
        await onDelete(expense.id);
        onClose();
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-slate-800">
            {expense?.id ? '支出の編集' : '支出の新規登録'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 日付 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          {/* 支出内容 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">支出内容・店名</label>
            <input
              type="text"
              placeholder="例: スーパー、スギ薬局"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">金額 (円)</label>
            <input
              type="number"
              placeholder="0"
              value={amount === 0 ? '' : amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">※お祝い金・給付金などの受領相殺はマイナス数値で入力</p>
          </div>

          {/* 支払者 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">支払い元</label>
            <div className="grid grid-cols-3 gap-2">
              {(['家族カード', '智明', '康子'] as Payer[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPayer(p)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    payer === p
                      ? 'bg-sky-50 border-sky-600 text-sky-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 負担割合 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">負担割合</label>
            <select
              value={splitRatio}
              onChange={(e) => setSplitRatio(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {RATIOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* 負担・精算プレビュー */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500">負担額・精算調整の計算結果:</div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-700">智明負担: <strong className="text-slate-900">¥{shares.tomoakiAmount.toLocaleString()}</strong></span>
              <span className="text-slate-700">康子負担: <strong className="text-slate-900">¥{shares.yasukoAmount.toLocaleString()}</strong></span>
            </div>
            <div className="pt-1.5 border-t border-slate-200/80 flex justify-between items-center text-xs">
              <span className="text-slate-500">精算調整 (Excel式):</span>
              {tomoakiAdj > 0 ? (
                <span className="font-bold text-sky-700">智明が払う: ¥{tomoakiAdj.toLocaleString()}</span>
              ) : tomoakiAdj < 0 ? (
                <span className="font-bold text-pink-700">康子が払う: ¥{(-tomoakiAdj).toLocaleString()}</span>
              ) : (
                <span className="font-semibold text-slate-500">精算なし (¥0 / 口座6:4一致)</span>
              )}
            </div>
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">メモ (任意)</label>
            <input
              type="text"
              placeholder="クーポン利用や用途など"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* アクションボタン */}
          <div className="pt-2 flex items-center space-x-3">
            {expense?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="p-2.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                title="削除"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-1 shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '保存中...' : '保存する'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
