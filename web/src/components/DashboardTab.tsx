'use client';

import React, { useState } from 'react';
import { Expense, NetSettlement } from '../lib/types';
import { ArrowRight, CheckCircle2, Plus, Receipt, Sparkles, Trash2, Edit3 } from 'lucide-react';

interface DashboardTabProps {
  expenses: Expense[];
  settlement: NetSettlement;
  onSettleAll: () => Promise<void>;
  onEditExpense: (expense: Expense) => void;
  onAddNewExpense: () => void;
  onDeleteExpense?: (id: string) => Promise<void>;
  onNavigateToList?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  expenses,
  settlement,
  onSettleAll,
  onEditExpense,
  onAddNewExpense,
  onDeleteExpense,
  onNavigateToList,
}) => {
  const [isSettling, setIsSettling] = useState(false);

  // 今月の支出集計
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonthTomoaki = thisMonthExpenses.reduce((sum, e) => sum + e.tomoaki_amount, 0);
  const thisMonthYasuko = thisMonthExpenses.reduce((sum, e) => sum + e.yasuko_amount, 0);

  // 未精算の直近支出（最大10件）
  const unsettledList = expenses
    .filter((e) => e.settlement_status === '未精算')
    .slice(0, 10);

  const handleSettleClick = async () => {
    if (settlement.amount === 0) {
      alert('現在、未精算の支出はありません。');
      return;
    }
    const confirmMessage = `未精算の支出（${settlement.unsettledCount}件、要精算額 ¥${settlement.amount.toLocaleString()}）を一括で「精算済」にしますか？\n\n※精算完了後は要精算額が 0 円になります。`;
    if (window.confirm(confirmMessage)) {
      setIsSettling(true);
      try {
        await onSettleAll();
        alert('精算を完了しました！');
      } catch (err) {
        console.error(err);
        alert('精算処理に失敗しました');
      } finally {
        setIsSettling(false);
      }
    }
  };

  const handleDirectDelete = async (e: React.MouseEvent, exp: Expense) => {
    e.stopPropagation();
    if (!onDeleteExpense) return;
    if (window.confirm(`「${exp.title} (¥${exp.amount.toLocaleString()})」を削除しますか？`)) {
      try {
        await onDeleteExpense(exp.id);
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました');
      }
    }
  };

  return (
    <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-12 md:gap-6 pb-20 md:pb-8 items-start">
      {/* 左カラム（PC時 5/12）：要精算カード & 今月のサマリー */}
      <div className="space-y-5 md:col-span-5">
        {/* 1. 要精算額 ハイライトカード */}
        <div className="bg-linear-to-br from-sky-600 to-indigo-700 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wide text-sky-100 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>現在の要精算状況</span>
            </span>
            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
              未精算 {settlement.unsettledCount} 件
            </span>
          </div>

          {settlement.amount > 0 ? (
            <div>
              <div className="text-xs text-sky-100 mb-1">振込・送金方向:</div>
              <div className="text-xl font-bold tracking-tight mb-1 text-amber-200 flex items-center space-x-2">
                <span>{settlement.direction}</span>
              </div>
              <div className="text-3xl font-extrabold tracking-tight mt-1">
                ¥{settlement.amount.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="py-2">
              <div className="text-2xl font-bold text-sky-100">貸し借りなし</div>
              <p className="text-xs text-sky-200 mt-1">すべての精算が完了しています ✨</p>
            </div>
          )}

          {settlement.amount > 0 && (
            <button
              onClick={handleSettleClick}
              disabled={isSettling}
              className="mt-4 w-full bg-white text-sky-700 hover:bg-sky-50 active:scale-[0.99] font-bold text-sm py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{isSettling ? '処理中...' : '精算済みにする（一括完了）'}</span>
            </button>
          )}
        </div>

        {/* 2. 今月の支出サマリーカード */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              今月の支出状況 ({currentMonth})
            </h2>
            <span className="text-xs text-slate-400">{thisMonthExpenses.length} 件</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-3">
            ¥{thisMonthTotal.toLocaleString()}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg">
              <span className="text-slate-500 block text-[11px]">智明 負担実額</span>
              <span className="font-bold text-slate-800 text-sm">
                ¥{thisMonthTomoaki.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg">
              <span className="text-slate-500 block text-[11px]">康子 負担実額</span>
              <span className="font-bold text-slate-800 text-sm">
                ¥{thisMonthYasuko.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 右カラム（PC時 7/12）：直近の未精算支出 */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs md:col-span-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            <span>未精算の明細 ({settlement.unsettledCount}件)</span>
          </h2>
          <div className="flex items-center space-x-3">
            {onNavigateToList && (
              <button
                onClick={onNavigateToList}
                className="hidden sm:inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-sky-600 cursor-pointer"
              >
                <span>一覧・連続登録へ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onAddNewExpense}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center space-x-0.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>手動追加</span>
            </button>
          </div>
        </div>

        {unsettledList.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            未精算の支出はありません
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {unsettledList.map((exp) => (
              <div
                key={exp.id}
                onClick={() => onEditExpense(exp)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors group"
              >
                <div>
                  <div className="font-medium text-slate-900 text-sm flex items-center space-x-1.5">
                    <span>{exp.title}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                      {exp.payer}
                    </span>
                    {exp.category && (
                      <span className="hidden sm:inline text-[10px] text-slate-400">
                        · {exp.category}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {exp.date} · 割合 {exp.split_ratio}
                    {exp.memo && <span className="ml-2 text-slate-400">💬 {exp.memo}</span>}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">
                      ¥{exp.amount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      智: ¥{exp.tomoaki_amount.toLocaleString()} / 康: ¥{exp.yasuko_amount.toLocaleString()}
                    </div>
                  </div>
                  {onDeleteExpense && (
                    <div className="hidden md:flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditExpense(exp);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 cursor-pointer"
                        title="編集"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDirectDelete(e, exp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
