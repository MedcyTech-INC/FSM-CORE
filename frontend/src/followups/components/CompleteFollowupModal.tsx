import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2 } from 'lucide-react';
import { Followup } from '../types';

interface CompleteFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  followup: Followup;
  onConfirm: (outcome: string) => Promise<void>;
}

export const CompleteFollowupModal: React.FC<CompleteFollowupModalProps> = ({
  isOpen,
  onClose,
  followup,
  onConfirm,
}) => {
  const [outcome, setOutcome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) {
      setError('Please describe what happened when completing this action.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(outcome.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm font-sans animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
      />
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-subtle border border-emerald-100/60">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Complete Follow-up</h3>
              <p className="text-xs text-slate-500 font-medium">Document the outcome of this action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
              ⚠️ {error}
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs shadow-subtle">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Action</span>
            <span className="font-extrabold text-slate-900 block mt-1 text-sm">{followup.title}</span>
            <span className="text-xs text-slate-500 block mt-0.5 font-medium">
              Customer: <strong className="text-slate-700">{followup.customer_name}</strong>
            </span>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
              Action Outcome / Results *
            </label>
            <textarea
              required
              rows={3}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="E.g., Delivered pricing sheet to Dr. Sharma. Clinic is reviewing with management."
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium placeholder:text-slate-400 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md shadow-[#0284C7]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Mark as Completed'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
