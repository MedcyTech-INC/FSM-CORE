import React from 'react';
import { LeadStage } from '../types';

interface LeadStageChipProps {
  stage: LeadStage | string;
  size?: 'sm' | 'md';
}

export const LeadStageChip: React.FC<LeadStageChipProps> = ({ stage, size = 'md' }) => {
  const stageStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    NEW: { bg: 'bg-sky-50/80', text: 'text-sky-800', border: 'border-sky-200/70', dot: 'bg-sky-500' },
    CONTACTED: { bg: 'bg-indigo-50/80', text: 'text-indigo-800', border: 'border-indigo-200/70', dot: 'bg-indigo-500' },
    INTERESTED: { bg: 'bg-amber-50/80', text: 'text-amber-800', border: 'border-amber-200/80', dot: 'bg-amber-500' },
    QUALIFIED: { bg: 'bg-purple-50/80', text: 'text-purple-800', border: 'border-purple-200/70', dot: 'bg-purple-500' },
    CONVERTED: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-300/80', dot: 'bg-emerald-600' },
    LOST: { bg: 'bg-slate-100/90', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  };

  const style = stageStyles[stage] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-lg border shadow-subtle ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`} />
      {stage}
    </span>
  );
};
