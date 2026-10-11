'use client';

import React from 'react';
import { LayoutDashboard, ReceiptText, BarChart3, Settings } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'list' | 'analytics' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'list' | 'analytics' | 'settings') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'ホーム', icon: LayoutDashboard },
    { id: 'list', label: '支出一覧', icon: ReceiptText },
    { id: 'analytics', label: 'グラフ分析', icon: BarChart3 },
    { id: 'settings', label: '設定', icon: Settings },
  ] as const;

  return (
    <>
      {/* 上部ヘッダー */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">💳</span>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">夫婦間支出調整</h1>
              <p className="text-[11px] text-slate-500">智明 & 康子</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            LINE連携中
          </span>
        </div>
      </header>

      {/* 下部固定ナビゲーションバー（モバイル最適化） */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
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
                <span className="text-[11px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
