import React, { useEffect, useState } from 'react';
import {
  Target as TargetIcon,
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  Edit2,
  Ban,
  Calendar,
  CalendarDays,
  Archive,
  Users,
} from 'lucide-react';
import { targetsApi } from '../api/targetsApi';
import { TargetDetailDTO } from '../types';
import { formatMetricValue, getMetricLabel } from '../components/TargetCard';
import { CreateTargetModal } from '../components/CreateTargetModal';
import { EditTargetModal } from '../components/EditTargetModal';
import { CancelTargetModal } from '../components/CancelTargetModal';
import { ManageHolidaysModal } from '../components/ManageHolidaysModal';

interface TargetsListPageProps {
  onSelectTarget: (targetId: string) => void;
  onNavigateToMyTargets?: () => void;
}

export const TargetsListPage: React.FC<TargetsListPageProps> = ({
  onSelectTarget,
  onNavigateToMyTargets,
}) => {
  const [targets, setTargets] = useState<TargetDetailDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [metricFilter, setMetricFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetDetailDTO | null>(null);
  const [cancellingTarget, setCancellingTarget] = useState<TargetDetailDTO | null>(null);
  const [holidaysModalOpen, setHolidaysModalOpen] = useState(false);

  const loadTargets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await targetsApi.listTargets({
        status: statusFilter === 'all' ? undefined : statusFilter,
        metric_type: metricFilter === 'all' ? undefined : metricFilter,
      });
      setTargets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load targets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();
  }, [statusFilter, metricFilter]);

  const filteredTargets = targets.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.metric_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F7F5] text-[#00897B] flex items-center justify-center border border-teal-100 shadow-sm">
            <TargetIcon className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Team Targets</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                Management
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Create, configure, and monitor targets for field executives, teams, and territories
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
          {onNavigateToMyTargets && (
            <button
              onClick={onNavigateToMyTargets}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              ← My Progress
            </button>
          )}

          <button
            onClick={() => setHolidaysModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <CalendarDays className="w-4 h-4 text-teal-600" />
            Holiday Calendar
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-[#00897B] hover:bg-[#00796B] transition-all shadow-sm shadow-teal-700/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Set New Target
          </button>

          <button
            onClick={loadTargets}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00897B]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60 overflow-x-auto">
          {(
            [
              { id: 'active', label: 'Active Targets' },
              { id: 'closed', label: 'Closed' },
              { id: 'cancelled', label: 'Cancelled' },
              { id: 'all', label: 'All Statuses' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === s.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Metric Selector & Search */}
        <div className="flex items-center gap-2">
          <select
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            className="px-3 py-2 rounded-2xl border border-slate-200/80 bg-white text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Metrics</option>
            <option value="doctor_visits">Doctor Visits</option>
            <option value="revenue">Revenue</option>
            <option value="collections">Collections</option>
            <option value="new_leads">New Leads</option>
            <option value="conversions">Conversions</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Target Items List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-3xl p-6 border border-[#EEF2F6] animate-pulse h-28" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl p-8 border border-rose-100 text-center space-y-3">
          <h4 className="font-black text-slate-900 text-base">Unable to load targets</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
          <button
            onClick={loadTargets}
            className="px-4 py-2 bg-[#00897B] text-white rounded-2xl text-xs font-bold hover:bg-[#00796B]"
          >
            Try Again
          </button>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-[#EEF2F6] text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#00897B] mx-auto flex items-center justify-center">
            <TargetIcon className="w-7 h-7" />
          </div>
          <h4 className="font-black text-slate-900 text-base">No targets found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No targets match the chosen status or metric filter. Click 'Set New Target' to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTargets.map((t) => {
            const isClosed = t.status === 'closed';
            const isCancelled = t.status === 'cancelled';
            const isArchived = Boolean(t.archived_at);

            return (
              <div
                key={t.id}
                className="bg-white rounded-3xl p-5 md:p-6 border border-[#EEF2F6] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 cursor-pointer" onClick={() => onSelectTarget(t.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      v{t.version}
                    </span>
                    <span className="text-[10px] font-bold text-[#00897B] uppercase tracking-wider">
                      {getMetricLabel(t.metric_type)}
                    </span>
                    {isArchived ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <Archive className="w-3 h-3" /> Archived
                      </span>
                    ) : isCancelled ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Cancelled
                      </span>
                    ) : isClosed ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Closed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    )}
                  </div>

                  <h3 className="text-base md:text-lg font-black text-slate-900 hover:text-[#00897B] transition-colors">
                    {t.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {t.start_date} to {t.end_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {t.assignments.length} {t.assignments.length === 1 ? 'assignee' : 'assignees'}
                    </span>
                  </div>
                </div>

                {/* Middle: Goal & Progress Sum */}
                <div className="flex items-center gap-6 px-0 md:px-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Goal
                    </span>
                    <span className="text-base md:text-lg font-black text-slate-900">
                      {formatMetricValue(t.target_value, t.metric_type)}
                    </span>
                  </div>

                  {t.final_value !== null ? (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Final Frozen
                      </span>
                      <span className="text-base md:text-lg font-black text-emerald-600">
                        {formatMetricValue(t.final_value, t.metric_type)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {!isCancelled && !isArchived && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTarget(t);
                        }}
                        className="p-2 text-slate-500 hover:text-[#00897B] hover:bg-slate-100 rounded-xl transition-colors"
                        title="Edit Target"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancellingTarget(t);
                        }}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Cancel Target"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => onSelectTarget(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-[#E6F7F5] text-slate-700 hover:text-[#00897B] text-xs font-bold transition-colors"
                  >
                    Details
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateTargetModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadTargets()}
      />

      {editingTarget && (
        <EditTargetModal
          target={editingTarget}
          isOpen={Boolean(editingTarget)}
          onClose={() => setEditingTarget(null)}
          onSuccess={() => {
            setEditingTarget(null);
            loadTargets();
          }}
        />
      )}

      {cancellingTarget && (
        <CancelTargetModal
          target={cancellingTarget}
          isOpen={Boolean(cancellingTarget)}
          onClose={() => setCancellingTarget(null)}
          onSuccess={() => {
            setCancellingTarget(null);
            loadTargets();
          }}
        />
      )}

      <ManageHolidaysModal
        isOpen={holidaysModalOpen}
        onClose={() => setHolidaysModalOpen(false)}
      />
    </div>
  );
};
