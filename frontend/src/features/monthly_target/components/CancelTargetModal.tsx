import React, { useState } from 'react';
import { X, Ban, AlertTriangle } from 'lucide-react';
import { targetsApi, TargetsApiError } from '../api/targetsApi';
import { TargetDetailDTO, TargetCancelPayload } from '../types';

interface CancelTargetModalProps {
  target: TargetDetailDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: TargetDetailDTO) => void;
}

export const CancelTargetModal: React.FC<CancelTargetModalProps> = ({
  target,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorBanner('A valid cancellation reason of at least 5 characters is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TargetCancelPayload = {
        version: target.version,
        reason: reason.trim(),
      };

      const res = await targetsApi.cancelTarget(target.id, payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      if (err instanceof TargetsApiError) {
        if (err.code === 'version_conflict') {
          setErrorBanner('Target was modified by someone else. Please reload and review.');
        } else if (err.code === 'target_archived') {
          setErrorBanner('This target is archived and cannot be cancelled.');
        } else {
          setErrorBanner(err.message || 'Failed to cancel target.');
        }
      } else {
        setErrorBanner(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">Cancel Target</h3>
              <p className="text-xs font-medium text-slate-500">Soft-Cancellation · Retains Progress</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorBanner && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            Cancelling this target retains all recorded ledger progress entries, but removes it from the active
            dashboard of representatives.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Cancellation Reason *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State why this target is being cancelled..."
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm shadow-rose-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
