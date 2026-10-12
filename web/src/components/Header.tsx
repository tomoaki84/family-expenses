'use client';

import React from 'react';
import { LayoutDashboard, ReceiptText, BarChart3, Settings, Plus } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'list' | 'analytics' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'list' | 'analytics' | 'settings') => void;
  onAddNewExpense?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onAddNewExpense }) => {
  const tabs = [
    { id: 'dashboard', label: 'ホーム', icon: LayoutDashboard },
    { id: 'list', label: '支出一覧・登録', icon: ReceiptText },
    { id: 'analytics', label: 'グラフ分析', icon: BarChart3 },
    { id: 'settings', label: '設定', icon: Settings },
  ] as const;

  return (
    <>
      {/* 上部ヘッダー */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 md:px-6 py-3 shadow-xs">
        <div className="max-w-md md:max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl md:text-2xl">💳</span>
            <div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 leading-tight">夫婦間支出調整</h1>
              <p className="text-[11px] text-slate-500">智明 & 康子</p>
            </div>
          </div>

          {/* PC用 水平タブナビゲーション */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-sky-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center space-x-2.5">
            {onAddNewExpense && (
              <button
                onClick={onAddNewExpense}
                className="hidden md:inline-flex items-center space-x-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新規登録 (モーダル)</span>
              </button>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              LINE連携中
            </span>
          </div>
        </div>
      </header>

      {/* 下部固定ナビゲーションバー（モバイル専用） */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                  isActive
                    ? 'text-sky-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[11px]">{tab.id === 'list' ? '支出一覧' : tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
