'use client';

import React, { useState, useEffect } from 'react';
import { AppSetting } from '../lib/types';
import { Save, Check, ShieldCheck, MessageSquare, Info } from 'lucide-react';

interface SettingsTabProps {
  settings: Record<string, string>;
  onSaveSetting: (key: string, value: string) => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSaveSetting }) => {
  const [defaultRatio, setDefaultRatio] = useState('6:4');
  const [defaultPayer, setDefaultPayer] = useState('智明');
  const [familyCardPayer, setFamilyCardPayer] = useState('智明');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (settings['default_split_ratio']) {
      setDefaultRatio(settings['default_split_ratio']);
    }
    if (settings['default_payer']) {
      setDefaultPayer(settings['default_payer']);
    }
    if (settings['family_card_payer']) {
      setFamilyCardPayer(settings['family_card_payer']);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveSetting('default_split_ratio', defaultRatio);
      await onSaveSetting('default_payer', defaultPayer);
      await onSaveSetting('family_card_payer', familyCardPayer);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      <form onSubmit={handleSave} className="space-y-4">
        {/* デフォルト負担割合 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <span>新規登録時のデフォルト負担割合</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            LINEで割合を指定しなかった場合に自動適用される負担比率です。
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              { id: '6:4', label: '6:4 (智明6 : 康子4)', desc: '現在の標準設定' },
              { id: '5:5', label: '5:5 (折半)', desc: '完全均等' },
              { id: '7:3', label: '7:3 (智明7 : 康子3)', desc: '傾斜配分' },
              { id: '1:2', label: '1:2 (智明1 : 康子2)', desc: '康子主配分' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  defaultRatio === opt.id
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="ratio"
                    value={opt.id}
                    checked={defaultRatio === opt.id}
                    onChange={(e) => setDefaultRatio(e.target.value)}
                    className="text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-xs">{opt.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 pl-5">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 支払い元・家族カードの運用設定 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800">立替・口座引落の設定</h2>

          {/* デフォルト支払者 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              支払者が省略された場合のデフォルト支払者
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['智明', '康子'].map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => setDefaultPayer(name)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    defaultPayer === name
                      ? 'bg-sky-50 border-sky-600 text-sky-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 家族カード引落名義 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              家族カードの引き落とし口座名義（事前入金元）
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['智明', '康子'].map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => setFamilyCardPayer(name)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    familyCardPayer === name
                      ? 'bg-sky-50 border-sky-600 text-sky-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ※智明が残高維持・ことら入金している場合は「智明」を選択
            </p>
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-5 h-5 text-emerald-300" />
              <span>設定を保存しました！</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>{isSaving ? '保存中...' : '設定を保存する'}</span>
            </>
          )}
        </button>
      </form>

      {/* LINE連携の解説カード */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>LINE Bot入力のヒント</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          ・「スーパー 3200」と送ると、上記で設定したデフォルト負担割合（{defaultRatio}）が適用されます。<br />
          ・「ワイシャツ 16000 智明負担」のように送ると、家族カード決済・智明全額負担として自動認識されます。<br />
          ・間違えて送信した直後に「取消」と送ると、直前の登録を即時キャンセルできます。
        </p>
      </div>
    </div>
  );
};
