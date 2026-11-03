import React, { useState, useEffect } from 'react';
import {
  PlanItemResponse,
  VisitOutcome,
  LeadStage,
  PlanItemCompletePayload,
  ObligationFulfillmentItem,
  NextFollowUpPayload,
} from '../../types/plan';
import {
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface StopCheckoutModalProps {
  isOpen: boolean;
  stop: PlanItemResponse | null;
  onClose: () => void;
  onSubmit: (payload: PlanItemCompletePayload) => Promise<void>;
  isLoading: boolean;
}

export const StopCheckoutModal: React.FC<StopCheckoutModalProps> = ({
  isOpen,
  stop,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [outcome, setOutcome] = useState<VisitOutcome>('SUCCESSFUL_MEETING');
  const [notes, setNotes] = useState('');
  const [leadStage, setLeadStage] = useState<LeadStage | ''>('');
  const [convertedValue, setConvertedValue] = useState<string>('');

  // Obligations fulfillment state
  const [obligationStatusMap, setObligationStatusMap] = useState<
    Record<string, 'FULFILLED' | 'UNFULFILLED_RESCHEDULED' | 'CANCELLED'>
  >({});

  // Next follow up state
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [followUpTitle, setFollowUpTitle] = useState('');

  const [actualLat, setActualLat] = useState<number>(12.9716);
  const [actualLon, setActualLon] = useState<number>(77.5946);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && stop) {
      setOutcome('SUCCESSFUL_MEETING');
      setNotes('');
      setLeadStage('');
      setConvertedValue('');
      setScheduleFollowUp(false);
      setFollowUpTitle('');
      setErrorMsg(null);

      // Default all obligations to FULFILLED
      const initialMap: Record<string, 'FULFILLED' | 'UNFULFILLED_RESCHEDULED' | 'CANCELLED'> = {};
      if (stop.obligations) {
        stop.obligations.forEach((o) => {
          initialMap[o.id] = 'FULFILLED';
        });
      }
      setObligationStatusMap(initialMap);

      // Get departure coordinates
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setActualLat(pos.coords.latitude);
            setActualLon(pos.coords.longitude);
          },
          () => {
            if (stop.latitude && stop.longitude) {
              setActualLat(stop.latitude);
              setActualLon(stop.longitude);
            }
          },
          { timeout: 8000 }
        );
      } else if (stop.latitude && stop.longitude) {
        setActualLat(stop.latitude);
        setActualLon(stop.longitude);
      }
    }
  }, [isOpen, stop]);

  if (!isOpen || !stop) return null;

  const isWonOrLost = leadStage === 'CONVERTED' || leadStage === 'LOST';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setErrorMsg('Please enter visit discussion notes before recording checkout.');
      return;
    }

    try {
      setErrorMsg(null);

      const obligationsPayload: ObligationFulfillmentItem[] = (stop.obligations || []).map(
        (obl) => ({
          obligation_id: obl.id,
          fulfillment_status: obligationStatusMap[obl.id] || 'FULFILLED',
          notes: notes.trim(),
        })
      );

      let nextFollowUpPayload: NextFollowUpPayload | undefined = undefined;
      if (scheduleFollowUp && followUpTitle.trim()) {
        nextFollowUpPayload = {
          scheduled_date: followUpDate,
          title: followUpTitle.trim(),
          urgency: 'NORMAL',
          action_type: 'Visit',
        };
      }

      const payload: PlanItemCompletePayload = {
        idempotency_key: generateUUID(),
        actual_latitude: actualLat,
        actual_longitude: actualLon,
        visit_outcome: outcome,
        notes: notes.trim(),
        updated_lead_stage: leadStage ? (leadStage as LeadStage) : undefined,
        actual_converted_value: convertedValue ? parseFloat(convertedValue) : undefined,
        obligations: obligationsPayload,
        next_follow_up: nextFollowUpPayload,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete visit.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs">
                #{stop.sequence_order}
              </span>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Complete Visit & DCR Checkout
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
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Visit Outcome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Visit Outcome <span className="text-rose-500">*</span>
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as VisitOutcome)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7]"
            >
              <option value="SUCCESSFUL_MEETING">Successful Meeting & Detailing</option>
              <option value="DOCTOR_UNAVAILABLE">Doctor / Contact Unavailable</option>
              <option value="RESCHEDULE_REQUESTED">Reschedule Requested</option>
              <option value="GATEKEEPER_BLOCKED">Gatekeeper Blocked</option>
            </select>
          </div>

          {/* Discussion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Discussion Notes / DCR Remarks <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record feedback, product samples detailed, customer response..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7]"
              required
            />
          </div>

          {/* Obligations fulfillment checklist */}
          {stop.obligations && stop.obligations.length > 0 && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">
                Fulfill Planned Obligations
              </span>
              <div className="space-y-2">
                {stop.obligations.map((obl) => (
                  <div
                    key={obl.id}
                    className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="w-4 h-4 text-[#0284C7] shrink-0" />
                      <span className="truncate font-medium text-slate-800">
                        {obl.obligation_title}
                      </span>
                    </div>
                    <select
                      value={obligationStatusMap[obl.id] || 'FULFILLED'}
                      onChange={(e) =>
                        setObligationStatusMap((prev) => ({
                          ...prev,
                          [obl.id]: e.target.value as any,
                        }))
                      }
                      className="text-[11px] font-bold border border-slate-300 rounded-lg px-2 py-1 bg-slate-50 text-slate-700"
                    >
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="UNFULFILLED_RESCHEDULED">Reschedule</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CRM Stage Advancement (Optional) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Update Lead Pipeline Stage
            </label>
            <select
              value={leadStage}
              onChange={(e) => setLeadStage(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0284C7]"
            >
              <option value="">-- Leave Unchanged --</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="INTERESTED">INTERESTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="CONVERTED">CONVERTED (Requires Manager Review)</option>
              <option value="LOST">LOST (Requires Manager Review)</option>
            </select>

            {/* Representative Manager Review Notice */}
            {isWonOrLost && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Manager Approval Notice:</strong> Field representatives record deals at{' '}
                  <strong>{leadStage}</strong> as <em>DEAL_OUTCOME_REPORTED</em>. The change is
                  queued for Area Manager verification before final CRM closing.
                </span>
              </div>
            )}
          </div>

          {/* Actual Converted Value */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Actual Converted Value (₹, optional)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={convertedValue}
                onChange={(e) => setConvertedValue(e.target.value)}
                placeholder="e.g. 150000"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#0284C7]"
              />
            </div>
          </div>

          {/* Next Follow Up Toggle */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="rounded text-[#0284C7] focus:ring-[#0284C7]"
              />
              <span className="text-xs font-bold text-slate-700">Schedule Next Follow-Up</span>
            </label>

            {scheduleFollowUp && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Follow-Up Title / Purpose
                  </label>
                  <input
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="e.g. Follow up on rate sheet and order confirmation"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
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
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isLoading ? 'Saving...' : 'Finalize Visit Checkout'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
