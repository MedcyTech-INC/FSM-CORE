import React from 'react';
import { PlanItemResponse } from '../../types/plan';
import { Coffee, Clock, ShieldCheck } from 'lucide-react';

interface LunchBreakCardProps {
  item: PlanItemResponse;
}

export const LunchBreakCard: React.FC<LunchBreakCardProps> = ({ item }) => {
  const arrival = item.planned_arrival_time
    ? item.planned_arrival_time.substring(0, 5)
    : '13:00';
  const departure = item.planned_departure_time
    ? item.planned_departure_time.substring(0, 5)
    : '13:45';

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-slate-50 border border-amber-200/70 p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300/60 flex items-center justify-center text-amber-700 shadow-xs shrink-0">
            <Coffee className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-slate-800 text-sm tracking-tight">
                Midday Repast & Rest Window
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/70 uppercase tracking-wider">
                45 Minutes
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Approved labor policy pause scheduled between 13:00 and 14:15.
            </p>
          </div>
        </div>

        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/50">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {arrival} &ndash; {departure}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Non-billable pause
          </span>
        </div>
      </div>
    </div>
  );
};
