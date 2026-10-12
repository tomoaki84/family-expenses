'use client';

import React, { useMemo } from 'react';
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

interface AnalyticsTabProps {
  expenses: Expense[];
}

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b', '#06b6d4', '#f97316'];

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ expenses }) => {
  // 1. 月別推移データの集計（直近6ヶ月〜12ヶ月）
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; 智明: number; 康子: number; 合計: number }>();

    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7 && e.amount > 0) {
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

  // 2. カテゴリ別内訳データの集計（直近当月または全体）
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();

    expenses.forEach((e) => {
      if (e.amount > 0) {
        const cat = e.category || 'その他';
        map.set(cat, (map.get(cat) || 0) + e.amount);
      }
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // 3. 全体の実質負担比率
  const overallBalance = useMemo(() => {
    let tomoakiTotal = 0;
    let yasukoTotal = 0;
    expenses.forEach((e) => {
      if (e.amount > 0) {
        tomoakiTotal += e.tomoaki_amount;
        yasukoTotal += e.yasuko_amount;
      }
    });
    const total = tomoakiTotal + yasukoTotal;
    const tomoakiPct = total > 0 ? Math.round((tomoakiTotal / total) * 100) : 60;
    const yasukoPct = total > 0 ? 100 - tomoakiPct : 40;
    return { tomoakiTotal, yasukoTotal, total, tomoakiPct, yasukoPct };
  }, [expenses]);

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* 全体負担バランス */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          これまでの実質負担バランス
        </h2>
        <div className="flex items-center justify-between text-sm font-bold text-slate-800 mb-2">
          <span>智明: {overallBalance.tomoakiPct}% (¥{overallBalance.tomoakiTotal.toLocaleString()})</span>
          <span>康子: {overallBalance.yasukoPct}% (¥{overallBalance.yasukoTotal.toLocaleString()})</span>
        </div>
        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${overallBalance.tomoakiPct}%` }}
            className="bg-sky-600 transition-all duration-500"
          />
          <div
            style={{ width: `${overallBalance.yasukoPct}%` }}
            className="bg-emerald-500 transition-all duration-500"
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2 text-center">
          ※青: 智明 / 緑: 康子（支出合計: ¥{overallBalance.total.toLocaleString()}）
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 月別推移グラフ */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            月別支出推移 (直近6ヶ月)
          </h2>
          <div className="h-64 md:h-72 w-full">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                データがありません
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '']}
                    labelStyle={{ fontSize: 12, fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="智明" fill="#0284c7" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="康子" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* カテゴリ別内訳 */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            カテゴリ別支出内訳
          </h2>
          <div className="h-60 md:h-64 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                データがありません
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
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate">{cat.name}:</span>
                <strong className="text-slate-800">¥{cat.value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
