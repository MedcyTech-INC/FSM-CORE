import React, { useState } from 'react';
import {
  Wand2,
  X,
  CheckCircle2,
  CalendarDays,
  Camera,
  Moon,
  CheckSquare,
  Receipt,
  BarChart3,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useFeatureStore, ClientFeatures } from '../store/featureStore';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ isOpen, onClose }) => {
  const { features, saveFeatures } = useFeatureStore();
  const [localFeatures, setLocalFeatures] = useState<ClientFeatures>(features);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleFeature = (key: keyof ClientFeatures) => {
    if (key === 'attendance') return; // Core attendance locked
    setLocalFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const applyPreset = (preset: 'pharma' | 'executive' | 'full' | 'minimal') => {
    if (preset === 'pharma') {
      setLocalFeatures({
        attendance: true,
        field_visits: true,
        leaves: true,
        tasks: true,
        expenses: false,
        analytics: false,
      });
    } else if (preset === 'executive') {
      setLocalFeatures({
        attendance: true,
        field_visits: false,
        leaves: false,
        tasks: false,
        expenses: true,
        analytics: true,
      });
    } else if (preset === 'full') {
      setLocalFeatures({
        attendance: true,
        field_visits: true,
        leaves: true,
        tasks: true,
        expenses: true,
        analytics: true,
      });
    } else if (preset === 'minimal') {
      setLocalFeatures({
        attendance: true,
        field_visits: true,
        leaves: false,
        tasks: false,
        expenses: false,
        analytics: false,
      });
    }
  };

  const handleApply = async () => {
    setSaving(true);
    await saveFeatures(localFeatures);
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const modules = [
    {
      key: 'attendance' as const,
      name: 'Attendance & Geofencing',
      desc: 'GPS clock-in/out, accuracy thresholds & tamper verification.',
      icon: CalendarDays,
      locked: true,
      tag: 'Core Essential',
    },
    {
      key: 'field_visits' as const,
      name: 'Field Visits & Client Detailing',
      desc: 'Doctor/Client call logs, sample delivery, and route visits.',
      icon: Camera,
      locked: false,
      tag: 'Modular Feature',
    },
    {
      key: 'leaves' as const,
      name: 'Leave Management & Balances',
      desc: 'PTO allocations, casual/sick leave requests & manager approvals.',
      icon: Moon,
      locked: false,
      tag: 'Modular Feature',
    },
    {
      key: 'tasks' as const,
      name: 'Work Assignment & Tasks',
      desc: 'Manager-to-rep delegated daily action tasks & priority flags.',
      icon: CheckSquare,
      locked: false,
      tag: 'Modular Feature',
    },
    {
      key: 'expenses' as const,
      name: 'Expense Claims & Anti-Fraud',
      desc: 'Live camera receipt upload, timestamp delta check & split-bill audits.',
      icon: Receipt,
      locked: false,
      tag: 'New Feature 1',
    },
    {
      key: 'analytics' as const,
      name: 'Executive Analytics & Rollup',
      desc: 'National KPI cards, dual-axis call/burn chart & lead conversion funnel.',
      icon: BarChart3,
      locked: false,
      tag: 'New Feature 2',
    },
  ];

  const enabledCount = Object.values(localFeatures).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Client Setup Wizard
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-mono">
                  {enabledCount}/6 Active
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Dynamically mount or isolate features for this deployment without code changes.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Instant Vertical Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('pharma')}
                className="p-2 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 text-xs font-bold text-slate-700 text-left transition-all"
              >
                Pharma Standard
                <span className="text-[10px] text-slate-400 block font-normal">Core + Field + HR</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('full')}
                className="p-2 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/50 text-xs font-bold text-teal-800 text-left transition-all"
              >
                Full Suite (6/6)
                <span className="text-[10px] text-teal-600 block font-normal">All Modules Enabled</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('executive')}
                className="p-2 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 text-xs font-bold text-slate-700 text-left transition-all"
              >
                Finance & Executive
                <span className="text-[10px] text-slate-400 block font-normal">Expenses + Analytics</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('minimal')}
                className="p-2 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 text-xs font-bold text-slate-700 text-left transition-all"
              >
                Minimal Field Force
                <span className="text-[10px] text-slate-400 block font-normal">Attendance + Visits</span>
              </button>
            </div>
          </div>

          {/* Module Cards */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Configurable Feature Modules
            </span>

            {modules.map((mod) => {
              const Icon = mod.icon;
              const isEnabled = localFeatures[mod.key];

              return (
                <div
                  key={mod.key}
                  onClick={() => toggleFeature(mod.key)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                    isEnabled
                      ? 'border-teal-200 bg-teal-50/30 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isEnabled ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{mod.name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                            mod.locked
                              ? 'bg-slate-200 text-slate-700'
                              : isEnabled
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {mod.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{mod.desc}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${
                      isEnabled ? 'bg-teal-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Setup applied & synchronized!
              </span>
            ) : (
              <span>Changes take effect instantly on navigation & routes.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-700/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
