import React from 'react';
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  Users,
  MapPin,
  Building2,
  User,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { MyProgressItemDTO, MetricType, EntityType, TargetState } from '../types';

interface TargetCardProps {
  item: MyProgressItemDTO;
  onClickDetail?: () => void;
}

export const formatMetricValue = (val: number, metricType: MetricType): string => {
  if (metricType === 'revenue' || metricType === 'collections') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
};

export const getMetricLabel = (metric: MetricType): string => {
  switch (metric) {
    case 'revenue':
      return 'Revenue';
    case 'doctor_visits':
      return 'Doctor Visits';
    case 'new_leads':
      return 'New Leads';
    case 'conversions':
      return 'Conversions';
    case 'collections':
      return 'Collections';
    default:
      return metric;
  }
};

const getScopeBadge = (scope: EntityType) => {
  switch (scope) {
    case 'representative':
      return {
        label: 'My Individual Target',
        icon: User,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      };
    case 'team':
      return {
        label: 'Team Target',
        icon: Users,
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      };
    case 'territory':
      return {
        label: 'Territory Target',
        icon: MapPin,
        bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      };
    case 'branch':
      return {
        label: 'Branch Target',
        icon: Building2,
        bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
      };
    default:
      return {
        label: scope,
        icon: Users,
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
      };
  }
};

const getStateBadge = (state: TargetState) => {
  switch (state) {
    case 'achieved':
      return {
        label: 'Achieved',
        icon: CheckCircle2,
        className: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
      };
    case 'active':
      return {
        label: 'Active',
        icon: TrendingUp,
        className: 'bg-[#00897B] text-white shadow-sm shadow-teal-700/20',
      };
    case 'upcoming':
      return {
        label: 'Upcoming',
        icon: Calendar,
        className: 'bg-sky-100 text-sky-800 border border-sky-200',
      };
    case 'ended_short':
      return {
        label: 'Ended Short',
        icon: AlertCircle,
        className: 'bg-rose-100 text-rose-800 border border-rose-200',
      };
  }
};

export const TargetCard: React.FC<TargetCardProps> = ({ item, onClickDetail }) => {
  const scopeInfo = getScopeBadge(item.scope);
  const stateInfo = getStateBadge(item.state);
  const ScopeIcon = scopeInfo.icon;
  const StateIcon = stateInfo.icon;

  const percent = item.percent_complete !== null ? Math.round(item.percent_complete) : 0;
  // Progress bar visual width capped at 100% for bar, but label shows uncapped e.g. 120%
  const barWidth = Math.min(100, Math.max(0, percent));
  const isOverAchieved = percent > 100;
  const isGroupTarget = item.scope !== 'representative';

  return (
    <div
      onClick={onClickDetail}
      className={`bg-white rounded-3xl p-5 md:p-6 border border-[#EEF2F6] shadow-sm hover:shadow-md transition-all ${
        onClickDetail ? 'cursor-pointer' : ''
      }`}
    >
      {/* Header Row: Scope pill, State badge, and Adjusted tag */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${scopeInfo.bg}`}
          >
            <ScopeIcon className="w-3.5 h-3.5" />
            {scopeInfo.label}
          </span>

          {item.adjusted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <Clock className="w-3 h-3" />
              Adjusted
            </span>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${stateInfo.className}`}
        >
          <StateIcon className="w-3.5 h-3.5" />
          {stateInfo.label}
        </span>
      </div>

      {/* Target Title & Metric */}
      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-snug">
              {item.title}
            </h3>
            <span className="text-xs font-bold text-[#00897B] uppercase tracking-wider block mt-0.5">
              {getMetricLabel(item.metric_type)}
            </span>
          </div>

          {/* Over-achievement Celebration Badge */}
          {isOverAchieved && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>+{percent - 100}% Exceeded</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {formatMetricValue(item.current_value, item.metric_type)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              / {formatMetricValue(item.target_value, item.metric_type)}
            </span>
          </div>
          <span
            className={`text-sm md:text-base font-black ${
              isOverAchieved ? 'text-emerald-600' : 'text-[#00897B]'
            }`}
          >
            {item.percent_complete !== null ? `${item.percent_complete}%` : '—'}
          </span>
        </div>

        {/* The Track & Fill */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverAchieved
                ? 'bg-gradient-to-r from-[#00897B] to-emerald-500'
                : 'bg-gradient-to-r from-[#00897B] to-[#26A69A]'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Metrics Highlights Grid (Optimized for 360px+ screens) */}
      <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Gap Remaining */}
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Gap Remaining
          </span>
          <span className="text-sm font-black text-slate-800 block mt-1">
            {formatMetricValue(item.gap_remaining, item.metric_type)}
          </span>
        </div>

        {/* Own Contribution (on team/territory/branch targets) */}
        {isGroupTarget ? (
          <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-100/80">
            <span className="text-[10px] font-bold text-[#00897B] uppercase tracking-wider block">
              My Own Share
            </span>
            <span className="text-sm font-black text-slate-900 block mt-1">
              {formatMetricValue(item.own_contribution, item.metric_type)}
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Period
            </span>
            <span className="text-xs font-bold text-slate-700 block mt-1 truncate">
              {item.start_date.slice(5)} to {item.end_date.slice(5)}
            </span>
          </div>
        )}

        {/* Working Days Left */}
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Working Days Left
          </span>
          <span className="text-sm font-black text-slate-800 block mt-1">
            {item.days_left} {item.days_left === 1 ? 'day' : 'days'}
          </span>
        </div>

        {/* Required Daily Run Rate */}
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Required Run Rate
          </span>
          <span className="text-sm font-black text-slate-800 block mt-1">
            {item.required_daily_run_rate !== null ? (
              `${formatMetricValue(item.required_daily_run_rate, item.metric_type)}/day`
            ) : item.gap_remaining > 0 ? (
              <span className="text-rose-600 text-xs font-extrabold">No days left</span>
            ) : (
              <span className="text-emerald-600 text-xs font-extrabold">Completed</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
