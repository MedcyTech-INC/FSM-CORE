import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Info,
  Layers,
} from 'lucide-react';
import { AlertDetailDTO, AttentionPriority } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';
import { AlertActionModal } from '../components/AlertActionModal';

interface AlertDetailPageProps {
  alertId: string;
  onBack: () => void;
  onSelectOccurrence?: (occurrenceId: string) => void;
}

export const AlertDetailPage: React.FC<AlertDetailPageProps> = ({
  alertId,
  onBack,
  onSelectOccurrence,
}) => {
  const [alert, setAlert] = useState<AlertDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await revenueLeakageApi.fetchAlertDetail(alertId);
      setAlert(data);
    } catch {
      // Mock fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [alertId]);

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm animate-pulse">
        <Clock className="w-8 h-8 text-[#00897B] animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">Loading operational warning details...</p>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-100">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Warning Record Not Found</h3>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-xs font-bold text-[#00897B] bg-[#F0FDF9] rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const getPriorityBadge = (priority: AttentionPriority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            HIGH ATTENTION
          </span>
        );
      case 'medium':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            MEDIUM ATTENTION
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
            LOW ATTENTION
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Operational Warnings</span>
        </button>

        {alert.status === 'active' && (
          <button
            onClick={() => setShowActionModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] rounded-xl shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Record Action</span>
          </button>
        )}
      </div>

      {/* Main Alert Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-[#00897B] font-extrabold text-[11px] border border-teal-100 uppercase tracking-wide">
                {alert.rule_name}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-bold text-slate-500 uppercase">
                Status: {alert.status}
              </span>
              {alert.occurrence_no > 1 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Episode #{alert.occurrence_no}
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {alert.entity_label}
            </h1>
          </div>
          <div>{getPriorityBadge(alert.attention_priority)}</div>
        </div>

        {/* Reason Banner */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#00897B] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-0.5">Observation Summary</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {alert.priority_reason}
              </p>
            </div>
          </div>
        </div>

        {/* Reference Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              First Detected
            </span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(alert.first_detected_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Last Verified
            </span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {new Date(alert.last_observed_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Reference Exposure
            </span>
            {alert.exposure_amount && alert.exposure_basis ? (
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">
                  INR {Number(alert.exposure_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">Basis: {alert.exposure_basis}</span>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-400">None calculated</span>
            )}
          </div>
        </div>

        {/* Suggested Operational Check */}
        {alert.observation?.suggested_check && (
          <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 text-xs">
            <span className="font-extrabold text-[#00897B] uppercase tracking-wider block mb-1">
              Suggested Supervisory Action
            </span>
            <p className="text-slate-700 font-medium">
              {alert.observation.suggested_check}
            </p>
          </div>
        )}
      </div>

      {/* Earlier Occurrences Chain (P-16) */}
      {alert.occurrences && alert.occurrences.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="w-4 h-4 text-[#00897B]" />
            <h3 className="text-sm font-bold text-slate-900">Historical Warning Chain</h3>
          </div>
          <div className="space-y-2">
            {alert.occurrences.map((occ) => (
              <div
                key={occ.id}
                onClick={() => onSelectOccurrence && onSelectOccurrence(occ.id)}
                className={`flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs ${
                  onSelectOccurrence ? 'cursor-pointer hover:border-teal-200' : ''
                }`}
              >
                <div>
                  <span className="font-bold text-slate-800">Occurrence #{occ.occurrence_no}</span>
                  <span className="text-slate-400 ml-2">
                    {new Date(occ.first_detected_at).toLocaleDateString('en-IN')}
                    {occ.resolved_at && ` → Resolved ${new Date(occ.resolved_at).toLocaleDateString('en-IN')}`}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                  {occ.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supervisory Actions & Observations Log */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <History className="w-4 h-4 text-[#00897B]" />
          <h3 className="text-sm font-bold text-slate-900">Recorded Actions & State Changes</h3>
        </div>

        {alert.actions && alert.actions.length > 0 ? (
          <div className="space-y-3">
            {alert.actions.map((act) => (
              <div
                key={act.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wide">
                    {act.action_type.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(act.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-slate-700 font-medium">{act.action_taken}</p>
                {act.outcome && (
                  <div className="text-[11px] text-[#00897B] font-bold">
                    Outcome: {act.outcome.replace('_', ' ')}
                  </div>
                )}
                {act.evidence_reference && (
                  <div className="text-[11px] text-slate-500 font-medium">
                    Evidence Ref: {act.evidence_reference}
                  </div>
                )}
                {act.notes && (
                  <p className="text-[11px] text-slate-500 italic">Notes: {act.notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">
            No supervisory actions have been recorded yet for this operational warning.
          </p>
        )}
      </div>

      {/* Action Dialog */}
      {showActionModal && (
        <AlertActionModal
          alert={alert}
          isOpen={true}
          onClose={() => setShowActionModal(false)}
          onSuccess={() => {
            setShowActionModal(false);
            loadDetail();
          }}
        />
      )}
    </div>
  );
};
