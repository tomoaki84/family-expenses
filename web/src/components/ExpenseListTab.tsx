'use client';

import React, { useState, useMemo } from 'react';
import { Expense, Payer } from '../lib/types';
import { Search, Filter, Plus, Calendar, Tag } from 'lucide-react';

interface ExpenseListTabProps {
  expenses: Expense[];
  onEditExpense: (expense: Expense) => void;
  onAddNewExpense: () => void;
}

export const ExpenseListTab: React.FC<ExpenseListTabProps> = ({
  expenses,
  onEditExpense,
  onAddNewExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '未精算' | '精算済'>('all');
  const [payerFilter, setPayerFilter] = useState<'all' | Payer>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // ユニークな年月リストの抽出
  const monthList = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [expenses]);

  // フィルタリング処理
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.settlement_status !== statusFilter) {
        return false;
      }
      if (payerFilter !== 'all' && e.payer !== payerFilter) {
        return false;
      }
      if (selectedMonth !== 'all' && !e.date.startsWith(selectedMonth)) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(term);
        const matchesMemo = e.memo?.toLowerCase().includes(term);
        const matchesCat = e.category?.toLowerCase().includes(term);
        if (!matchesTitle && !matchesMemo && !matchesCat) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, statusFilter, payerFilter, selectedMonth, searchTerm]);

  return (
    <div className="space-y-4 pb-20">
      {/* 検索・絞り込みコントロール */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        {/* 検索バー */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="店名、品目、メモで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* フィルターボタングループ */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* 精算ステータス */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            {(['all', '未精算', '精算済'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? '全ステータス' : st}
              </button>
            ))}
          </div>

          {/* 支払者フィルター */}
          <select
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value as any)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="all">支払者: すべて</option>
            <option value="家族カード">家族カード</option>
            <option value="智明">智明</option>
            <option value="康子">康子</option>
          </select>

          {/* 年月フィルター */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="all">期間: 全期間</option>
            {monthList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 件数 & 新規追加 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500 font-medium">
          検索結果: <strong>{filtered.length}</strong> 件
        </span>
        <button
          onClick={onAddNewExpense}
          className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>支出を追加</span>
        </button>
      </div>

      {/* 支出リスト一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            該当する支出データがありません
          </div>
        ) : (
          filtered.map((exp) => {
            const isUnsettled = exp.settlement_status === '未精算';
            return (
              <div
                key={exp.id}
                onClick={() => onEditExpense(exp)}
                className="p-3.5 hover:bg-slate-50/80 active:bg-slate-100 cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">{exp.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        isUnsettled
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {exp.settlement_status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <span className="flex items-center space-x-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{exp.date}</span>
                    </span>
                    <span>·</span>
                    <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700 font-medium">
                      {exp.payer}
                    </span>
                    <span>·</span>
                    <span className="text-slate-600">{exp.split_ratio}</span>
                    {exp.category && (
                      <>
                        <span>·</span>
                        <span className="text-slate-400">{exp.category}</span>
                      </>
                    )}
                  </div>

                  {exp.memo && (
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      💬 {exp.memo}
                    </div>
                  )}
                </div>

                <div className="text-right pl-3">
                  <div
                    className={`font-black text-base ${
                      exp.amount < 0 ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    ¥{exp.amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    智: ¥{exp.tomoaki_amount.toLocaleString()}
                    <br />
                    康: ¥{exp.yasuko_amount.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
