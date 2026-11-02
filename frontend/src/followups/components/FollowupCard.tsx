import React, { useState } from 'react';
import {
  Clock,
  Building2,
  TrendingUp,
  CheckCircle,
  CalendarClock,
  XCircle,
  PhoneCall,
  RotateCcw,
  FileText,
  FileCheck,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { Followup } from '../types';
import { FollowupStatusBadge } from './FollowupStatusBadge';
import { CompleteFollowupModal } from './CompleteFollowupModal';
import { RescheduleModal } from './RescheduleModal';
import { useFollowupsStore } from '../store';

interface FollowupCardProps {
  followup: Followup;
  onRefresh?: () => void;
}

export const FollowupCard: React.FC<FollowupCardProps> = ({ followup, onRefresh }) => {
  const { completeFollowup, rescheduleFollowup, cancelFollowup } = useFollowupsStore();

  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);

  const getActionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'call':
        return PhoneCall;
      case 'revisit':
        return RotateCcw;
      case 'quotation':
        return FileText;
      case 'document collection':
        return FileCheck;
      case 'payment reminder':
        return CreditCard;
      default:
        return Clock;
    }
  };

  const ActionIcon = getActionIcon(followup.action_type);
  const isPending = followup.status === 'PENDING';

  const handleCancel = async () => {
    const reason = prompt('Please provide a reason for cancelling this follow-up:');
    if (!reason || !reason.trim()) return;
    await cancelFollowup(followup.id, reason.trim());
    if (onRefresh) onRefresh();
  };

  return (
    <div
      className={`card-elevation rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
        followup.is_overdue
          ? 'border-rose-300/90 ring-1 ring-rose-200 bg-gradient-to-br from-rose-50/40 via-white to-white shadow-glow-rose'
          : 'border-slate-200/80 hover:border-purple-200'
      }`}
    >
      <div>
        {/* Top: Action Type & Status Badge */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B52B6] flex items-center justify-center shrink-0 shadow-subtle">
              <ActionIcon className="w-3.5 h-3.5 stroke-[2.2]" />
            </span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {followup.action_type}
            </span>
          </div>
          <FollowupStatusBadge status={followup.status} isOverdue={followup.is_overdue} />
        </div>

        {/* Action Title */}
        <h4 className="font-extrabold text-slate-900 text-sm leading-snug mb-2">
          {followup.title}
        </h4>

        {/* Context: Customer & Linked Lead */}
        <div className="space-y-1.5 text-xs text-slate-500 mb-3">
          {followup.customer_name && (
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-bold text-slate-800 truncate">{followup.customer_name}</span>
            </div>
          )}

          {followup.lead_title && (
            <div className="flex items-center gap-1.5 truncate text-[11px] text-[#6B52B6] bg-purple-50/90 px-2.5 py-0.5 rounded-lg border border-purple-200/60 w-fit font-bold">
              <TrendingUp className="w-3 h-3 text-[#6B52B6] shrink-0" />
              <span className="truncate">{followup.lead_title}</span>
            </div>
          )}
        </div>

        {/* Notes if provided */}
        {followup.notes && (
          <p className="text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 mb-3 font-medium">
            {followup.notes}
          </p>
        )}

        {/* Completed outcome if present */}
        {followup.status === 'COMPLETED' && followup.outcome && (
          <div className="text-[11px] text-emerald-900 bg-emerald-50/90 p-3 rounded-xl border border-emerald-200/80 mb-3 shadow-subtle">
            <span className="font-extrabold block text-emerald-800 mb-0.5">Outcome Documented:</span>
            <span className="font-medium">{followup.outcome}</span>
          </div>
        )}

        {/* Cancelled reason if present */}
        {followup.status === 'CANCELLED' && followup.cancel_reason && (
          <div className="text-[11px] text-slate-600 bg-slate-100 p-2.5 rounded-xl mb-3">
            <span className="font-extrabold block text-slate-700 mb-0.5">Cancellation Reason:</span>
            <span>{followup.cancel_reason}</span>
          </div>
        )}
      </div>

      {/* Due Date & Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          {followup.is_overdue ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span
            className={`font-black text-xs tabular-nums ${
              followup.is_overdue ? 'text-rose-700' : 'text-slate-800'
            }`}
          >
            {new Date(followup.due_at).toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setIsRescheduleOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Reschedule Date"
            >
              <CalendarClock className="w-4 h-4" />
            </button>

            <button
              onClick={handleCancel}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Cancel Action"
            >
              <XCircle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsCompleteOpen(true)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-[#6B52B6] hover:opacity-95 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-glow-emerald transition-all active:scale-95 cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <CompleteFollowupModal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        followup={followup}
        onConfirm={async (outcome) => {
          await completeFollowup(followup.id, outcome);
          if (onRefresh) onRefresh();
        }}
      />

      <RescheduleModal
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        followup={followup}
        onConfirm={async (newDue, reason) => {
          await rescheduleFollowup(followup.id, newDue, reason);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
