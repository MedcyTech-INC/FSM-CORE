import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';
import { ActionOutcome, ActionType, AlertItemDTO } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';

interface AlertActionModalProps {
  alert: AlertItemDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AlertActionModal: React.FC<AlertActionModalProps> = ({
  alert,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [actionType, setActionType] = useState<ActionType>('acknowledged');
  const [outcome, setOutcome] = useState<ActionOutcome>('investigation_needed');
  const [actionTaken, setActionTaken] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionTaken.trim().length < 5) {
      setErrorMessage('Action taken description must be at least 5 characters long.');
      return;
    }

    if (['resolved', 'dismissed'].includes(actionType) && !outcome) {
      setErrorMessage('Please select a valid resolution outcome.');
      return;
    }

    if (outcome === 'commercial_outcome_evidenced' && !evidenceRef.trim()) {
      setErrorMessage('Evidence reference is required when recording an evidenced commercial outcome.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `act-${alert.id}-${Date.now()}`;

    try {
      await revenueLeakageApi.recordAlertAction(
        alert.id,
        {
          action_type: actionType,
          expected_version: alert.version,
          outcome: ['resolved', 'dismissed'].includes(actionType) ? outcome : undefined,
          action_taken: actionTaken.trim(),
          evidence_reference: outcome === 'commercial_outcome_evidenced' ? evidenceRef.trim() : undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit action. Alert state may have changed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Operational Action</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {alert.entity_label} · Version {alert.version}
            </p>
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

          {/* Action Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Action Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'acknowledged', label: 'Acknowledge', icon: CheckCircle2 },
                { type: 'resolved', label: 'Resolve Issue', icon: ShieldCheck },
                { type: 'dismissed', label: 'Dismiss Warning', icon: AlertTriangle },
                { type: 'note', label: 'Add Field Note', icon: FileText },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = actionType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setActionType(opt.type as ActionType)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-[#00897B] bg-[#F0FDF9] text-[#00897B] shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Outcome (when Resolved or Dismissed) */}
          {['resolved', 'dismissed'].includes(actionType) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Operational Outcome Reason
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as ActionOutcome)}
                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
              >
                <option value="normal_variation">Normal Seasonal/Market Variation (7-day cool-down)</option>
                <option value="investigation_needed">Investigation Underway</option>
                <option value="corrective_action_taken">Corrective Action Completed</option>
                <option value="commercial_outcome_evidenced">Commercial Outcome Evidenced</option>
              </select>
              <p className="text-[11px] text-slate-500">
                {outcome === 'normal_variation' &&
                  'Suppresses alert recurrence for 7 days. Returning conditions after cool-down will spawn occurrence 2.'}
                {actionType === 'dismissed' &&
                  'Dismissal suppresses re-detection on this entity for 30 days.'}
              </p>
            </div>
          )}

          {/* Evidence Reference (when Commercial Outcome Evidenced) */}
          {outcome === 'commercial_outcome_evidenced' && ['resolved', 'dismissed'].includes(actionType) && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Evidence Reference *
              </label>
              <input
                type="text"
                placeholder="e.g. Verified Order PO-4921 or Signed Agreement Ref"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
                required
              />
            </div>
          )}

          {/* Action Taken (Mandatory >= 5 chars) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Action Taken *
            </label>
            <input
              type="text"
              placeholder="e.g. Contacted client purchasing head regarding delivery timeline"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Minimum 5 characters.</span>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Supervisory Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add additional managerial notes or instructions for the field representative..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 focus:border-[#00897B]"
            />
          </div>

          {/* Submit Buttons */}
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
              className="px-5 py-2 text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] rounded-xl shadow-md shadow-teal-700/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {submitting ? 'Recording...' : 'Submit Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
