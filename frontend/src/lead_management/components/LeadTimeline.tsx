import React from 'react';
import { History, ArrowRight, UserCheck, CheckCircle2, XCircle, FileText, Sparkles } from 'lucide-react';
import { LeadHistoryItem } from '../types';

interface LeadTimelineProps {
  timeline: LeadHistoryItem[];
}

export const LeadTimeline: React.FC<LeadTimelineProps> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm">
        <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No activity history recorded yet.</p>
      </div>
    );
  }

  const getEventBadge = (event: LeadHistoryItem) => {
    switch (event.event_type) {
      case 'CREATED':
        return {
          icon: Sparkles,
          bg: 'bg-blue-100 text-blue-700',
          title: 'Opportunity Created',
        };
      case 'STAGE_CHANGED':
        return {
          icon: ArrowRight,
          bg: 'bg-purple-100 text-purple-700',
          title: `Stage changed to ${event.new_value}`,
        };
      case 'ASSIGNED':
        return {
          icon: UserCheck,
          bg: 'bg-amber-100 text-amber-700',
          title: 'Opportunity Reassigned',
        };
      case 'CLOSED':
        return {
          icon: event.new_value === 'CONVERTED' ? CheckCircle2 : XCircle,
          bg: event.new_value === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
          title: `Opportunity Marked as ${event.new_value}`,
        };
      default:
        return {
          icon: FileText,
          bg: 'bg-slate-100 text-slate-700',
          title: event.event_type.replace('_', ' '),
        };
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {timeline.map((item) => {
        const badge = getEventBadge(item);
        const Icon = badge.icon;
        return (
          <div key={item.id} className="relative group">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${badge.bg}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Content box */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-xs text-slate-800">{badge.title}</span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(item.occurred_at).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {item.notes && <p className="text-xs text-slate-600 mt-1">{item.notes}</p>}

              <div className="mt-2 text-[10px] text-slate-400 font-semibold">
                By: <span className="text-slate-600">{item.actor_name || 'System / Employee'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
