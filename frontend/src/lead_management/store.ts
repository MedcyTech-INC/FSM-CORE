import { create } from 'zustand';
import { leadsApi } from './api';
import {
  Lead,
  LeadSummary,
  LeadStage,
  LeadHistoryItem,
  LeadCreateInput,
  LeadUpdateInput,
  LeadStageChangeInput,
  LeadAssignInput,
} from './types';

interface LeadsState {
  leads: Lead[];
  summary: LeadSummary | null;
  selectedLead: Lead | null;
  timeline: LeadHistoryItem[];
  activeStage: LeadStage | 'ALL';
  scope: 'my' | 'all';
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLeads: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchLeadDetail: (id: string) => Promise<void>;
  createLead: (input: LeadCreateInput) => Promise<Lead>;
  updateLead: (id: string, input: LeadUpdateInput) => Promise<void>;
  changeStage: (id: string, input: LeadStageChangeInput) => Promise<void>;
  assignLead: (id: string, input: LeadAssignInput) => Promise<void>;
  setActiveStage: (stage: LeadStage | 'ALL') => void;
  setScope: (scope: 'my' | 'all') => void;
  setSearchQuery: (q: string) => void;
  clearSelectedLead: () => void;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  summary: null,
  selectedLead: null,
  timeline: [],
  activeStage: 'ALL',
  scope: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const { activeStage, scope, searchQuery } = get();
      const leads = await leadsApi.listLeads({
        stage: activeStage === 'ALL' ? undefined : activeStage,
        scope,
        search: searchQuery || undefined,
      });
      set({ leads, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch leads', isLoading: false });
    }
  },

  fetchSummary: async () => {
    try {
      const summary = await leadsApi.getSummary();
      set({ summary });
    } catch (err: any) {
      console.error('Failed to load lead summary', err);
    }
  },

  fetchLeadDetail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const [lead, timeline] = await Promise.all([
        leadsApi.getLead(id),
        leadsApi.getTimeline(id),
      ]);
      set({ selectedLead: lead, timeline, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load lead details', isLoading: false });
    }
  },

  createLead: async (input: LeadCreateInput) => {
    set({ isLoading: true });
    try {
      const newLead = await leadsApi.createLead(input);
      set((state) => ({ leads: [newLead, ...state.leads], isLoading: false }));
      get().fetchSummary();
      return newLead;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create lead', isLoading: false });
      throw err;
    }
  },

  updateLead: async (id: string, input: LeadUpdateInput) => {
    set({ isLoading: true });
    try {
      const updated = await leadsApi.updateLead(id, input);
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updated : l)),
        selectedLead: state.selectedLead?.id === id ? updated : state.selectedLead,
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to update lead', isLoading: false });
      throw err;
    }
  },

  changeStage: async (id: string, input: LeadStageChangeInput) => {
    set({ isLoading: true });
    try {
      const updated = await leadsApi.changeStage(id, input);
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updated : l)),
        selectedLead: state.selectedLead?.id === id ? updated : state.selectedLead,
        isLoading: false,
      }));
      // Refresh timeline & summary
      const timeline = await leadsApi.getTimeline(id);
      set({ timeline });
      get().fetchSummary();
    } catch (err: any) {
      set({ error: err.message || 'Failed to transition stage', isLoading: false });
      throw err;
    }
  },

  assignLead: async (id: string, input: LeadAssignInput) => {
    set({ isLoading: true });
    try {
      const updated = await leadsApi.assignLead(id, input);
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updated : l)),
        selectedLead: state.selectedLead?.id === id ? updated : state.selectedLead,
        isLoading: false,
      }));
      const timeline = await leadsApi.getTimeline(id);
      set({ timeline });
    } catch (err: any) {
      set({ error: err.message || 'Failed to reassign lead', isLoading: false });
      throw err;
    }
  },

  setActiveStage: (stage: LeadStage | 'ALL') => {
    set({ activeStage: stage });
    get().fetchLeads();
  },

  setScope: (scope: 'my' | 'all') => {
    set({ scope });
    get().fetchLeads();
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },

  clearSelectedLead: () => {
    set({ selectedLead: null, timeline: [] });
  },
}));
