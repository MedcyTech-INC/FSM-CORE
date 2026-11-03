import React from 'react';
import { PlanItemResponse, WhyBadge } from '../../types/plan';
import { WhyBadgePill } from './WhyBadgePill';
import {
  Navigation,
  CheckCircle2,
  Clock,
  Car,
  MapPin,
  CheckSquare,
  RotateCcw,
  Sparkles,
  Shield,
  FileCheck,
} from 'lucide-react';

interface PlanStopCardProps {
  item: PlanItemResponse;
}

export const PlanStopCard: React.FC<PlanStopCardProps> = ({ item }) => {
  const arrival = item.planned_arrival_time
    ? item.planned_arrival_time.substring(0, 5)
    : '--:--';
  const departure = item.planned_departure_time
    ? item.planned_departure_time.substring(0, 5)
    : '--:--';

  const badges: WhyBadge[] = item.recommendation_reasons?.badges || [];
  const transitMinutes = Math.round(item.transit_duration_s / 60);
  const transitKm = (item.transit_distance_m / 1000).toFixed(1);

  const isPending = item.status === 'PENDING';
  const isCompleted = item.status === 'COMPLETED';
  const isSkipped = item.status === 'SKIPPED';
  const isExternallyResolved = item.status === 'EXTERNALLY_RESOLVED';

  const hasCoords = item.latitude != null && item.longitude != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
    : '#';

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
        isCompleted
          ? 'bg-white border-slate-200/90'
          : isSkipped
          ? 'bg-slate-50/80 border-slate-200 opacity-75'
          : 'bg-white border-[#EEF2F6]'
      }`}
    >
      {/* Top Transit Banner (if transit distance > 0) */}
      {item.transit_distance_m > 0 && (
        <div className="bg-slate-50/90 border-b border-slate-100 px-5 py-2 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Travel: <strong className="text-slate-700">{transitMinutes} mins</strong> ({transitKm} km)
            </span>
          </div>
          {hasCoords && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#0284C7] hover:text-[#0284C7] font-bold hover:underline"
            >
              <Navigation className="w-3 h-3" />
              <span>Navigate</span>
            </a>
          )}
        </div>
      )}

      {/* Main Card Body */}
      <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        {/* Header: Sequence, Time, Stop Type & Status */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-sky-50 text-[#0284C7] border border-sky-200/80'
              }`}
            >
              #{item.sequence_order}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">
                  {arrival} – {departure}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({item.estimated_duration_minutes}m visit)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stop Type Tag */}
            {item.stop_type === 'MANAGER_MANDATORY' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 uppercase tracking-wider">
                <Shield className="w-3 h-3" />
                Mandatory
              </span>
            )}
            {item.stop_type === 'AI_RECOMMENDED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#0284C7]" />
                AI Pick
              </span>
            )}

            {/* Status Pill */}
            {isPending && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                Planned
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Completed
              </span>
            )}
            {isSkipped && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 uppercase tracking-wider">
                <RotateCcw className="w-3 h-3" />
                Skipped
              </span>
            )}
            {isExternallyResolved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                External Sync
              </span>
            )}
          </div>
        </div>

        {/* Lead / Customer Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-slate-900 text-base md:text-lg leading-tight tracking-tight">
              {item.recommendation_reasons?.doctor_name || item.location_address || 'Scheduled Commercial Stop'}
            </h3>
            {item.recommendation_reasons?.lead_title && (
              <span className="text-[11px] font-bold text-[#0284C7] bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-lg">
                {item.recommendation_reasons.lead_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{item.location_address || 'Customer site location'}</span>
          </div>
        </div>

        {/* Obligations Checklist */}
        {item.obligations && item.obligations.length > 0 && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#0284C7]" />
                Key Obligations ({item.obligations.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {item.obligations.map((obl) => (
                <div
                  key={obl.id}
                  className="flex items-start justify-between gap-2 text-xs bg-white p-2 rounded-xl border border-slate-100"
                >
                  <div className="flex items-start gap-2">
                    <FileCheck
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        obl.fulfillment_status === 'FULFILLED'
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span className="font-semibold text-slate-800">{obl.obligation_title}</span>
                      {obl.is_mandatory && (
                        <span className="ml-1.5 text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded uppercase">
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      obl.fulfillment_status === 'FULFILLED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {obl.fulfillment_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why Badges Rationale */}
        {badges.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Recommendation Rationale:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b, idx) => (
                <WhyBadgePill key={idx} badge={b} />
              ))}
            </div>
          </div>
        )}

        {/* Footer: Directions & Itinerary Context */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {hasCoords ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                title="Preview stop location in Google Maps"
              >
                <Navigation className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Directions</span>
              </a>
            ) : (
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-300" />
                Location mapped
              </span>
            )}
          </div>

          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>Planned Itinerary Stop • Proof & Check-in via Visit Log</span>
          </div>
        </div>
      </div>
    </div>
  );
};
