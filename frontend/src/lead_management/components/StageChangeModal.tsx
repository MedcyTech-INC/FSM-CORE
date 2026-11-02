import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { LeadStage } from '../types';

interface StageChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStage: LeadStage;
  pendingFollowupsCount?: number;
  onConfirm: (data: { new_stage: LeadStage; conversion_outcome?: string; loss_reason?: string; notes?: string }) => Promise<void>;
}

const STAGES: { value: LeadStage; label: string; desc: string }[] = [
  { value: 'NEW', label: 'New', desc: 'Opportunity just recorded' },
  { value: 'CONTACTED', label: 'Contacted', desc: 'Initial contact made with customer' },
  { value: 'INTERESTED', label: 'Interested', desc: 'Customer expressed specific interest' },
  { value: 'QUALIFIED', label: 'Qualified', desc: 'Plausible need and confirmed opportunity' },
  { value: 'CONVERTED', label: 'Converted', desc: 'Confirmed business agreement / sale' },
  { value: 'LOST', label: 'Lost', desc: 'Opportunity will not proceed' },
];

export const StageChangeModal: React.FC<StageChangeModalProps> = ({
  isOpen,
  onClose,
  currentStage,
  pendingFollowupsCount = 0,
  onConfirm,
}) => {
  const [selectedStage, setSelectedStage] = useState<LeadStage>(currentStage);
  const [outcome, setOutcome] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedStage === 'CONVERTED' && !outcome.trim()) {
      setError('Conversion outcome is mandatory when marking as Converted.');
      return;
    }

    if (selectedStage === 'LOST' && !lossReason.trim()) {
      setError('Please provide a reason why this opportunity was lost.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        new_stage: selectedStage,
        conversion_outcome: selectedStage === 'CONVERTED' ? outcome.trim() : undefined,
        loss_reason: selectedStage === 'LOST' ? lossReason.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update stage');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClosing = selectedStage === 'CONVERTED' || selectedStage === 'LOST';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
      />
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] font-sans animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Update Opportunity Stage</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Transition opportunity to its next verified state</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Warning banner if closing with pending followups */}
          {isClosing && pendingFollowupsCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Heads up:</strong> This opportunity has {pendingFollowupsCount} open follow-up commitment(s).
                Closing the lead will not delete them.
              </span>
            </div>
          )}

          {/* Stage Selector Grid */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2.5">
              Select New Stage
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s) => {
                const isSelected = selectedStage === s.value;
                const isCurrent = currentStage === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSelectedStage(s.value)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#6B52B6] bg-purple-50/80 shadow-sm ring-1 ring-[#6B52B6]'
                        : 'border-slate-200/80 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${isSelected ? 'text-[#6B52B6]' : 'text-slate-800'}`}>
                        {s.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Mandatory: Conversion Outcome */}
          {selectedStage === 'CONVERTED' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-emerald-800 uppercase tracking-widest">
                Conversion Outcome & Deal Terms *
              </label>
              <textarea
                required
                rows={2}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="E.g., Signed annual diagnostic contract for 500 tests/month. First delivery on Monday."
                className="w-full text-xs p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              />
            </div>
          )}

          {/* Conditional Mandatory: Reason for Loss */}
          {selectedStage === 'LOST' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-rose-800 uppercase tracking-widest">
                Reason for Loss *
              </label>
              <textarea
                required
                rows={2}
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="E.g., Doctor opted for competitor device due to lower consumables cost."
                className="w-full text-xs p-3.5 rounded-2xl border border-rose-300 bg-rose-50/30 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-medium"
              />
            </div>
          )}

          {/* Audit Notes */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
              Audit Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Approved by Regional Manager in weekly pipeline call"
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
            />
          </div>

          {/* Footer Actions */}
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
              {isSubmitting ? 'Updating...' : 'Save Stage Change'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
