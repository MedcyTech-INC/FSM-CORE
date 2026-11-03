import React from 'react';
import { WhyBadge } from '../../types/plan';
import { Clock, TrendingUp, Target, Award, Calendar, AlertTriangle } from 'lucide-react';

interface WhyBadgePillProps {
  badge: WhyBadge;
}

export const WhyBadgePill: React.FC<WhyBadgePillProps> = ({ badge }) => {
  switch (badge.type) {
    case 'URGENCY':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>{badge.text}</span>
        </span>
      );
    case 'VALUE':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs">
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          <span>{badge.text}</span>
        </span>
      );
    case 'CONVERSION':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-xs">
          <TrendingUp className="w-3 h-3 text-teal-600" />
          <span>{badge.text}</span>
        </span>
      );
    case 'PACING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-xs">
          <Target className="w-3 h-3 text-[#00897B]" />
          <span>{badge.text}</span>
        </span>
      );
    case 'PRIORITY':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/80 shadow-xs">
          <Award className="w-3 h-3 text-purple-600" />
          <span>{badge.text}</span>
        </span>
      );
    case 'RECENCY':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shadow-xs">
          <Calendar className="w-3 h-3 text-blue-600" />
          <span>{badge.text}</span>
        </span>
      );
    case 'CHRONIC_BACKLOG':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80 shadow-xs">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          <span>{badge.text}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <span>{badge.text}</span>
        </span>
      );
  }
};
