import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock } from 'lucide-react';
import { Followup } from '../types';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  followup: Followup;
  onConfirm: (newDueAt: string, reason: string) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  followup,
  onConfirm,
}) => {
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) {
      setError('Please choose a new scheduled date.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason why this follow-up is being rescheduled.');
      return;
    }

    const isoDateTime = new Date(`${newDueDate}T${newDueTime || '10:00'}:00`).toISOString();

    setIsSubmitting(true);
    try {
      await onConfirm(isoDateTime, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule follow-up');
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
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-subtle border border-amber-100/60">
              <CalendarClock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Reschedule Action</h3>
              <p className="text-xs text-slate-500 font-medium">Postpone promised due date with audit reason</p>
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
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Current Due</span>
            <span className="font-extrabold text-slate-900 block mt-1 text-sm">
              {new Date(followup.due_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                New Date *
              </label>
              <input
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                Time (24h)
              </label>
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
              Reason for Rescheduling *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Doctor called into emergency surgery; requested visit tomorrow afternoon."
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium placeholder:text-slate-400 transition-all"
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
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#6B52B6] hover:bg-[#5B42A4] text-white shadow-md shadow-[#6B52B6]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Save Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
