import React, { useState } from 'react';
import { PlanItemResponse } from '../../types/plan';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';

interface StopSkipModalProps {
  isOpen: boolean;
  stop: PlanItemResponse | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  isLoading: boolean;
}

export const StopSkipModal: React.FC<StopSkipModalProps> = ({
  isOpen,
  stop,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [reason, setReason] = useState('Doctor absent / clinic closed');
  const [customReason, setCustomReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !stop) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason || finalReason.length < 3) {
      setErrorMsg('Please specify a valid skip reason (at least 3 characters).');
      return;
    }

    try {
      setErrorMsg(null);
      await onSubmit(finalReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to skip stop.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-5">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xs">
                #{stop.sequence_order}
              </span>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Skip Planned Stop
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-sm">
              {stop.location_address || 'Customer site location'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Skipping this stop will mark it as skipped in your daily execution and allow remaining stops to proceed without blocking your shift.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reason for Skipping <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0284C7]"
            >
              <option value="Doctor absent / clinic closed">Doctor absent / clinic closed</option>
              <option value="Emergency meeting cancelled by customer">Emergency meeting cancelled by customer</option>
              <option value="Severe road blockage / impassable weather">Severe road blockage / impassable weather</option>
              <option value="Customer requested rescheduling to future date">Customer requested rescheduling to future date</option>
              <option value="Other">Other operational reason...</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Skip Reason
              </label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="State reason clearly..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#0284C7]"
                required
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Skipping...' : 'Confirm Skip Stop'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
