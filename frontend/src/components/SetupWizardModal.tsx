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
  TrendingUp,
  BellRing,
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
        leads: true,
        followups: true,
        expenses: false,
        analytics: false,
      });
    } else if (preset === 'executive') {
      setLocalFeatures({
        attendance: true,
        field_visits: false,
        leaves: false,
        tasks: false,
        leads: false,
        followups: false,
        expenses: true,
        analytics: true,
      });
    } else if (preset === 'full') {
      setLocalFeatures({
        attendance: true,
        field_visits: true,
        leaves: true,
        tasks: true,
        leads: true,
        followups: true,
        expenses: true,
        analytics: true,
      });
    } else if (preset === 'minimal') {
      setLocalFeatures({
        attendance: true,
        field_visits: true,
        leaves: false,
        tasks: false,
        leads: false,
        followups: false,
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
      key: 'leads' as const,
      name: 'Lead Management & Pipeline',
      desc: 'Doctor leads, commercial opportunity stages & deal tracking.',
      icon: TrendingUp,
      locked: false,
      tag: 'Commercial Pipeline',
    },
    {
      key: 'followups' as const,
      name: 'Follow-ups & Commitments',
      desc: 'Doctor appointments, scheduled calls & SLA commitments.',
      icon: BellRing,
      locked: false,
      tag: 'Commercial Pipeline',
    },
    {
      key: 'expenses' as const,
      name: 'Expense Claims & Anti-Fraud',
      desc: 'Live camera receipt upload, timestamp delta check & split-bill audits.',
      icon: Receipt,
      locked: false,
      tag: 'Modular Feature',
    },
    {
      key: 'analytics' as const,
      name: 'Executive Analytics & Rollup',
      desc: 'National KPI cards, dual-axis call/burn chart & lead conversion funnel.',
      icon: BarChart3,
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
  ];

  const enabledCount = Object.values(localFeatures).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shadow-md shadow-[#0284C7]/25">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Client Setup Wizard
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0284C7] font-mono">
                  {enabledCount}/{modules.length} Active
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
                className="p-2.5 rounded-xl border border-slate-200 hover:border-[#0284C7] hover:bg-sky-50/40 text-xs font-bold text-slate-700 text-left transition-all"
              >
                <span className="block font-black text-slate-900 text-xs">Pharma Field</span>
                <span className="text-[10px] text-slate-500 font-normal">Visits + Pipeline</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('executive')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-[#0284C7] hover:bg-sky-50/40 text-xs font-bold text-slate-700 text-left transition-all"
              >
                <span className="block font-black text-slate-900 text-xs">Executive HQ</span>
                <span className="text-[10px] text-slate-500 font-normal">Expenses + KPIs</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('full')}
                className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/50 hover:border-[#0284C7] text-xs font-bold text-[#0284C7] text-left transition-all"
              >
                <span className="block font-black text-[#0284C7] text-xs">Enterprise All</span>
                <span className="text-[10px] text-[#0284C7]/80 font-normal">All 8 Modules Active</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('minimal')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-[#0284C7] hover:bg-sky-50/40 text-xs font-bold text-slate-700 text-left transition-all"
              >
                <span className="block font-black text-slate-900 text-xs">Lite Mobile</span>
                <span className="text-[10px] text-slate-500 font-normal">Clock-In & Visits</span>
              </button>
            </div>
          </div>

          {/* Module Checklist */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Feature Module Configuration
            </span>
            <div className="space-y-2.5">
              {modules.map((mod) => {
                const isEnabled = localFeatures[mod.key];
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.key}
                    onClick={() => toggleFeature(mod.key)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                      isEnabled
                        ? 'border-sky-200 bg-sky-50/30 shadow-sm'
                        : 'border-slate-200 bg-white opacity-60 hover:opacity-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isEnabled
                            ? 'bg-sky-100 text-[#0284C7]'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{mod.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                              mod.locked
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {mod.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{mod.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-3">
                      {mod.locked ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          LOCKED
                        </span>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isEnabled
                              ? 'bg-[#0284C7] border-[#0284C7] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <p className="text-xs text-slate-400 hidden sm:block">
            Settings persist to PostgreSQL <code className="font-mono text-slate-600">system_config</code>.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-black shadow-md shadow-[#0284C7]/25 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Applied & Synchronized!</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
