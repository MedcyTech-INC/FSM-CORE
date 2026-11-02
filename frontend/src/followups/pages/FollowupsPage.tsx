import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  Plus,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { useFollowupsStore } from '../store';
import { FollowupTab } from '../types';
import { FollowupCard } from '../components/FollowupCard';
import { FollowupFormPage } from './FollowupFormPage';

export const FollowupsPage: React.FC = () => {
  const {
    followups,
    dueSummary,
    activeTab,
    scope,
    isLoading,
    fetchFollowups,
    fetchDueSummary,
    setActiveTab,
    setScope,
  } = useFollowupsStore();

  const [isCreatingFollowup, setIsCreatingFollowup] = useState(false);

  useEffect(() => {
    fetchDueSummary();
    fetchFollowups();
  }, [fetchDueSummary, fetchFollowups]);

  const tabs: { id: FollowupTab; label: string; count?: number; isDanger?: boolean }[] = [
    { id: 'due_today', label: 'Due Today', count: dueSummary?.due_today },
    { id: 'overdue', label: 'Overdue', count: dueSummary?.overdue, isDanger: (dueSummary?.overdue ?? 0) > 0 },
    { id: 'upcoming', label: 'Upcoming', count: dueSummary?.upcoming },
    { id: 'completed', label: 'Completed', count: dueSummary?.completed_today },
    { id: 'all', label: 'All Actions' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200/70 text-[#6B52B6] text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-subtle">
            <BellRing className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Field Commitment Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Follow-ups & Next Actions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Schedule and fulfill promises made to doctors, clinics, and hospital partners
          </p>
        </div>

        <button
          onClick={() => setIsCreatingFollowup(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#6B52B6] via-[#7B61C9] to-[#8C74DC] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-glow-brand transition-all transform active:scale-95 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Schedule Next Action</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-purple-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[#6B52B6] uppercase tracking-widest block">
              Due Today
            </span>
            <span className="text-2xl sm:text-3xl font-black text-purple-950 mt-1 block tracking-tight">
              {dueSummary?.due_today ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6B52B6] flex items-center justify-center group-hover:scale-105 transition-transform">
            <CalendarDays className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border shadow-card flex items-center justify-between transition-all ${
            (dueSummary?.overdue ?? 0) > 0
              ? 'bg-rose-50/80 border-rose-200/90 text-rose-800'
              : 'bg-white border-slate-200/80 text-slate-900 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest block">
              Overdue Actions
            </span>
            <span className="text-2xl sm:text-3xl font-black text-rose-800 mt-1 block tracking-tight">
              {dueSummary?.overdue ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100/90 text-rose-700 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-blue-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest block">
              Upcoming
            </span>
            <span className="text-2xl sm:text-3xl font-black text-blue-900 mt-1 block tracking-tight">
              {dueSummary?.upcoming ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-emerald-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest block">
              Completed Today
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1 block tracking-tight">
              {dueSummary?.completed_today ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Tabs & Scope Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {tabs.map((t) => {
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-[#6B52B6] text-white shadow-glow-brand'
                    : t.isDanger
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/70'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
                }`}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : t.isDanger
                        ? 'bg-rose-200 text-rose-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scope selector */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl shrink-0 self-end sm:self-auto border border-slate-200/60">
          <button
            onClick={() => setScope('all')}
            className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
              scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Team
          </button>
          <button
            onClick={() => setScope('my')}
            className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
              scope === 'my' ? 'bg-white text-[#6B52B6] shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            My Follow-ups
          </button>
        </div>
      </div>

      {/* Follow-up List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100/80 animate-pulse border border-slate-200/60" />
          ))}
        </div>
      ) : followups.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 shadow-subtle px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Clock className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">No follow-ups for this filter</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
            {activeTab === 'overdue'
              ? 'Awesome job! You have zero overdue actions.'
              : 'You have no scheduled follow-up commitments under this tab.'}
          </p>
          <button
            onClick={() => setIsCreatingFollowup(true)}
            className="mt-4 px-4 py-2 bg-purple-50 text-[#6B52B6] text-xs font-extrabold rounded-xl hover:bg-purple-100 border border-purple-200/70 shadow-subtle cursor-pointer"
          >
            + Schedule an Action
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {followups.map((fup) => (
            <FollowupCard key={fup.id} followup={fup} onRefresh={fetchFollowups} />
          ))}
        </div>
      )}

      {/* Modal Popup Sheet for Schedule Follow-up */}
      {isCreatingFollowup &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 font-sans">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200"
              onClick={() => setIsCreatingFollowup(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl z-10 overflow-y-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <FollowupFormPage
                onClose={() => {
                  setIsCreatingFollowup(false);
                  fetchFollowups();
                  fetchDueSummary();
                }}
                onCreated={() => {
                  setIsCreatingFollowup(false);
                  fetchFollowups();
                  fetchDueSummary();
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
