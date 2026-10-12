'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Expense, Payer, SplitRatio, SettlementStatus } from '../lib/types';
import { calculateSplit, calculateItemAdjustment } from '../lib/calculator';
import {
  Search,
  Plus,
  Calendar,
  Trash2,
  Edit3,
  CheckSquare,
  Square,
  ArrowUpDown,
  Zap,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExpenseListTabProps {
  expenses: Expense[];
  defaultSplitRatio?: string;
  onEditExpense: (expense: Expense) => void;
  onAddNewExpense: () => void;
  onQuickSaveExpense?: (expense: Partial<Expense>) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onBulkDeleteExpenses?: (ids: string[]) => Promise<void>;
  onBulkUpdateStatus?: (ids: string[], status: SettlementStatus) => Promise<void>;
}

const CATEGORIES = ['食費', '日用品', '家電', '医療費', '子供/教育', '光熱費/固定費', '家具/衣服', '交通/旅行', '収入/入金', 'その他'];
const RATIOS: { label: string; value: SplitRatio }[] = [
  { label: '6:4 (智6:康4)', value: '6:4' },
  { label: '5:5 (折半)', value: '5:5' },
  { label: '1:2 (智1:康2)', value: '1:2' },
  { label: '智明全額', value: '智明全額' },
  { label: '康子全額', value: '康子全額' },
];

export const ExpenseListTab: React.FC<ExpenseListTabProps> = ({
  expenses,
  defaultSplitRatio = '6:4',
  onEditExpense,
  onAddNewExpense,
  onQuickSaveExpense = async () => {},
  onDeleteExpense = async () => {},
  onBulkDeleteExpenses = async () => {},
  onBulkUpdateStatus = async () => {},
}) => {
  // 検索・フィルタ状態
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '未精算' | '精算済'>('all');
  const [payerFilter, setPayerFilter] = useState<'all' | Payer>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // 複数選択状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // PC用クイック連続登録フォームの状態
  const [showQuickAdd, setShowQuickAdd] = useState(true);
  const [qDate, setQDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [qTitle, setQTitle] = useState('');
  const [qAmount, setQAmount] = useState<string>('');
  const [qPayer, setQPayer] = useState<Payer>('家族カード');
  const [qRatio, setQRatio] = useState<SplitRatio>(defaultSplitRatio || '6:4');
  const [qCategory, setQCategory] = useState('食費');
  const [qMemo, setQMemo] = useState('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  // フィルタリング＆ソート処理
  const filtered = useMemo(() => {
    const list = expenses.filter((e) => {
      if (statusFilter !== 'all' && e.settlement_status !== statusFilter) {
        return false;
      }
      if (payerFilter !== 'all' && e.payer !== payerFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
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

    return list.sort((a, b) => {
      if (sortField === 'date') {
        const cmp = a.date.localeCompare(b.date);
        return sortAsc ? cmp : -cmp;
      } else {
        const cmp = a.amount - b.amount;
        return sortAsc ? cmp : -cmp;
      }
    });
  }, [expenses, statusFilter, payerFilter, categoryFilter, selectedMonth, searchTerm, sortField, sortAsc]);

  // フィルタ結果の集計
  const filteredSummary = useMemo(() => {
    let totalAmount = 0;
    let totalTomoaki = 0;
    let totalYasuko = 0;
    let netTomoakiAdj = 0;
    filtered.forEach((e) => {
      totalAmount += e.amount;
      totalTomoaki += e.tomoaki_amount;
      totalYasuko += e.yasuko_amount;
      const { tomoakiAdj } = calculateItemAdjustment(e);
      netTomoakiAdj += tomoakiAdj;
    });
    return { totalAmount, totalTomoaki, totalYasuko, netTomoakiAdj };
  }, [filtered]);

  // クイック登録時のリアルタイム試算
  const numericQAmount = Number(qAmount) || 0;
  const qShares = calculateSplit(numericQAmount, qRatio);

  // クイック連続登録の送信
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qTitle.trim() || !qAmount || numericQAmount === 0) {
      alert('店名・品目と金額を入力してください');
      return;
    }

    setIsQuickSaving(true);
    try {
      await onQuickSaveExpense({
        date: qDate,
        title: qTitle.trim(),
        amount: numericQAmount,
        payer: qPayer,
        split_ratio: qRatio,
        tomoaki_amount: qShares.tomoakiAmount,
        yasuko_amount: qShares.yasukoAmount,
        category: qCategory,
        memo: qMemo.trim() || null,
      });
      // 連続入力しやすいよう、日付・支払者・割合・カテゴリは維持し、品目・金額・メモだけクリアしてフォーカスを戻す
      setQTitle('');
      setQAmount('');
      setQMemo('');
      titleInputRef.current?.focus();
    } catch (err) {
      console.error(err);
      alert('登録に失敗しました');
    } finally {
      setIsQuickSaving(false);
    }
  };

  // 単一削除ハンドラ
  const handleDirectDelete = async (e: React.MouseEvent, exp: Expense) => {
    e.stopPropagation();
    if (window.confirm(`「${exp.title} (¥${exp.amount.toLocaleString()})」を削除しますか？`)) {
      try {
        await onDeleteExpense(exp.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(exp.id);
          return next;
        });
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました');
      }
    }
  };

  // ステータストグルハンドラ
  const handleToggleSingleStatus = async (e: React.MouseEvent, exp: Expense) => {
    e.stopPropagation();
    const nextStatus: SettlementStatus = exp.settlement_status === '未精算' ? '精算済' : '未精算';
    try {
      await onBulkUpdateStatus([exp.id], nextStatus);
    } catch (err) {
      console.error(err);
      alert('ステータスの更新に失敗しました');
    }
  };

  // チェックボックス選択制御
  const toggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((exp) => selectedIds.has(exp.id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((exp) => next.delete(exp.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((exp) => next.add(exp.id));
        return next;
      });
    }
  };

  // 一括削除
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`選択中の ${ids.length} 件の支出データを一括削除してもよろしいですか？`)) {
      return;
    }
    setIsBulkProcessing(true);
    try {
      await onBulkDeleteExpenses(ids);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      alert('一括削除に失敗しました');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // 一括ステータス変更
  const handleBulkStatus = async (status: SettlementStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await onBulkUpdateStatus(ids, status);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      alert('一括更新に失敗しました');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleSortClick = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* 1. PC向け クイック連続登録バー（キーボードでサクサク連続登録） */}
      <div className="bg-white rounded-2xl border border-sky-200 shadow-2xs overflow-hidden">
        <div
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="bg-sky-50/70 px-4 py-2.5 border-b border-sky-100 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold text-slate-800">
              クイック連続登録（Enterキーで即追加）
            </span>
            <span className="hidden md:inline text-[11px] text-slate-500">
              ※日付・支払元・割合を維持したまま連続入力できます
            </span>
          </div>
          <button
            type="button"
            className="text-xs text-sky-700 font-semibold flex items-center space-x-1 hover:underline"
          >
            <span>{showQuickAdd ? '閉じる' : '開く'}</span>
            {showQuickAdd ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showQuickAdd && (
          <form onSubmit={handleQuickAddSubmit} className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-2.5 items-end">
              {/* 日付 */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">日付</label>
                <input
                  type="date"
                  value={qDate}
                  onChange={(e) => setQDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              {/* 店名・内容 */}
              <div className="col-span-1 md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  支出内容・店名 <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="例: スギ薬局、スーパー"
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              {/* 金額 */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  金額 (円) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="3960"
                  value={qAmount}
                  onChange={(e) => setQAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              {/* 支払い元 */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">支払い元</label>
                <select
                  value={qPayer}
                  onChange={(e) => setQPayer(e.target.value as Payer)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="家族カード">家族カード</option>
                  <option value="智明">智明</option>
                  <option value="康子">康子</option>
                </select>
              </div>

              {/* 負担割合 */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">負担割合</label>
                <select
                  value={qRatio}
                  onChange={(e) => setQRatio(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {RATIOS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* カテゴリ */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">分類</label>
                <select
                  value={qCategory}
                  onChange={(e) => setQCategory(e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 下段：メモ + リアルタイム計算プレビュー + 追加ボタン */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1">
              <div className="flex-1 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="メモ（任意：クーポン利用、用途など）"
                  value={qMemo}
                  onChange={(e) => setQMemo(e.target.value)}
                  className="w-full md:max-w-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
                {numericQAmount !== 0 && (
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    負担内訳: 智 <strong className="text-slate-800">¥{qShares.tomoakiAmount.toLocaleString()}</strong> / 康{' '}
                    <strong className="text-slate-800">¥{qShares.yasukoAmount.toLocaleString()}</strong>
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isQuickSaving}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2 px-5 rounded-lg flex items-center justify-center space-x-1.5 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isQuickSaving ? '登録中...' : '追加する (Enter)'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. 検索・絞り込みコントロール */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* 検索バー */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="店名、品目、カテゴリ、メモで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* フィルターボタングループ */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 精算ステータス */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              {(['all', '未精算', '精算済'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
            >
              <option value="all">支払者: すべて</option>
              <option value="家族カード">家族カード</option>
              <option value="智明">智明</option>
              <option value="康子">康子</option>
            </select>

            {/* カテゴリフィルター */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
            >
              <option value="all">カテゴリ: すべて</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* 年月フィルター */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
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
      </div>

      {/* 3. 一括操作バー（チェックボックス選択時に表示） または 件数表示 */}
      {selectedIds.size > 0 ? (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-bold text-sky-300">{selectedIds.size} 件を選択中</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-300 hover:text-white underline text-[11px] cursor-pointer"
            >
              選択解除
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleBulkStatus('精算済')}
              disabled={isBulkProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>一括で「精算済」にする</span>
            </button>
            <button
              onClick={() => handleBulkStatus('未精算')}
              disabled={isBulkProcessing}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>「未精算」に戻す</span>
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkProcessing}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>一括削除 ({selectedIds.size}件)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-4 text-xs text-slate-500 font-medium">
            <span>
              表示件数: <strong className="text-slate-800">{filtered.length}</strong> 件
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline">
              表示合計: <strong className="text-slate-800">¥{filteredSummary.totalAmount.toLocaleString()}</strong>
            </span>
          </div>
          <button
            onClick={onAddNewExpense}
            className="bg-white hover:bg-slate-50 text-sky-700 border border-sky-200 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>詳細モーダルで追加</span>
          </button>
        </div>
      )}

      {/* 4A. PC向け ワイドテーブル表示 (md以上で表示) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            該当する支出データがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-4 pr-2 w-9">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="text-slate-400 hover:text-slate-700 flex items-center cursor-pointer"
                      title="すべて選択/解除"
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3 w-28">
                    <button
                      type="button"
                      onClick={() => handleSortClick('date')}
                      className="flex items-center space-x-1 hover:text-slate-800 cursor-pointer"
                    >
                      <span>日付</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">支出内容・メモ</th>
                  <th className="py-3 px-3 w-28">カテゴリ</th>
                  <th className="py-3 px-3 w-28">支払い元</th>
                  <th className="py-3 px-3 w-20 text-center">割合</th>
                  <th className="py-3 px-3 w-28 text-right">
                    <button
                      type="button"
                      onClick={() => handleSortClick('amount')}
                      className="inline-flex items-center space-x-1 hover:text-slate-800 cursor-pointer ml-auto"
                    >
                      <span>金額</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 w-36 text-right">負担額 (智 / 康)</th>
                  <th className="py-3 px-3 w-32 text-right">精算調整</th>
                  <th className="py-3 px-3 w-24 text-center">状態</th>
                  <th className="py-3 pl-2 pr-4 w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((exp) => {
                  const isUnsettled = exp.settlement_status === '未精算';
                  const isSelected = selectedIds.has(exp.id);
                  const { tomoakiAdj } = calculateItemAdjustment(exp);

                  return (
                    <tr
                      key={exp.id}
                      onClick={() => onEditExpense(exp)}
                      className={`group transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-50/70 hover:bg-sky-50' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* チェックボックス */}
                      <td
                        className="py-3 pl-4 pr-2"
                        onClick={(e) => toggleSelectOne(exp.id, e)}
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-700 flex items-center cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* 日付 */}
                      <td className="py-3 px-3 font-medium text-slate-600 whitespace-nowrap">
                        {exp.date}
                      </td>

                      {/* 支出内容・メモ */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm">{exp.title}</div>
                        {exp.memo && (
                          <div className="text-[11px] text-slate-400 mt-0.5">💬 {exp.memo}</div>
                        )}
                      </td>

                      {/* カテゴリ */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            exp.category === '収入/入金'
                              ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {exp.category || 'その他'}
                        </span>
                      </td>

                      {/* 支払者 */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            exp.payer === '家族カード'
                              ? 'bg-indigo-50 text-indigo-700'
                              : exp.payer === '智明'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-pink-50 text-pink-700'
                          }`}
                        >
                          {exp.payer}
                        </span>
                      </td>

                      {/* 割合 */}
                      <td className="py-3 px-3 text-center font-medium text-slate-600 whitespace-nowrap">
                        {exp.split_ratio}
                      </td>

                      {/* 金額 */}
                      <td
                        className={`py-3 px-3 text-right font-black text-sm whitespace-nowrap ${
                          exp.amount < 0 ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        ¥{exp.amount.toLocaleString()}
                      </td>

                      {/* 負担内訳 */}
                      <td className="py-3 px-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        <div>智: ¥{exp.tomoaki_amount.toLocaleString()}</div>
                        <div>康: ¥{exp.yasuko_amount.toLocaleString()}</div>
                      </td>

                      {/* 精算調整 */}
                      <td className="py-3 px-3 text-right text-[11px] whitespace-nowrap">
                        {tomoakiAdj > 0 ? (
                          <span className="font-semibold text-sky-700">
                            智➔康 ¥{tomoakiAdj.toLocaleString()}
                          </span>
                        ) : tomoakiAdj < 0 ? (
                          <span className="font-semibold text-pink-700">
                            康➔智 ¥{(-tomoakiAdj).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">±¥0</span>
                        )}
                      </td>

                      {/* ステータス（クリックで直接切替可能） */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleToggleSingleStatus(e, exp)}
                          title="クリックで「未精算 ⇄ 精算済」を切り替え"
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer border ${
                            isUnsettled
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {exp.settlement_status}
                        </button>
                      </td>

                      {/* 操作ボタン（編集・直接削除） */}
                      <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditExpense(exp);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="編集"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDirectDelete(e, exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* 集計フッター行 */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-800">
                  <td colSpan={6} className="py-3 px-4 text-right text-slate-500">
                    表示中 ({filtered.length} 件) の合計:
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-black text-slate-900">
                    ¥{filteredSummary.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-[11px] text-slate-600">
                    <div>智: ¥{filteredSummary.totalTomoaki.toLocaleString()}</div>
                    <div>康: ¥{filteredSummary.totalYasuko.toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-3 text-right text-[11px]">
                    {filteredSummary.netTomoakiAdj > 0 ? (
                      <span className="text-sky-700">
                        智➔康 ¥{filteredSummary.netTomoakiAdj.toLocaleString()}
                      </span>
                    ) : filteredSummary.netTomoakiAdj < 0 ? (
                      <span className="text-pink-700">
                        康➔智 ¥{(-filteredSummary.netTomoakiAdj).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-400">±¥0</span>
                    )}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 4B. モバイル向け カードリスト表示 (md未満で表示) */}
      <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
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
                        <span
                          className={`px-1.5 py-0.2 rounded ${
                            exp.category === '収入/入金'
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {exp.category}
                        </span>
                      </>
                    )}
                  </div>

                  {exp.memo && (
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      💬 {exp.memo}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pl-2">
                  <div className="text-right">
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
                  <button
                    type="button"
                    onClick={(e) => handleDirectDelete(e, exp)}
                    className="p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
