import React from 'react';
import { FollowupStatus } from '../types';

interface FollowupStatusBadgeProps {
  status: FollowupStatus | string;
  isOverdue?: boolean;
}

export const FollowupStatusBadge: React.FC<FollowupStatusBadgeProps> = ({ status, isOverdue }) => {
  if (isOverdue && status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        OVERDUE
      </span>
    );
  }

  const styles: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  };

  const current = styles[status] || styles.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider border ${current.bg} ${current.text} ${current.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
};
