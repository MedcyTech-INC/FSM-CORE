import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Search,
  ChevronDown,
  List as ListIcon,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../api/client';
import { TaskItem } from '../types/api';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [assigneeFilter, setAssigneeFilter] = useState<'me' | 'all'>('me');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const loadTasks = async () => {
    try {
      const data = await api.listTasks();
      setTasks(data);
    } catch {
      // Empty fallback
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inCompleteCount = tasks.filter((t) => t.status !== 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Card matching localhost_9590_tasks.png */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F7F5] text-[#00897B] flex items-center justify-center border border-teal-100">
            <CheckSquare className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Work Assignment</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Daily work assignments, checklist progress, and completion records
            </p>
          </div>
        </div>

        {/* Right Action Button Groups */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          {/* Today vs All Dates */}
          <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'today'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              TODAY'S WORK
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ALL DATES / HISTORY
            </button>
          </div>

          {/* Assigned To Me vs All */}
          <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setAssigneeFilter('me')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                assigneeFilter === 'me'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ASSIGNED TO ME
            </button>
            <button
              onClick={() => setAssigneeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                assigneeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ALL ASSIGNMENTS
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center border border-slate-200/60">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Status KPI Cards matching localhost_9590_tasks.png */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Total */}
        <div className="bg-white p-6 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
            Today's Total
          </span>
          <span className="text-3xl font-black text-slate-900">{tasks.length}</span>
        </div>

        {/* In Progress */}
        <div className="bg-white p-6 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <span className="text-[11px] font-extrabold text-[#2563EB] uppercase tracking-wider block mb-2">
            In Progress
          </span>
          <span className="text-3xl font-black text-[#2563EB]">{inProgressCount}</span>
        </div>

        {/* Completed */}
        <div className="bg-white p-6 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <span className="text-[11px] font-extrabold text-[#10B981] uppercase tracking-wider block mb-2">
            Completed
          </span>
          <span className="text-3xl font-black text-[#10B981]">{completedCount}</span>
        </div>

        {/* In-Complete */}
        <div className="bg-white p-6 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <span className="text-[11px] font-extrabold text-[#E11D48] uppercase tracking-wider block mb-2">
            In-Complete
          </span>
          <span className="text-3xl font-black text-[#E11D48]">{inCompleteCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar matching screenshot */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-4 top-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search work description, notes, or employee..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]"
          />
        </div>

        <button className="px-5 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between gap-3 w-full sm:w-auto">
          <span>Filter Priority</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        <button className="px-5 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between gap-3 w-full sm:w-auto">
          <span>Filter Status</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Task List / Empty State Container */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        {tasks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
              <CheckSquare className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-600">No work assignments found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        t.priority === 'HIGH' || t.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-200/60 text-slate-700'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        t.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.title}</h4>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
