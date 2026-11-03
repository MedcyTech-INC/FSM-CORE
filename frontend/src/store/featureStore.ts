import { create } from 'zustand';

export interface ClientFeatures {
  attendance: boolean;
  field_visits: boolean;
  leaves: boolean;
  tasks: boolean;
  leads: boolean;
  followups: boolean;
  expenses: boolean;
  analytics: boolean;
  monthly_targets: boolean;
  revenue_leakage: boolean;
  daily_sales_plan: boolean;
}

interface FeatureState {
  features: ClientFeatures;
  isLoading: boolean;
  error: string | null;
  loadFeatures: () => Promise<void>;
  setFeature: (feature: keyof ClientFeatures, enabled: boolean) => void;
  saveFeatures: (newFeatures: ClientFeatures) => Promise<void>;
}

const defaultFeatures: ClientFeatures = {
  attendance: true,
  field_visits: true,
  leaves: true,
  tasks: true,
  leads: true,
  followups: true,
  expenses: true,
  analytics: true,
  monthly_targets: true,
  revenue_leakage: true,
  daily_sales_plan: true,
};

export const useFeatureStore = create<FeatureState>((set) => ({
  features: defaultFeatures,
  isLoading: false,
  error: null,

  loadFeatures: async () => {
    set({ isLoading: true, error: null });
    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${BASE_URL}/api/config/features`);
      if (response.ok) {
        const data = await response.json();
        set({ features: { ...defaultFeatures, ...data }, isLoading: false });
      } else {
        set({ features: defaultFeatures, isLoading: false });
      }
    } catch {
      set({ features: defaultFeatures, isLoading: false });
    }
  },

  setFeature: (feature, enabled) => {
    set((state) => ({
      features: {
        ...state.features,
        [feature]: enabled,
      },
    }));
  },

  saveFeatures: async (newFeatures: ClientFeatures) => {
    set({ features: newFeatures });
    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      await fetch(`${BASE_URL}/api/config/features`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newFeatures),
      });
    } catch (err) {
      console.warn('Failed to persist features to backend', err);
    }
  },
}));
