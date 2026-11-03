import React from 'react';
import { PlanItemResponse } from '../../types/plan';
import { PlanStopCard } from './PlanStopCard';
import { LunchBreakCard } from './LunchBreakCard';

interface PlanTimelineProps {
  items: PlanItemResponse[];
}

export const PlanTimeline: React.FC<PlanTimelineProps> = ({ items }) => {
  const sortedItems = [...items].sort((a, b) => a.sequence_order - b.sequence_order);

  if (sortedItems.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-[#EEF2F6] p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">No planned stops for this date.</p>
        <p className="text-xs text-slate-400">
          Click "Generate AI Sales Plan" to create an optimal itinerary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {sortedItems.map((item, index) => {
        const isLunch = item.activity_type === 'LUNCH_BREAK';

        return (
          <div key={item.id} className="relative">
            {/* Connecting line to next item */}
            {index < sortedItems.length - 1 && (
              <div
                className="absolute left-9 top-14 bottom-[-16px] w-0.5 bg-dashed border-l-2 border-slate-200 z-0 hidden md:block"
                aria-hidden="true"
              />
            )}

            <div className="relative z-10">
              {isLunch ? (
                <LunchBreakCard item={item} />
              ) : (
                <PlanStopCard item={item} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
