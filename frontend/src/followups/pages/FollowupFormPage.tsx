import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, TrendingUp } from 'lucide-react';
import { useFollowupsStore } from '../store';
import { FollowupPriority, Followup } from '../types';
import { leadsApi } from '../../lead_management/api';
import { Lead } from '../../lead_management/types';

interface FollowupFormPageProps {
  onClose: () => void;
  onCreated: (followup: Followup) => void;
  prefillLeadId?: string;
  prefillVisitId?: string;
  prefillCustomerName?: string;
}

const ACTION_TYPES = [
  'Call',
  'Revisit',
  'Quotation',
  'Demo',
  'Document Collection',
  'Payment Reminder',
  'Other',
];

export const FollowupFormPage: React.FC<FollowupFormPageProps> = ({
  onClose,
  onCreated,
  prefillLeadId,
  prefillVisitId,
  prefillCustomerName,
}) => {
  const { createFollowup } = useFollowupsStore();

  const [actionType, setActionType] = useState(ACTION_TYPES[0]);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState(prefillCustomerName || '');
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(prefillLeadId);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);

  // Default to tomorrow 10:00 AM
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(tomorrow);
  const [dueTime, setDueTime] = useState('10:00');
  const [priority, setPriority] = useState<FollowupPriority>('MEDIUM');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillLeadId) {
      leadsApi.listLeads({ stage: 'ALL' }).then((leads) => {
        setAvailableLeads(leads.filter((l) => !['CONVERTED', 'LOST'].includes(l.stage)));
      });
    }
  }, [prefillLeadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide an action title.');
      return;
    }

    if (!customerName.trim() && !selectedLeadId && !prefillVisitId) {
      setError('Follow-up must be linked to a customer, lead, or visit.');
      return;
    }

    const isoDue = new Date(`${dueDate}T${dueTime || '10:00'}:00`).toISOString();

    setIsSubmitting(true);
    try {
      const created = await createFollowup({
        action_type: actionType,
        title: title.trim(),
        due_at: isoDue,
        priority,
        notes: notes.trim() || undefined,
        customer_name: customerName.trim() || undefined,
        lead_id: selectedLeadId,
        field_visit_id: prefillVisitId,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err.message || 'Failed to save follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 font-sans">
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between p-6 pb-0 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6B52B6] to-[#7B61C9] text-white flex items-center justify-center shadow-md shadow-[#6B52B6]/20 shrink-0">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Schedule Next Action
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Lock in a time-bound commitment. It will activate on your Due Today radar.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all shadow-subtle active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          <span>Close</span>
        </button>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Linked Opportunity / Customer */}
          <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest block">
              Linked Clinical / Commercial Target
            </span>

            {prefillLeadId ? (
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#6B52B6] bg-purple-50/90 p-3 rounded-xl border border-purple-200/70 shadow-subtle">
                <TrendingUp className="w-4 h-4 text-[#6B52B6]" />
                <span>Linked directly to active Opportunity</span>
              </div>
            ) : availableLeads.length > 0 ? (
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Optional: Link to Open Opportunity
                </label>
                <select
                  value={selectedLeadId || ''}
                  onChange={(e) => {
                    const lId = e.target.value;
                    setSelectedLeadId(lId || undefined);
                    const matched = availableLeads.find((x) => x.id === lId);
                    if (matched && matched.customer_name) {
                      setCustomerName(matched.customer_name);
                    }
                  }}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
                >
                  <option value="">-- No specific lead (Routine Clinic / Doctor Relationship) --</option>
                  {availableLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.customer_name} · {l.title} ({l.stage})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Doctor / Clinic / Organization *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="E.g., Dr. Jane Smith or Apollo City Hospital"
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
              />
            </div>
          </div>

          {/* Action Type & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Action Type *
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none font-bold text-slate-800"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Action Title / Promise *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Deliver customized lab pricing sheet to Dr. Sharma"
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
              />
            </div>
          </div>

          {/* Date, Time & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FollowupPriority)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none font-bold text-slate-800"
              >
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Preparation Notes & Checkpoints
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What documents, brochures, or discount clearances are needed prior to this action?"
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-[#6B52B6] via-[#7B61C9] to-[#8C74DC] text-white hover:opacity-95 shadow-glow-brand disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {isSubmitting ? 'Scheduling Action...' : 'Schedule Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
