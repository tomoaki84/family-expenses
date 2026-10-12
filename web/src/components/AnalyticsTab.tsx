'use client';

import React, { useState, useMemo } from 'react';
import { Expense } from '../lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Calendar, RotateCcw } from 'lucide-react';

interface AnalyticsTabProps {
  expenses: Expense[];
}

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b', '#06b6d4', '#f97316'];

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ expenses }) => {
  // 選択された月 (null の場合は「全期間」)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // 1. 月別推移データの集計（直近6ヶ月、※「収入/入金」は除外）
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; 智明: number; 康子: number; 合計: number }>();

    expenses.forEach((e) => {
      // 「収入/入金」およびマイナス相殺は生活費推移から除外
      if (e.category === '収入/入金' || e.amount <= 0) return;
      if (e.date && e.date.length >= 7) {
        const m = e.date.slice(0, 7);
        const current = map.get(m) || { month: m, 智明: 0, 康子: 0, 合計: 0 };
        current.智明 += e.tomoaki_amount;
        current.康子 += e.yasuko_amount;
        current.合計 += e.amount;
        map.set(m, current);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // 直近6ヶ月
  }, [expenses]);

  // 月選択ピル用（降順: 新しい月順）
  const availableMonths = useMemo(() => {
    return [...monthlyData].map((d) => d.month).reverse();
  }, [monthlyData]);

  // 2. 選択月（または全期間）にフィルタリングされた支出データ（※「収入/入金」除外）
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.category === '収入/入金') return false;
      if (e.amount <= 0) return false;
      if (selectedMonth && !e.date.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [expenses, selectedMonth]);

  // 3. カテゴリ別内訳データの集計（選択月に連動、※「収入/入金」除外）
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();

    filteredExpenses.forEach((e) => {
      const cat = e.category || 'その他';
      map.set(cat, (map.get(cat) || 0) + e.amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // 4. 実質負担バランスの集計（選択月に連動、※「収入/入金」除外）
  const balance = useMemo(() => {
    let tomoakiTotal = 0;
    let yasukoTotal = 0;
    filteredExpenses.forEach((e) => {
      tomoakiTotal += e.tomoaki_amount;
      yasukoTotal += e.yasuko_amount;
    });
    const total = tomoakiTotal + yasukoTotal;
    const tomoakiPct = total > 0 ? Math.round((tomoakiTotal / total) * 100) : 60;
    const yasukoPct = total > 0 ? 100 - tomoakiPct : 40;
    return { tomoakiTotal, yasukoTotal, total, tomoakiPct, yasukoPct };
  }, [filteredExpenses]);

  // 表示用月ラベル (例: '2026年10月')
  const formattedSelectedMonth = useMemo(() => {
    if (!selectedMonth) return null;
    const parts = selectedMonth.split('-');
    if (parts.length === 2) {
      return `${parts[0]}年${parseInt(parts[1], 10)}月`;
    }
    return selectedMonth;
  }, [selectedMonth]);

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* 月選択クイックフィルターバー */}
      <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-700">分析対象期間:</span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMonth(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedMonth === null
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全期間
          </button>
          {availableMonths.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMonth((prev) => (prev === m ? null : m))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedMonth === m
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 実質負担バランス */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs transition-all">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <span>
              {formattedSelectedMonth
                ? `${formattedSelectedMonth} の実質負担バランス`
                : 'これまでの実質負担バランス (全期間)'}
            </span>
          </h2>
          {selectedMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>全期間に戻す</span>
            </button>
          )}
        </div>

        {balance.total === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {selectedMonth} の支出データはありません
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm font-bold text-slate-800 mb-2">
              <span>智明: {balance.tomoakiPct}% (¥{balance.tomoakiTotal.toLocaleString()})</span>
              <span>康子: {balance.yasukoPct}% (¥{balance.yasukoTotal.toLocaleString()})</span>
            </div>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${balance.tomoakiPct}%` }}
                className="bg-sky-600 transition-all duration-500"
              />
              <div
                style={{ width: `${balance.yasukoPct}%` }}
                className="bg-emerald-500 transition-all duration-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              ※青: 智明 / 緑: 康子（{formattedSelectedMonth ? `${formattedSelectedMonth}の` : ''}支出合計: ¥{balance.total.toLocaleString()} / 収入・入金は除外）
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 月別推移グラフ */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              月別支出推移 (直近6ヶ月)
            </h2>
            <span className="text-[11px] text-slate-400">※棒をクリックで月を選択</span>
          </div>
          <div className="h-64 md:h-72 w-full">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                データがありません
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      const clicked = String(state.activeLabel);
                      setSelectedMonth((prev) => (prev === clicked ? null : clicked));
                    }
                  }}
                  className="cursor-pointer"
                >
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '']}
                    labelStyle={{ fontSize: 12, fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="智明" stackId="a">
                    {monthlyData.map((entry) => {
                      const isSelected = selectedMonth === entry.month;
                      const hasSelection = selectedMonth !== null;
                      return (
                        <Cell
                          key={`tomo-${entry.month}`}
                          fill="#0284c7"
                          opacity={hasSelection ? (isSelected ? 1 : 0.35) : 1}
                        />
                      );
                    })}
                  </Bar>
                  <Bar dataKey="康子" stackId="a" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry) => {
                      const isSelected = selectedMonth === entry.month;
                      const hasSelection = selectedMonth !== null;
                      return (
                        <Cell
                          key={`yasu-${entry.month}`}
                          fill="#10b981"
                          opacity={hasSelection ? (isSelected ? 1 : 0.35) : 1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* カテゴリ別内訳 */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {formattedSelectedMonth
                ? `カテゴリ別支出内訳 (${formattedSelectedMonth})`
                : 'カテゴリ別支出内訳 (全期間)'}
            </h2>
            {selectedMonth && (
              <span className="text-[11px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                {selectedMonth} 絞り込み中
              </span>
            )}
          </div>
          <div className="h-60 md:h-64 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                該当する支出データがありません
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '金額']}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
            {categoryData.slice(0, 6).map((cat, i) => (
              <div key={cat.name} className="flex items-center space-x-1.5 text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate">{cat.name}:</span>
                <strong className="text-slate-800 ml-auto">¥{cat.value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
