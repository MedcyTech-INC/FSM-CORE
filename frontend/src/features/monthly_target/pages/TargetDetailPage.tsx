import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  Edit2,
  Ban,
  Clock,
  History,
} from 'lucide-react';
import { targetsApi } from '../api/targetsApi';
import { TargetDetailDTO } from '../types';
import { formatMetricValue, getMetricLabel } from '../components/TargetCard';
import { EditTargetModal } from '../components/EditTargetModal';
import { CancelTargetModal } from '../components/CancelTargetModal';

interface TargetDetailPageProps {
  targetId: string;
  onBack: () => void;
}

export const TargetDetailPage: React.FC<TargetDetailPageProps> = ({ targetId, onBack }) => {
  const [target, setTarget] = useState<TargetDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const loadDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await targetsApi.getTargetDetail(targetId);
      setTarget(data);
    } catch (err: any) {
      setError(err.message || 'Target not found or outside your scope.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [targetId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-[#EEF2F6] animate-pulse space-y-4">
        <div className="h-6 w-32 bg-slate-100 rounded-full" />
        <div className="h-8 w-64 bg-slate-100 rounded-lg" />
        <div className="h-40 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  if (error || !target) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-rose-100 text-center space-y-3">
        <h4 className="font-black text-slate-900 text-base">Error Loading Target</h4>
        <p className="text-xs text-slate-500">{error || 'Target not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-200"
        >
          ← Back to Targets List
        </button>
      </div>
    );
  }

  const isCancelled = target.status === 'cancelled';
  const isArchived = Boolean(target.archived_at);

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Team Targets
        </button>

        <div className="flex items-center gap-2">
          {!isCancelled && !isArchived && (
            <>
              <button
                onClick={() => setEditModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Target
              </button>
              <button
                onClick={() => setCancelModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel Target
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-800">
              Version {target.version}
            </span>
            <span className="text-xs font-bold text-[#00897B] uppercase tracking-wider">
              {getMetricLabel(target.metric_type)}
            </span>
            {target.adjusted_at && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <Clock className="w-3 h-3" /> Adjusted post-close
              </span>
            )}
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              isCancelled
                ? 'bg-rose-100 text-rose-800'
                : target.status === 'closed'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {target.status}
          </span>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{target.title}</h2>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500 mt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              {target.start_date} to {target.end_date}
            </span>
            <span>Created: {new Date(target.created_at).toLocaleDateString()}</span>
            {target.idempotency_key && (
              <span className="text-slate-400">Idempotency: {target.idempotency_key}</span>
            )}
          </div>
        </div>

        {/* Stats banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Target Value
            </span>
            <span className="text-xl md:text-2xl font-black text-slate-900 mt-1 block">
              {formatMetricValue(target.target_value, target.metric_type)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Assignees
            </span>
            <span className="text-xl md:text-2xl font-black text-slate-900 mt-1 block">
              {target.assignments.length}
            </span>
          </div>

          {target.final_value !== null && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Final Frozen Value
              </span>
              <span className="text-xl md:text-2xl font-black text-emerald-900 mt-1 block">
                {formatMetricValue(target.final_value, target.metric_type)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Assignees Progress Table */}
      <div className="bg-white rounded-3xl p-6 border border-[#EEF2F6] shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#00897B]" />
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Assignees & Progress</h3>
        </div>

        <div className="space-y-3">
          {target.assignments.map((asg) => {
            const current = asg.progress.current_value;
            const pct = target.target_value > 0 ? Math.round((current / target.target_value) * 100) : 0;
            return (
              <div
                key={asg.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border text-slate-700">
                      {asg.entity_type}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">ID: {asg.entity_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Assigned: {new Date(asg.assigned_at).toLocaleDateString()}
                    {asg.ended_at && ` · Ended: ${new Date(asg.ended_at).toLocaleDateString()}`}
                  </span>
                </div>

                <div className="flex items-center gap-4 sm:text-right">
                  <div>
                    <span className="text-base font-black text-slate-900 block">
                      {formatMetricValue(current, target.metric_type)}
                    </span>
                    <span className="text-xs font-bold text-[#00897B] block">{pct}% goal</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Change Audit History */}
      <div className="bg-white rounded-3xl p-6 border border-[#EEF2F6] shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Audit & Change History</h3>
        </div>

        {!target.changes || target.changes.length === 0 ? (
          <p className="text-xs text-slate-400">No revisions logged. Target is at initial version 1.</p>
        ) : (
          <div className="space-y-3">
            {target.changes.map((ch) => (
              <div key={ch.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    Version {ch.version} · Field: {ch.field}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(ch.changed_at).toLocaleString()}
                  </span>
                </div>
                {ch.old_value && ch.new_value && (
                  <p className="text-xs font-semibold text-slate-600">
                    Changed from <span className="font-mono text-slate-800">{ch.old_value}</span> to{' '}
                    <span className="font-mono text-emerald-700">{ch.new_value}</span>
                  </p>
                )}
                <p className="text-xs text-slate-700 italic">"{ch.reason}"</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {editModalOpen && (
        <EditTargetModal
          target={target}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={(updated) => {
            setTarget(updated);
            setEditModalOpen(false);
          }}
        />
      )}

      {cancelModalOpen && (
        <CancelTargetModal
          target={target}
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onSuccess={(updated) => {
            setTarget(updated);
            setCancelModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
