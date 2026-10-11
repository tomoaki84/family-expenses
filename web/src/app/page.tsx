'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Expense, AppSetting, NetSettlement } from '../lib/types';
import { calculateNetSettlement } from '../lib/calculator';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Header } from '../components/Header';
import { DashboardTab } from '../components/DashboardTab';
import { ExpenseListTab } from '../components/ExpenseListTab';
import { AnalyticsTab } from '../components/AnalyticsTab';
import { SettingsTab } from '../components/SettingsTab';
import { ExpenseEditModal } from '../components/ExpenseEditModal';

// 初期フォールバック用のダミーデータ（Supabase未接続時用）
const INITIAL_MOCK_EXPENSES: Expense[] = [
  {
    id: 'mock-1',
    date: '2025-08-02',
    title: 'スギ薬局',
    amount: 3960,
    payer: '家族カード',
    split_ratio: '6:4',
    tomoaki_amount: 2376,
    yasuko_amount: 1584,
    settlement_status: '未精算',
    category: '日用品',
    entry_type: 'expense',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    date: '2025-08-12',
    title: 'ワイシャツ',
    amount: 16676,
    payer: '家族カード',
    split_ratio: '智明全額',
    tomoaki_amount: 16676,
    yasuko_amount: 0,
    settlement_status: '未精算',
    category: '家具/衣服',
    entry_type: 'expense',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    date: '2025-10-25',
    title: 'ゆずチケット代',
    amount: 23320,
    payer: '康子',
    split_ratio: '6:4',
    tomoaki_amount: 13992,
    yasuko_amount: 9328,
    settlement_status: '未精算',
    category: '交通/旅行',
    entry_type: 'expense',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function MainContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'settings'>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({
    default_split_ratio: '6:4',
    default_payer: '智明',
    family_card_payer: '智明',
  });
  const [loading, setLoading] = useState(true);

  // 編集モーダル状態
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // URLパラメータ（?tab=settings など）の反映
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['dashboard', 'list', 'analytics', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const editId = searchParams.get('edit');
    if (editId && expenses.length > 0) {
      const target = expenses.find((e) => e.id === editId);
      if (target) {
        setEditingExpense(target);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, expenses]);

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      // Supabase設定がない場合はモックデータを読み込む
      setExpenses(INITIAL_MOCK_EXPENSES);
      setLoading(false);
      return;
    }

    try {
      // 支出一覧取得
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (expError) throw expError;
      if (expData) setExpenses(expData as Expense[]);

      // 設定取得
      const { data: setData, error: setError } = await supabase
        .from('app_settings')
        .select('*');

      if (setError) throw setError;
      if (setData) {
        const map: Record<string, string> = {};
        setData.forEach((s: AppSetting) => {
          map[s.key] = s.value;
        });
        setSettings(map);
      }
    } catch (err) {
      console.error('Failed to fetch from Supabase:', err);
      // エラー時はフォールバック
      setExpenses(INITIAL_MOCK_EXPENSES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 要精算額の計算
  const unsettledList = expenses.filter((e) => e.settlement_status === '未精算');
  const familyCardPayer = settings['family_card_payer'] || '智明';
  const settlement: NetSettlement = calculateNetSettlement(unsettledList, familyCardPayer);

  // 一括精算処理
  const handleSettleAll = async () => {
    if (!isSupabaseConfigured()) {
      setExpenses((prev) =>
        prev.map((e) => (e.settlement_status === '未精算' ? { ...e, settlement_status: '精算済' } : e))
      );
      return;
    }

    try {
      const ids = unsettledList.map((e) => e.id);
      if (ids.length === 0) return;

      // 履歴テーブルに記録
      await supabase.from('settlement_history').insert({
        direction: settlement.direction,
        settlement_amount: settlement.amount,
        expense_count: ids.length,
      });

      // 支出を一括更新
      const { error } = await supabase
        .from('expenses')
        .update({ settlement_status: '精算済' })
        .in('id', ids);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Settle failed:', err);
      throw err;
    }
  };

  // 支出の保存（新規または更新）
  const handleSaveExpense = async (exp: Partial<Expense>) => {
    if (!isSupabaseConfigured()) {
      if (exp.id) {
        setExpenses((prev) => prev.map((e) => (e.id === exp.id ? ({ ...e, ...exp } as Expense) : e)));
      } else {
        const newExp: Expense = {
          ...(exp as any),
          id: `local-${Date.now()}`,
          settlement_status: '未精算',
          entry_type: 'expense',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setExpenses((prev) => [newExp, ...prev]);
      }
      return;
    }

    try {
      if (exp.id) {
        const { error } = await supabase
          .from('expenses')
          .update(exp)
          .eq('id', exp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert(exp);
        if (error) throw error;
      }
      await fetchData();
    } catch (err) {
      console.error('Save expense failed:', err);
      throw err;
    }
  };

  // 支出の削除
  const handleDeleteExpense = async (id: string) => {
    if (!isSupabaseConfigured()) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      return;
    }

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Delete expense failed:', err);
      throw err;
    }
  };

  // 設定の保存
  const handleSaveSetting = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      console.error('Save setting failed:', err);
      throw err;
    }
  };

  return (
    <>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">
            データを読み込み中...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                expenses={expenses}
                settlement={settlement}
                onSettleAll={handleSettleAll}
                onEditExpense={(exp) => {
                  setEditingExpense(exp);
                  setIsModalOpen(true);
                }}
                onAddNewExpense={() => {
                  setEditingExpense(null);
                  setIsModalOpen(true);
                }}
              />
            )}

            {activeTab === 'list' && (
              <ExpenseListTab
                expenses={expenses}
                onEditExpense={(exp) => {
                  setEditingExpense(exp);
                  setIsModalOpen(true);
                }}
                onAddNewExpense={() => {
                  setEditingExpense(null);
                  setIsModalOpen(true);
                }}
              />
            )}

            {activeTab === 'analytics' && <AnalyticsTab expenses={expenses} />}

            {activeTab === 'settings' && (
              <SettingsTab settings={settings} onSaveSetting={handleSaveSetting} />
            )}
          </>
        )}
      </main>

      {/* 編集・新規モーダル */}
      <ExpenseEditModal
        isOpen={isModalOpen}
        expense={editingExpense}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        onDelete={handleDeleteExpense}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-slate-400">Loading...</div>}>
      <MainContent />
    </Suspense>
  );
}
