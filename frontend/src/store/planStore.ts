import { create } from 'zustand';
import {
  PlanResponse,
  PlanItemResponse,
  PlanGeneratePayload,
  PlanReplanPayload,
  PlanItemStartPayload,
  PlanItemCompletePayload,
  PlanItemSkipPayload,
  MonthlyTargetResponse,
  LeadResponse,
  FollowUpResponse,
} from '../types/plan';
import { api } from '../api/client';
import { useAuthStore } from './authStore';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface PlanState {
  activePlan: PlanResponse | null;
  monthlyTarget: MonthlyTargetResponse | null;
  leads: LeadResponse[];
  followUps: FollowUpResponse[];
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;
  selectedStop: PlanItemResponse | null;

  // Modals state
  isGenerateModalOpen: boolean;
  isReplanModalOpen: boolean;
  isCheckoutModalOpen: boolean;
  isSkipModalOpen: boolean;
  activeActionStop: PlanItemResponse | null;

  // Actions
  selectedEmployeeId: string;
  setSelectedEmployeeId: (empId: string) => void;
  isRejectModalOpen: boolean;
  openRejectModal: () => void;
  closeRejectModal: () => void;
  rejectPlan: (payload: { category: string; notes: string }) => Promise<void>;
  fetchTodayPlan: (date?: string, employeeId?: string) => Promise<void>;
  fetchMonthlyTarget: () => Promise<void>;
  fetchLeads: (stage?: string) => Promise<void>;
  fetchFollowUps: (status?: string) => Promise<void>;
  generatePlan: (params: {
    startLatitude: number;
    startLongitude: number;
    maxStops?: number;
    planDate?: string;
    forceRegenerate?: boolean;
  }) => Promise<void>;
  replanMidday: (params: {
    currentLatitude: number;
    currentLongitude: number;
    replanReason: string;
  }) => Promise<void>;
  reconcilePlan: () => Promise<void>;
  approvePlan: (notes?: string) => Promise<void>;
  startStop: (
    itemId: string,
    params: { latitude: number; longitude: number; proofPhoto?: string }
  ) => Promise<void>;
  completeStop: (itemId: string, payload: PlanItemCompletePayload) => Promise<void>;
  skipStop: (itemId: string, reason: string) => Promise<void>;

  // UI Modal Controls
  openGenerateModal: () => void;
  closeGenerateModal: () => void;
  openReplanModal: () => void;
  closeReplanModal: () => void;
  openCheckoutModal: (stop: PlanItemResponse) => void;
  closeCheckoutModal: () => void;
  openSkipModal: (stop: PlanItemResponse) => void;
  closeSkipModal: () => void;
  setSelectedStop: (stop: PlanItemResponse | null) => void;
  clearError: () => void;
  resetPlan: () => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  activePlan: null,
  monthlyTarget: null,
  leads: [],
  followUps: [],
  isLoading: false,
  isActionLoading: false,
  error: null,
  selectedStop: null,

  selectedEmployeeId: '22222222-2222-2222-2222-222222222222',
  isRejectModalOpen: false,
  setSelectedEmployeeId: (empId: string) => {
    set({ selectedEmployeeId: empId });
    get().fetchTodayPlan(undefined, empId);
  },
  openRejectModal: () => set({ isRejectModalOpen: true }),
  closeRejectModal: () => set({ isRejectModalOpen: false }),
  isGenerateModalOpen: false,
  isReplanModalOpen: false,
  isCheckoutModalOpen: false,
  isSkipModalOpen: false,
  activeActionStop: null,

  fetchTodayPlan: async (date?: string, employeeId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const today = date || new Date().toISOString().split('T')[0];
      const targetEmp = employeeId || get().selectedEmployeeId;
      const plan = await api.getDailySalesPlan(today, targetEmp);
      set({ activePlan: plan, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch sales plan', isLoading: false });
    }
  },

  fetchMonthlyTarget: async () => {
    try {
      const target = await api.getMonthlyTargetCurrent();
      set({ monthlyTarget: target });
    } catch {
      // Non-blocking target pacing
    }
  },

  fetchLeads: async (stage?: string) => {
    try {
      const leads = await api.listCRMLeads(stage);
      set({ leads });
    } catch {
      // Non-blocking
    }
  },

  fetchFollowUps: async (status?: string) => {
    try {
      const followUps = await api.listCRMFollowUps(status);
      set({ followUps });
    } catch {
      // Non-blocking
    }
  },

  generatePlan: async ({ startLatitude, startLongitude, maxStops = 6, planDate, forceRegenerate = false }) => {
    set({ isActionLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const employeeId = get().selectedEmployeeId || user?.id || '22222222-2222-2222-2222-222222222222';
      const targetDate = planDate || new Date().toISOString().split('T')[0];

      const payload: PlanGeneratePayload = {
        employee_id: employeeId,
        plan_date: targetDate,
        start_latitude: startLatitude,
        start_longitude: startLongitude,
        max_stops: maxStops,
        idempotency_key: generateUUID(),
        force_regenerate: forceRegenerate,
      };

      const plan = await api.generateDailySalesPlan(payload);
      set({ activePlan: plan, isActionLoading: false, isGenerateModalOpen: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate daily sales plan', isActionLoading: false });
      throw err;
    }
  },

  replanMidday: async ({ currentLatitude, currentLongitude, replanReason }) => {
    const { activePlan } = get();
    if (!activePlan) return;
    set({ isActionLoading: true, error: null });
    try {
      const payload: PlanReplanPayload = {
        current_latitude: currentLatitude,
        current_longitude: currentLongitude,
        replan_reason: replanReason,
      };
      const updatedPlan = await api.replanDailySalesPlan(activePlan.id, payload);
      set({ activePlan: updatedPlan, isActionLoading: false, isReplanModalOpen: false });
    } catch (err: any) {
      set({ error: err.message || 'Midday replan failed', isActionLoading: false });
      throw err;
    }
  },

  reconcilePlan: async () => {
    const { activePlan } = get();
    if (!activePlan) return;
    set({ isActionLoading: true, error: null });
    try {
      const updatedPlan = await api.reconcileDailySalesPlan(activePlan.id);
      set({ activePlan: updatedPlan, isActionLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Reconciliation failed', isActionLoading: false });
    }
  },

  rejectPlan: async (payload: { category: string; notes: string }) => {
    const { activePlan } = get();
    if (!activePlan) return;
    set({ isActionLoading: true, error: null });
    try {
      const updatedPlan = await api.rejectDailySalesPlan(activePlan.id, payload);
      set({ activePlan: updatedPlan, isActionLoading: false, isRejectModalOpen: false });
    } catch (err: any) {
      set({ error: err.message || 'Plan rejection failed', isActionLoading: false });
      throw err;
    }
  },

  approvePlan: async (notes?: string) => {
    const { activePlan } = get();
    if (!activePlan) return;
    set({ isActionLoading: true, error: null });
    try {
      const updatedPlan = await api.approveDailySalesPlan(activePlan.id, { notes });
      set({ activePlan: updatedPlan, isActionLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Plan approval failed', isActionLoading: false });
      throw err;
    }
  },

  startStop: async (itemId: string, { latitude, longitude, proofPhoto }) => {
    set({ isActionLoading: true, error: null });
    try {
      const payload: PlanItemStartPayload = {
        latitude,
        longitude,
        proof_photo: proofPhoto,
      };
      const updatedItem = await api.startDailySalesPlanItem(itemId, payload);
      const { activePlan } = get();
      if (activePlan) {
        const newItems = activePlan.items.map((i) => (i.id === itemId ? updatedItem : i));
        set({
          activePlan: {
            ...activePlan,
            status: activePlan.status === 'APPROVED' ? 'IN_PROGRESS' : activePlan.status,
            items: newItems,
          },
          isActionLoading: false,
        });
      } else {
        set({ isActionLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Check-in failed', isActionLoading: false });
      throw err;
    }
  },

  completeStop: async (itemId: string, payload: PlanItemCompletePayload) => {
    set({ isActionLoading: true, error: null });
    try {
      const updatedItem = await api.completeDailySalesPlanItem(itemId, payload);
      const { activePlan } = get();
      if (activePlan) {
        const newItems = activePlan.items.map((i) => (i.id === itemId ? updatedItem : i));
        set({
          activePlan: {
            ...activePlan,
            items: newItems,
          },
          isActionLoading: false,
          isCheckoutModalOpen: false,
          activeActionStop: null,
        });
      } else {
        set({ isActionLoading: false, isCheckoutModalOpen: false, activeActionStop: null });
      }
      // Refresh targets and leads
      get().fetchMonthlyTarget();
      get().fetchLeads();
    } catch (err: any) {
      set({ error: err.message || 'Stop completion failed', isActionLoading: false });
      throw err;
    }
  },

  skipStop: async (itemId: string, reason: string) => {
    set({ isActionLoading: true, error: null });
    try {
      const payload: PlanItemSkipPayload = { skip_reason: reason };
      const updatedItem = await api.skipDailySalesPlanItem(itemId, payload);
      const { activePlan } = get();
      if (activePlan) {
        const newItems = activePlan.items.map((i) => (i.id === itemId ? updatedItem : i));
        set({
          activePlan: {
            ...activePlan,
            items: newItems,
          },
          isActionLoading: false,
          isSkipModalOpen: false,
          activeActionStop: null,
        });
      } else {
        set({ isActionLoading: false, isSkipModalOpen: false, activeActionStop: null });
      }
    } catch (err: any) {
      set({ error: err.message || 'Skip stop failed', isActionLoading: false });
      throw err;
    }
  },

  openGenerateModal: () => set({ isGenerateModalOpen: true }),
  closeGenerateModal: () => set({ isGenerateModalOpen: false }),
  openReplanModal: () => set({ isReplanModalOpen: true }),
  closeReplanModal: () => set({ isReplanModalOpen: false }),
  openCheckoutModal: (stop: PlanItemResponse) =>
    set({ isCheckoutModalOpen: true, activeActionStop: stop }),
  closeCheckoutModal: () => set({ isCheckoutModalOpen: false, activeActionStop: null }),
  openSkipModal: (stop: PlanItemResponse) => set({ isSkipModalOpen: true, activeActionStop: stop }),
  closeSkipModal: () => set({ isSkipModalOpen: false, activeActionStop: null }),
  setSelectedStop: (stop: PlanItemResponse | null) => set({ selectedStop: stop }),
  clearError: () => set({ error: null }),
  resetPlan: () => {
    api.resetDailySalesPlan();
    set({ activePlan: null, selectedStop: null, activeActionStop: null });
  },
}));
