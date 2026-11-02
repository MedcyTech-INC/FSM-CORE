import React, { useState } from 'react';
import { X, Edit3, AlertTriangle, RefreshCw } from 'lucide-react';
import { targetsApi, TargetsApiError } from '../api/targetsApi';
import { TargetDetailDTO, TargetPatchPayload } from '../types';

interface EditTargetModalProps {
  target: TargetDetailDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: TargetDetailDTO) => void;
}

export const EditTargetModal: React.FC<EditTargetModalProps> = ({
  target,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [targetValue, setTargetValue] = useState<string>(String(target.target_value));
  const [endDate, setEndDate] = useState<string>(target.end_date);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorBanner('A valid reason of at least 5 characters is required for auditing.');
      return;
    }

    const valNum = Number(targetValue);
    if (!targetValue || isNaN(valNum) || valNum <= 0) {
      setErrorBanner('Goal value must be a positive number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TargetPatchPayload = {
        version: conflictVersion || target.version,
        reason: reason.trim(),
        target_value: valNum,
        end_date: endDate !== target.end_date ? endDate : undefined,
      };

      const res = await targetsApi.updateTarget(target.id, payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      if (err instanceof TargetsApiError) {
        if (err.code === 'version_conflict') {
          const latestVersion = err.details?.current_version || target.version + 1;
          setConflictVersion(latestVersion);
          setErrorBanner(
            `Target was modified by someone else (Current version: ${latestVersion}). Review your changes and click 'Retry with latest version'.`
          );
        } else if (err.code === 'target_archived') {
          setErrorBanner('This target is archived and cannot be modified.');
        } else {
          setErrorBanner(err.message || 'Failed to update target.');
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

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00897B] text-white flex items-center justify-center shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">Edit Target</h3>
              <p className="text-xs font-medium text-slate-500">Version {target.version} · Audited Change</p>
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
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorBanner}</p>
                {conflictVersion && (
                  <p className="text-[11px] text-amber-700 mt-1">Your typed changes are preserved above.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Target Goal Value
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Shortening the end date automatically excludes activity beyond the new date.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Reason for Change *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a business rationale for auditing (e.g. Territory reorganization, mid-quarter quota adjustment)..."
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-[#00897B] hover:bg-[#00796B] transition-all shadow-sm shadow-teal-700/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : conflictVersion ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry with v{conflictVersion}
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
