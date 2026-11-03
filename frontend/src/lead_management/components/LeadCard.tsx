import React from 'react';
import { Building2, Clock, AlertCircle } from 'lucide-react';
import { Lead } from '../types';
import { LeadStageChip } from './LeadStageChip';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick }) => {
  const isOverdue =
    lead.next_follow_up_due && new Date(lead.next_follow_up_due) < new Date();

  const formattedValue = lead.expected_value
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
        lead.expected_value
      )
    : null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lastActive = lead.last_interaction_date ? new Date(lead.last_interaction_date) : new Date(lead.updated_at);
  const isStale = !['CONVERTED', 'LOST'].includes(lead.stage) && lastActive < sevenDaysAgo;
  const isFollowupNeeded =
    ['INTERESTED', 'QUALIFIED'].includes(lead.stage) &&
    (!lead.next_follow_up_due || lead.pending_followups_count === 0);

  return (
    <div
      onClick={onClick}
      className="card-elevation rounded-2xl p-5 cursor-pointer relative group flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Header: Customer Type & Stage Chip */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 block truncate leading-tight">
                {lead.customer_name || 'Individual Customer'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">
                {lead.customer_type} {lead.location_city ? `· ${lead.location_city}` : ''}
              </span>
            </div>
          </div>
          <LeadStageChip stage={lead.stage} size="sm" />
        </div>

        {/* Opportunity Title */}
        <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-[#0284C7] transition-colors mb-1.5">
          {lead.title}
        </h3>

        {/* Product / Service & Customer Response */}
        {lead.interested_product_service && (
          <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1.5 truncate">
            <span className="text-slate-400 text-[11px] font-semibold">Service:</span>
            <span className="text-slate-700 font-bold truncate">{lead.interested_product_service}</span>
          </div>
        )}

        {lead.customer_response && (
          <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-xl border border-slate-100/90 mb-3 line-clamp-1 italic">
            "{lead.customer_response}"
          </div>
        )}

        {/* Smart Attention Badges */}
        {(isStale || isFollowupNeeded) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {isFollowupNeeded && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse shadow-sm">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                Follow-up Needed
              </span>
            )}
            {isStale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
                <Clock className="w-3 h-3 text-amber-600" />
                Inactive (7+ days)
              </span>
            )}
          </div>
        )}

        {/* Opportunity details & value pill */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-semibold">
          <span className="bg-sky-50/90 text-[#0284C7] font-extrabold px-2.5 py-0.5 rounded-lg border border-sky-100/80 text-[11px]">
            {lead.lead_type}
          </span>
          {formattedValue && (
            <span className="bg-emerald-50 text-emerald-800 font-black px-2.5 py-0.5 rounded-lg border border-emerald-200/70 text-[11px]">
              {formattedValue}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider uppercase border ${
              lead.priority === 'HIGH'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : lead.priority === 'MEDIUM'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {lead.priority}
          </span>
        </div>
      </div>

      {/* Footer: Next action banner & Representative */}
      <div className="pt-3 border-t border-slate-100/90 flex flex-col gap-2">
        {lead.next_follow_up_due ? (
          <div
            className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
              isOverdue
                ? 'bg-rose-50/70 border-rose-200 text-rose-800 font-medium'
                : 'bg-slate-50/90 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate mr-2">
              {isOverdue ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate font-bold text-[11px]">
                {lead.next_follow_up_title || 'Next Action'}
              </span>
            </div>
            <span className="text-[10px] font-extrabold shrink-0">
              {new Date(lead.next_follow_up_due).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic flex items-center gap-1.5 px-1">
            <Clock className="w-3.5 h-3.5 text-slate-300" />
            <span>No pending action scheduled</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[9px]">
              {lead.employee_name ? lead.employee_name[0] : 'R'}
            </div>
            <span className="font-bold text-slate-600 text-[11px]">
              {lead.employee_name || 'Assigned Rep'}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">
            {new Date(lead.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
