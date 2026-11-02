import React from 'react';
import { Check, XCircle } from 'lucide-react';
import { LeadStage } from '../types';

interface StageProgressBarProps {
  currentStage: LeadStage;
  onStageClick?: (stage: LeadStage) => void;
}

const STAGES: { stage: LeadStage; label: string }[] = [
  { stage: 'NEW', label: 'New Lead' },
  { stage: 'CONTACTED', label: 'Contacted' },
  { stage: 'INTERESTED', label: 'Interested' },
  { stage: 'QUALIFIED', label: 'Qualified' },
  { stage: 'CONVERTED', label: 'Converted' },
];

export const StageProgressBar: React.FC<StageProgressBarProps> = ({ currentStage, onStageClick }) => {
  const isLost = currentStage === 'LOST';
  const currentIndex = STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
          Pipeline Progression
        </span>
        {isLost ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>Opportunity Lost</span>
          </span>
        ) : (
          <span className="text-xs font-bold text-[#6B52B6]">
            Stage {currentIndex + 1} of {STAGES.length}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0 hidden sm:block">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isLost ? 'bg-rose-400' : 'bg-[#6B52B6]'
            }`}
            style={{
              width: isLost
                ? '100%'
                : `${Math.max(0, (currentIndex / (STAGES.length - 1)) * 100)}%`,
            }}
          />
        </div>

        {/* Stages Grid / Flex */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-0">
          {STAGES.map((s, idx) => {
            const isCompleted = !isLost && currentIndex > idx;
            const isCurrent = !isLost && currentIndex === idx;

            return (
              <div
                key={s.stage}
                onClick={() => onStageClick?.(s.stage)}
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all cursor-pointer group ${
                  isCurrent
                    ? 'sm:scale-105'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all shadow-sm ${
                    isCompleted
                      ? 'bg-[#6B52B6] text-white shadow-[#6B52B6]/20'
                      : isCurrent
                      ? 'bg-purple-100 text-[#6B52B6] ring-4 ring-purple-100/80 border-2 border-[#6B52B6]'
                      : isLost
                      ? 'bg-slate-100 text-slate-400 border border-slate-200'
                      : 'bg-white text-slate-500 border-2 border-slate-200 group-hover:border-purple-300'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <span
                  className={`text-xs mt-2 font-bold tracking-tight block ${
                    isCurrent
                      ? 'text-[#6B52B6] font-extrabold'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
