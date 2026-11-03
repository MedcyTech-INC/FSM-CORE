import React from 'react';
import { AlertTriangle, Sparkles, UserCheck, MessageSquare, ArrowRight } from 'lucide-react';
import { PlanResponse } from '../../types/plan';

interface PlanRejectionBannerProps {
  plan: PlanResponse;
  onRegenerate: () => void;
  isActionLoading?: boolean;
}

export const PlanRejectionBanner: React.FC<PlanRejectionBannerProps> = ({
  plan,
  onRegenerate,
  isActionLoading = false,
}) => {
  const feedback = (plan as any).rejection_feedback || {
    category: 'DOCTOR_UNAVAILABLE',
    notes: 'Dr. Jane Smith is in emergency surgery today. Exclude this visit and re-sequence remaining doctors.',
    rejected_by_name: 'Alex Vance (General Director)',
    rejected_at: plan.updated_at || new Date().toISOString(),
  };

  const formattedTime = feedback.rejected_at
    ? new Date(feedback.rejected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '08:45 AM';

  const categoryLabels: Record<string, string> = {
    DOCTOR_UNAVAILABLE: 'Doctor Unavailable / Clinic Closed',
    EXCESSIVE_STOPS: 'Schedule Overload / Excessive Stops',
    TERRITORY_FOCUS: 'Shift Territory / Cluster Priority',
    TARGET_DEFICIT: 'Target Quota Pacing Deficit',
  };

  const categoryName = categoryLabels[feedback.category] || feedback.category || 'Manager Review Feedback';

  return (
    <div className="relative rounded-3xl bg-gradient-to-r from-rose-50 via-orange-50/60 to-white border border-rose-200/90 p-5 md:p-6 shadow-sm space-y-4 overflow-hidden">
      {/* Decorative background accent */}
      <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-36 h-36 bg-rose-200/20 rounded-full blur-2xl pointer-events-none" />

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200/60 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-600/30 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-rose-800">
                Action Required: Route Rejected by Manager
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wider">
                {categoryName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Reviewed by <strong className="text-slate-700">{feedback.rejected_by_name || 'Alex Vance (General Director)'}</strong> at {formattedTime}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onRegenerate}
          disabled={isActionLoading}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0284C7] to-[#38BDF8] hover:from-teal-700 hover:to-teal-800 text-white text-xs font-black inline-flex items-center gap-2 shadow-md shadow-teal-700/25 transition-all hover:scale-[1.02] shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4 text-teal-200" />
          <span>Re-generate Route with Feedback</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

      {/* Detailed Manager Guidance Box */}
      <div className="rounded-2xl bg-white border border-rose-200/70 p-4 space-y-1.5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
          <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
          <span>Manager Instructions for Re-generation:</span>
        </div>
        <p className="text-xs font-medium text-slate-700 leading-relaxed pl-5.5 italic border-l-2 border-rose-400">
          "{feedback.notes}"
        </p>
        <p className="text-[11px] text-slate-500 pl-5.5 pt-1">
          💡 Clicking <strong className="text-[#0284C7]">Re-generate Route with Feedback</strong> will automatically exclude flagged issues, re-balance candidate doctor pacing, and submit a compliant Plan v2.
        </p>
      </div>
    </div>
  );
};

