import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  Briefcase,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useLeadsStore } from '../store';
import { LeadStage } from '../types';
import { LeadCard } from '../components/LeadCard';
import { LeadDetailPage } from './LeadDetailPage';
import { LeadFormPage } from './LeadFormPage';

const STAGE_FILTERS: { value: LeadStage | 'ALL' | 'ATTENTION'; label: string }[] = [
  { value: 'ALL', label: 'All Pipeline' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
  { value: 'ATTENTION', label: '⚠️ Needs Attention' },
];

export const LeadsPage: React.FC = () => {
  const {
    leads,
    summary,
    activeStage,
    scope,
    searchQuery,
    isLoading,
    fetchLeads,
    fetchSummary,
    setActiveStage,
    setScope,
    setSearchQuery,
  } = useLeadsStore();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [filterAttentionOnly, setFilterAttentionOnly] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchLeads();
  }, [fetchSummary, fetchLeads]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  const handleStageFilterClick = (val: LeadStage | 'ALL' | 'ATTENTION') => {
    if (val === 'ATTENTION') {
      setFilterAttentionOnly(true);
      setActiveStage('ALL');
    } else {
      setFilterAttentionOnly(false);
      setActiveStage(val);
    }
  };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const displayedLeads = filterAttentionOnly
    ? leads.filter((l) => {
        const lastActive = l.last_interaction_date ? new Date(l.last_interaction_date) : new Date(l.updated_at);
        const isStale = !['CONVERTED', 'LOST'].includes(l.stage) && lastActive < sevenDaysAgo;
        const isFollowupNeeded =
          ['INTERESTED', 'QUALIFIED'].includes(l.stage) &&
          (!l.next_follow_up_due || l.pending_followups_count === 0);
        return isStale || isFollowupNeeded;
      })
    : leads;

  const attentionCount =
    summary?.needs_attention_count ??
    leads.filter((l) => {
      const lastActive = l.last_interaction_date ? new Date(l.last_interaction_date) : new Date(l.updated_at);
      const isStale = !['CONVERTED', 'LOST'].includes(l.stage) && lastActive < sevenDaysAgo;
      const isFollowupNeeded =
        ['INTERESTED', 'QUALIFIED'].includes(l.stage) &&
        (!l.next_follow_up_due || l.pending_followups_count === 0);
      return isStale || isFollowupNeeded;
    }).length;

  if (selectedLeadId) {
    return (
      <LeadDetailPage
        leadId={selectedLeadId}
        onBack={() => {
          setSelectedLeadId(null);
          fetchLeads();
          fetchSummary();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 relative">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/70 text-[#0284C7] text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-subtle">
            <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Healthcare Commercial Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Lead Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Track business opportunities, doctor visits, and contract conversions
          </p>
        </div>

        <button
          onClick={() => setIsCreatingLead(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#38BDF8] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-glow-brand transition-all transform active:scale-95 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Add Opportunity</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Leads */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-slate-300 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Total Pipeline
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block tracking-tight">
              {summary?.total_leads ?? leads.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Interested Leads */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-sky-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[#0284C7] uppercase tracking-widest block">
              Interested
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#0284C7] mt-1 block tracking-tight">
              {summary?.interested_leads ?? leads.filter((l) => l.stage === 'INTERESTED').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Qualified Leads */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-blue-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest block">
              Qualified
            </span>
            <span className="text-2xl sm:text-3xl font-black text-blue-800 mt-1 block tracking-tight">
              {summary?.qualified_leads ?? leads.filter((l) => l.stage === 'QUALIFIED').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Converted Leads */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-between group hover:border-emerald-200 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest block">
              Converted
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1 block tracking-tight">
              {summary?.converted_leads ?? leads.filter((l) => l.stage === 'CONVERTED').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Leads Needing Attention */}
        <div
          onClick={() => handleStageFilterClick('ATTENTION')}
          className={`p-4 rounded-2xl border shadow-card flex items-center justify-between cursor-pointer transition-all ${
            filterAttentionOnly
              ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-400/40'
              : attentionCount > 0
              ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200/90 hover:border-amber-300'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest block">
              Needs Attention
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-900 mt-1 block tracking-tight">
              {attentionCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100/90 text-amber-800 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-subtle space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-84">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search opportunity, clinic, doctor, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20 focus:border-[#0284C7] transition-all font-medium"
            />
          </form>

          {/* Scope Segmented Control (All Team Leads vs My Leads) */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl self-end sm:self-auto border border-slate-200/60">
            <button
              onClick={() => setScope('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                scope === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Team Leads
            </button>
            <button
              onClick={() => setScope('my')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                scope === 'my'
                  ? 'bg-white text-[#0284C7] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              My Leads Only
            </button>
          </div>
        </div>

        {/* Stage Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {STAGE_FILTERS.map((s) => {
            const isSelected =
              s.value === 'ATTENTION' ? filterAttentionOnly : !filterAttentionOnly && activeStage === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleStageFilterClick(s.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? s.value === 'ATTENTION'
                      ? 'bg-amber-600 text-white shadow-glow-amber'
                      : 'bg-[#0284C7] text-white shadow-glow-brand'
                    : s.value === 'ATTENTION'
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100/80 border border-amber-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-slate-100/80 animate-pulse border border-slate-200/60" />
          ))}
        </div>
      ) : displayedLeads.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 shadow-subtle px-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg">No opportunities found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
            {searchQuery || activeStage !== 'ALL' || filterAttentionOnly
              ? 'No leads match your selected filters. Reset filter chips or search keyword to see results.'
              : 'You have not recorded any sales leads yet. Click "+ Add Opportunity" to start.'}
          </p>
          <button
            onClick={() => setIsCreatingLead(true)}
            className="mt-5 px-5 py-2.5 bg-sky-50 text-[#0284C7] text-xs font-black rounded-xl hover:bg-sky-100 border border-sky-200/80 transition-colors shadow-subtle"
          >
            + Create First Lead
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLeadId(lead.id)} />
          ))}
        </div>
      )}


      {/* Modal Popup Sheet for Add Lead */}
      {isCreatingLead &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 font-sans">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200"
              onClick={() => setIsCreatingLead(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl z-10 overflow-y-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <LeadFormPage
                onClose={() => {
                  setIsCreatingLead(false);
                  fetchLeads();
                  fetchSummary();
                }}
                onCreated={(lead) => {
                  setIsCreatingLead(false);
                  setSelectedLeadId(lead.id);
                  fetchLeads();
                  fetchSummary();
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
