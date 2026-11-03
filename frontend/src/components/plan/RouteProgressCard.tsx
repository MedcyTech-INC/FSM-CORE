import React from 'react';
import { PlanResponse, MonthlyTargetResponse } from '../../types/plan';
import {
  Route,
  CheckCircle2,
  Clock,
  RefreshCw,
  GitCompare,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface RouteProgressCardProps {
  plan: PlanResponse;
  target: MonthlyTargetResponse | null;
  isActionLoading: boolean;
  onReplan: () => void;
  onReconcile: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  canApprove?: boolean;
}

export const RouteProgressCard: React.FC<RouteProgressCardProps> = ({
  plan,
  target,
  isActionLoading,
  onReplan,
  onReconcile,
  onApprove,
  onReject,
  canApprove = false,
}) => {
  const completedStops = plan.items.filter(
    (i) => i.status === 'COMPLETED' && i.activity_type !== 'LUNCH_BREAK'
  ).length;

  const totalVisitStops = plan.items.filter(
    (i) => i.activity_type !== 'LUNCH_BREAK'
  ).length;

  const progressPercent = totalVisitStops > 0
    ? Math.round((completedStops / totalVisitStops) * 100)
    : 0;

  const totalKm = (plan.total_planned_distance_meters / 1000).toFixed(1);
  const totalMins = Math.round(plan.total_planned_duration_seconds / 60);

  // Target pacing deficit
  const targetRevenue = target?.target_revenue || 0;
  const achievedRevenue = target?.achieved_revenue || 0;
  const targetDeficit = Math.max(0, targetRevenue - achievedRevenue);

  const formatCurrency = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Status & Plan Version Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
              AI Optimized Itinerary
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-[#0284C7] border border-sky-100 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              v{plan.version} &bull; {plan.revision_type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Date: <strong className="text-slate-700">{plan.plan_date}</strong> &bull; Engine:{' '}
            <span className="font-mono text-[11px] text-slate-600">{plan.routing_engine}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Plan Status Badge */}
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
              plan.status === 'APPROVED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : plan.status === 'IN_PROGRESS'
                ? 'bg-sky-50 text-[#0284C7] border-sky-200 animate-pulse'
                : plan.status === 'COMPLETED'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {plan.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">Commercial Visits Done</span>
          <span className="font-extrabold text-[#0284C7]">
            {completedStops} of {totalVisitStops} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-[#0284C7] to-[#38BDF8] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 4 Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Stops */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stops</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {completedStops} / {totalVisitStops}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {plan.items.length - totalVisitStops > 0 ? '+1 Repast' : ''}
          </div>
        </div>

        {/* Distance */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Route className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>Route Distance</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {totalKm} km
          </div>
          <div className="text-[10px] text-slate-400 font-medium">OSRM Optimized</div>
        </div>

        {/* Duration */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Transit Time</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {totalMins} min
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Travel budget</div>
        </div>

        {/* Target Pacing / Deficit */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            <span>Target Pacing</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {target ? formatCurrency(achievedRevenue) : '₹0'}
          </div>
          <div className="text-[10px] text-slate-400 font-medium truncate">
            {target ? `Deficit: ${formatCurrency(targetDeficit)}` : 'Monthly Target'}
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Midday Replan Button */}
          <button
            onClick={onReplan}
            disabled={isActionLoading || plan.status === 'COMPLETED'}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 flex-1 sm:flex-initial cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isActionLoading ? 'animate-spin' : ''}`} />
            <span>Midday Replan</span>
          </button>

          {/* Sync / Reconcile Button */}
          <button
            onClick={onReconcile}
            disabled={isActionLoading}
            className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 flex-1 sm:flex-initial cursor-pointer"
            title="Reconcile obligations with external CRM updates"
          >
            <GitCompare className="w-3.5 h-3.5 text-slate-500" />
            <span>Sync</span>
          </button>
        </div>

        {canApprove && ['PENDING_APPROVAL', 'DRAFT'].includes(plan.status) && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onReject && (
              <button
                onClick={onReject}
                disabled={isActionLoading}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 flex-1 sm:flex-initial cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Reject</span>
              </button>
            )}
            {onApprove && (
              <button
                onClick={onApprove}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm shadow-[#0284C7]/20 transition-all hover:scale-[1.01] disabled:opacity-50 flex-1 sm:flex-initial cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Approve</span>
              </button>
            )}
          </div>
        )}

        {plan.status === 'APPROVED' && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 w-full sm:w-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Approved by Alex Vance</span>
          </div>
        )}

        {plan.status === 'REJECTED' && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-800 bg-rose-50 px-3.5 py-1.5 rounded-xl border border-rose-200 w-full sm:w-auto">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate">Route Rejected &bull; Awaiting Re-generation</span>
          </div>
        )}
      </div>
    </div>
  );
};
