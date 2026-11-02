import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, ArrowLeft, Edit3 } from 'lucide-react';
import { RuleDTO } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';
import { EditRuleModal } from '../components/EditRuleModal';

interface RulesConfigPageProps {
  onBack: () => void;
  onNavigateToScans?: () => void;
}

export const RulesConfigPage: React.FC<RulesConfigPageProps> = ({
  onBack,
  onNavigateToScans,
}) => {
  const [rules, setRules] = useState<RuleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<RuleDTO | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await revenueLeakageApi.fetchRules();
      setRules(data);
    } catch {
      // Mock fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {onNavigateToScans && (
          <button
            onClick={onNavigateToScans}
            className="px-4 py-2 text-xs font-bold text-[#00897B] bg-[#F0FDF9] border border-teal-200/80 rounded-xl hover:bg-teal-50 transition-colors"
          >
            Scanner Runs & Status
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-[#00897B] font-bold text-xs border border-teal-100">
              Rule Management
            </span>
            <span className="text-xs text-slate-400">Senior Leadership Only</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Warning Rules & Cadence Parameters
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Configure working-day thresholds, attention escalation ratios, cool-down periods, and auto-clearing streak requirements.
          </p>
        </div>

        <button
          onClick={loadRules}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0"
          title="Refresh Rules"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="w-8 h-8 text-[#00897B] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">Loading warning configurations...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-teal-200 transition-all space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#00897B] uppercase tracking-wide">
                      {rule.rule_code}
                    </span>
                    <span className="text-slate-400">·</span>
                    {rule.is_active ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-slate-400" /> INACTIVE
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{rule.rule_name}</h3>
                  <p className="text-xs text-slate-500">{rule.description}</p>
                </div>

                <button
                  onClick={() => setEditingRule(rule)}
                  className="px-4 py-2 text-xs font-bold text-[#00897B] bg-[#F0FDF9] border border-teal-200/80 rounded-xl hover:bg-teal-50 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Parameters</span>
                </button>
              </div>

              {/* Parameters Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Working Days Threshold</span>
                  <span className="font-extrabold text-slate-800 block">{rule.threshold_days} Days</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Escalation Ratios</span>
                  <span className="font-extrabold text-slate-800 block">
                    Med: {rule.medium_priority_ratio}x · High: {rule.high_priority_ratio}x
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cool-Down & Dismissal</span>
                  <span className="font-extrabold text-slate-800 block">
                    {rule.cooldown_days}d cool / {rule.dismiss_days}d dismiss
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Auto-Clear Streak</span>
                  <span className="font-extrabold text-slate-800 block">
                    {rule.autoclear_scans} Consecutive Scans
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          isOpen={true}
          onClose={() => setEditingRule(null)}
          onSuccess={() => {
            setEditingRule(null);
            loadRules();
          }}
        />
      )}
    </div>
  );
};
