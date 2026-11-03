import React, { useState } from 'react';
import { X, AlertTriangle, Send, Sparkles } from 'lucide-react';

interface PlanRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { category: string; notes: string }) => Promise<void>;
  repName?: string;
  isLoading: boolean;
}

const REJECTION_CATEGORIES = [
  {
    id: 'DOCTOR_UNAVAILABLE',
    label: 'Doctor Unavailable / Clinic Closed',
    description: 'A key doctor is in surgery, on leave, or the clinic is inaccessible.',
    defaultNote: 'Dr. Jane Smith is in emergency surgery today. Exclude this visit and re-sequence the remaining doctors.',
  },
  {
    id: 'EXCESSIVE_STOPS',
    label: 'Schedule Overload / Excessive Stops',
    description: 'Too many visits planned; high risk of missed visits or traffic delays.',
    defaultNote: 'Traffic density is heavy on this corridor today. Reduce commercial visits from 6 to 4 stops.',
  },
  {
    id: 'TERRITORY_FOCUS',
    label: 'Shift Territory / Cluster Priority',
    description: 'Prioritize a higher-yield medical cluster or hospital corridor.',
    defaultNote: 'Shift today\'s focus to the Koramangala polyclinic cluster to optimize travel time.',
  },
  {
    id: 'TARGET_DEFICIT',
    label: 'Target Quota Pacing Deficit',
    description: 'Rep is behind monthly quota; prioritize higher-value deals.',
    defaultNote: 'Prioritize qualified leads with expected contract value above ₹1.5L to accelerate month-end target pacing.',
  },
];

export const PlanRejectModal: React.FC<PlanRejectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  repName = 'Field Representative',
  isLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(REJECTION_CATEGORIES[0].id);
  const [notes, setNotes] = useState<string>(REJECTION_CATEGORIES[0].defaultNote);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    const cat = REJECTION_CATEGORIES.find((c) => c.id === catId);
    if (cat) {
      setNotes(cat.defaultNote);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setErrorMsg('Please provide specific guidance notes so the representative can re-generate accordingly.');
      return;
    }
    setErrorMsg(null);
    try {
      await onSubmit({
        category: selectedCategory,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit rejection decision.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 text-lg">
                Reject Proposed Sales Route
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Reviewing itinerary for <strong className="text-slate-800">{repName}</strong>. Submitting feedback will reject this route and guide the representative to re-generate an adapted plan.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Category Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Primary Rejection Reason Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REJECTION_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`p-3 rounded-2xl text-left border transition-all text-xs ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-400/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{cat.label}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-rose-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Guidance Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Manager Guidance & Actionable Instructions <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Required for AI adaptation</span>
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this route is rejected and what the representative should change when re-generating..."
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all leading-relaxed"
            />
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
              <span>
                The AI routing optimizer reads these instructions to automatically adjust doctor candidate selection and stop limits on the next run.
              </span>
            </p>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm shadow-rose-600/20 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isLoading ? 'Submitting...' : 'Reject Route & Send Guidance'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

