import React, { useState } from 'react';
import { X, Sliders, AlertTriangle } from 'lucide-react';
import { RuleDTO } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';

interface EditRuleModalProps {
  rule: RuleDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  rule,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [thresholdDays, setThresholdDays] = useState(rule.threshold_days);
  const [thresholdValue, setThresholdValue] = useState(rule.threshold_value);
  const [medRatio, setMedRatio] = useState(rule.medium_priority_ratio);
  const [highRatio, setHighRatio] = useState(rule.high_priority_ratio);
  const [changeRatio, setChangeRatio] = useState(rule.change_ratio);
  const [cooldownDays, setCooldownDays] = useState(rule.cooldown_days);
  const [dismissDays, setDismissDays] = useState(rule.dismiss_days);
  const [autoclearScans, setAutoclearScans] = useState(rule.autoclear_scans);
  const [escalationDays, setEscalationDays] = useState(rule.escalation_days);
  const [isActive, setIsActive] = useState(rule.is_active);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setErrorMessage('Audit reason must be at least 5 characters long.');
      return;
    }

    if (highRatio <= medRatio) {
      setErrorMessage('High attention ratio must be strictly greater than medium attention ratio.');
      return;
    }

    if (medRatio < 1.0) {
      setErrorMessage('Medium attention ratio must be at least 1.0.');
      return;
    }

    if (changeRatio <= 0 || changeRatio > 1.0) {
      setErrorMessage('Change ratio must be between 0.01 and 1.00.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await revenueLeakageApi.patchRule(rule.id, {
        threshold_days: thresholdDays,
        threshold_value: thresholdValue,
        medium_priority_ratio: medRatio,
        high_priority_ratio: highRatio,
        change_ratio: changeRatio,
        cooldown_days: cooldownDays,
        dismiss_days: dismissDays,
        autoclear_scans: autoclearScans,
        escalation_days: escalationDays,
        is_active: isActive,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update rule parameters.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00897B]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Configure Warning Parameters</h3>
              <p className="text-xs text-slate-500">{rule.rule_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Rule Status</span>
              <span className="text-[11px] text-slate-500">
                When inactive, nightly scans skip evaluating this condition.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00897B]"></div>
            </label>
          </div>

          {/* Thresholds Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Threshold Days (Working)
              </label>
              <input
                type="number"
                min="1"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(parseInt(e.target.value) || 1)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Threshold Value (INR)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(parseFloat(e.target.value) || 0)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
                required
              />
            </div>
          </div>

          {/* Priority Ratios Grid */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Priority Escalation Ratios
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Medium Attention (Ratio &gt;= 1.0)
                </label>
                <input
                  type="number"
                  min="1.0"
                  step="0.05"
                  value={medRatio}
                  onChange={(e) => setMedRatio(parseFloat(e.target.value) || 1.0)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  High Attention (Ratio &gt; Medium)
                </label>
                <input
                  type="number"
                  min="1.05"
                  step="0.05"
                  value={highRatio}
                  onChange={(e) => setHighRatio(parseFloat(e.target.value) || 2.0)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Lifecycle Timing Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Cool-Down (Days)
              </label>
              <input
                type="number"
                min="0"
                value={cooldownDays}
                onChange={(e) => setCooldownDays(parseInt(e.target.value) || 0)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Dismissal (Days)
              </label>
              <input
                type="number"
                min="0"
                value={dismissDays}
                onChange={(e) => setDismissDays(parseInt(e.target.value) || 0)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Auto-Clear Scans
              </label>
              <input
                type="number"
                min="1"
                value={autoclearScans}
                onChange={(e) => setAutoclearScans(parseInt(e.target.value) || 1)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Escalation Days
              </label>
              <input
                type="number"
                min="1"
                value={escalationDays}
                onChange={(e) => setEscalationDays(parseInt(e.target.value) || 1)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Change Ratio (0-1)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1.00"
                value={changeRatio}
                onChange={(e) => setChangeRatio(parseFloat(e.target.value) || 0.1)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
          </div>

          {/* Mandatory Reason for Audit (Critic Gap RL-2) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Audit Reason * (Required for Leadership Log)
            </label>
            <textarea
              rows={2}
              placeholder="State the business rationale for adjusting this warning threshold..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Every parameter change is logged with timestamp and author.
            </span>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] rounded-xl shadow-md shadow-teal-700/20 disabled:opacity-50 transition-all"
            >
              {submitting ? 'Saving...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
