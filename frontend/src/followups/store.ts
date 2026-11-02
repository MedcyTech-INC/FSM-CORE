import { create } from 'zustand';
import { followupsApi } from './api';
import {
  Followup,
  FollowupTab,
  DueSummary,
  FollowupCreateInput,
} from './types';

interface FollowupsState {
  followups: Followup[];
  dueSummary: DueSummary | null;
  activeTab: FollowupTab;
  scope: 'my' | 'all';
  isLoading: boolean;
  error: string | null;

  fetchFollowups: () => Promise<void>;
  fetchDueSummary: () => Promise<void>;
  setActiveTab: (tab: FollowupTab) => void;
  setScope: (scope: 'my' | 'all') => void;
  createFollowup: (input: FollowupCreateInput) => Promise<Followup>;
  completeFollowup: (id: string, outcome: string) => Promise<void>;
  rescheduleFollowup: (id: string, newDueAt: string, reason: string) => Promise<void>;
  cancelFollowup: (id: string, reason: string) => Promise<void>;
}

export const useFollowupsStore = create<FollowupsState>((set, get) => ({
  followups: [],
  dueSummary: null,
  activeTab: 'due_today',
  scope: 'all',
  isLoading: false,
  error: null,

  fetchFollowups: async () => {
    set({ isLoading: true, error: null });
    try {
      const { activeTab, scope } = get();
      const list = await followupsApi.listFollowups({
        tab: activeTab === 'all' ? undefined : activeTab,
        scope,
      });
      set({ followups: list, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch follow-ups', isLoading: false });
    }
  },

  fetchDueSummary: async () => {
    try {
      const dueSummary = await followupsApi.getDueSummary();
      set({ dueSummary });
    } catch (err: any) {
      console.error('Failed to load follow-up due summary', err);
    }
  },

  setActiveTab: (tab: FollowupTab) => {
    set({ activeTab: tab });
    get().fetchFollowups();
  },

  setScope: (scope: 'my' | 'all') => {
    set({ scope });
    get().fetchFollowups();
  },

  createFollowup: async (input: FollowupCreateInput) => {
    set({ isLoading: true });
    try {
      const newFup = await followupsApi.createFollowup(input);
      set((state) => ({ followups: [newFup, ...state.followups], isLoading: false }));
      get().fetchDueSummary();
      return newFup;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create follow-up', isLoading: false });
      throw err;
    }
  },

  completeFollowup: async (id: string, outcome: string) => {
    set({ isLoading: true });
    try {
      const updated = await followupsApi.completeFollowup(id, { outcome });
      set((state) => ({
        followups: state.followups.map((f) => (f.id === id ? updated : f)),
        isLoading: false,
      }));
      get().fetchDueSummary();
    } catch (err: any) {
      set({ error: err.message || 'Failed to complete follow-up', isLoading: false });
      throw err;
    }
  },

  rescheduleFollowup: async (id: string, newDueAt: string, reason: string) => {
    set({ isLoading: true });
    try {
      const updated = await followupsApi.rescheduleFollowup(id, { new_due_at: newDueAt, reason });
      set((state) => ({
        followups: state.followups.map((f) => (f.id === id ? updated : f)),
        isLoading: false,
      }));
      get().fetchDueSummary();
    } catch (err: any) {
      set({ error: err.message || 'Failed to reschedule follow-up', isLoading: false });
      throw err;
    }
  },

  cancelFollowup: async (id: string, reason: string) => {
    set({ isLoading: true });
    try {
      const updated = await followupsApi.cancelFollowup(id, { cancel_reason: reason });
      set((state) => ({
        followups: state.followups.map((f) => (f.id === id ? updated : f)),
        isLoading: false,
      }));
      get().fetchDueSummary();
    } catch (err: any) {
      set({ error: err.message || 'Failed to cancel follow-up', isLoading: false });
      throw err;
    }
  },
}));
