import React, { useEffect, useState } from 'react';
import {
  Target as TargetIcon,
  TrendingUp,
  Calendar,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { targetsApi } from '../api/targetsApi';
import { MyProgressItemDTO, TargetState } from '../types';
import { TargetCard } from '../components/TargetCard';

interface MyTargetsPageProps {
  onNavigateToTeamTargets?: () => void;
  canManageTargets?: boolean;
}

export const MyTargetsPage: React.FC<MyTargetsPageProps> = ({
  onNavigateToTeamTargets,
  canManageTargets = false,
}) => {
  const [items, setItems] = useState<MyProgressItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | TargetState>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProgress = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await targetsApi.getMyProgress();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load targets progress');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesState = stateFilter === 'all' || item.state === stateFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.metric_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.scope.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesState && matchesSearch;
  });

  const totalTargets = items.length;
  const achievedTargets = items.filter((i) => i.state === 'achieved').length;
  const activeTargets = items.filter((i) => i.state === 'active').length;
  const avgCompletion =
    items.length > 0
      ? Math.round(
          items.reduce((acc, curr) => acc + (curr.percent_complete || 0), 0) / items.length
        )
      : 0;

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
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Monthly Targets</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E6F7F5] text-[#00897B] uppercase tracking-wider">
                My Progress
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Active individual goals and shared team, territory, and branch quotas
            </p>
          </div>
        </div>

        {/* Right Action Switcher (if manager) & Refresh */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          {canManageTargets && onNavigateToTeamTargets && (
            <button
              onClick={onNavigateToTeamTargets}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              Manage Team Targets →
            </button>
          )}

          <button
            onClick={loadProgress}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh Progress"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00897B]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-5 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Targets</span>
            <TargetIcon className="w-4 h-4 text-[#00897B]" />
          </div>
          <span className="text-2xl md:text-3xl font-black text-slate-900">{activeTargets}</span>
          <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
            of {totalTargets} assigned
          </span>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Achieved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl md:text-3xl font-black text-slate-900">{achievedTargets}</span>
          <span className="text-[11px] font-medium text-emerald-600 font-bold block mt-0.5">
            {totalTargets > 0 ? `${Math.round((achievedTargets / totalTargets) * 100)}% rate` : '0%'}
          </span>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Completion</span>
            <TrendingUp className="w-4 h-4 text-[#00897B]" />
          </div>
          <span className="text-2xl md:text-3xl font-black text-slate-900">{avgCompletion}%</span>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-[#00897B] rounded-full"
              style={{ width: `${Math.min(100, avgCompletion)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-[#EEF2F6] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Days in Cycle</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-2xl md:text-3xl font-black text-slate-900">
            {items[0]?.days_left ?? 14}
          </span>
          <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
            Mon-Sat working days
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* State Filter Pills */}
        <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Targets' },
              { id: 'active', label: 'Active' },
              { id: 'achieved', label: 'Achieved' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'ended_short', label: 'Ended' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStateFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                stateFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search targets or metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-2xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20"
          />
        </div>
      </div>

      {/* Targets List or Empty / Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-3xl p-6 border border-[#EEF2F6] animate-pulse space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-32 bg-slate-100 rounded-full" />
                <div className="h-6 w-20 bg-slate-100 rounded-full" />
              </div>
              <div className="h-5 w-48 bg-slate-100 rounded-lg" />
              <div className="h-4 w-full bg-slate-100 rounded-full mt-4" />
              <div className="grid grid-cols-3 gap-2 pt-4">
                <div className="h-12 bg-slate-50 rounded-2xl" />
                <div className="h-12 bg-slate-50 rounded-2xl" />
                <div className="h-12 bg-slate-50 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl p-8 border border-rose-100 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-black text-slate-900 text-base">Unable to load targets</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
          <button
            onClick={loadProgress}
            className="px-4 py-2 bg-[#00897B] text-white rounded-2xl text-xs font-bold hover:bg-[#00796B]"
          >
            Try Again
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-[#EEF2F6] text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#00897B] mx-auto flex items-center justify-center">
            <TargetIcon className="w-7 h-7" />
          </div>
          <h4 className="font-black text-slate-900 text-base">No targets found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || stateFilter !== 'all'
              ? 'No targets match your current search or filter criteria.'
              : 'You have no active targets assigned for this period.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <TargetCard key={`${item.target_id}-${item.scope}-${item.entity_id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
