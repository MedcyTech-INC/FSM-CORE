import { create } from 'zustand';
import { User } from '../types/api';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    // Instant Demo Mode fallback for direct evaluation (strictly limited to local development)
    if (import.meta.env.DEV && (email === 'admin@fsm.com' || email === 'field@fsm.com' || email.endsWith('@fsm.com'))) {
      const isField = email.startsWith('field');
      const isFinance = email.startsWith('finance');
      const isZsm = email.startsWith('zsm');
      const isRsm = email.startsWith('rsm') || email.startsWith('manager');

      let role: User['role'] = 'ADMIN';
      let firstName = 'Alex';
      let lastName = 'Vance';
      let rank = 'General Director';
      let territory = 'All Territories (HQ)';
      let userId = '11111111-1111-1111-1111-111111111111';

      if (isFinance) {
        role = 'FINANCE';
        firstName = 'Pooja';
        lastName = 'Mehta';
        rank = 'Finance & Accounts Officer';
        territory = 'Corporate Finance Division';
        userId = '55555555-5555-5555-5555-555555555555';
      } else if (isZsm) {
        role = 'ZSM';
        firstName = 'Deepak';
        lastName = 'Verma';
        rank = 'Zonal Sales Manager';
        territory = 'West Zone';
        userId = '44444444-4444-4444-4444-444444444444';
      } else if (isRsm) {
        role = 'RSM';
        firstName = 'Vikram';
        lastName = 'Malhotra';
        rank = 'Regional Sales Manager';
        territory = 'Maharashtra Region';
        userId = '33333333-3333-3333-3333-333333333333';
      } else if (isField) {
        role = 'MR';
        firstName = 'Rahul';
        lastName = 'Sharma';
        rank = 'Senior Field Executive';
        territory = 'South Mumbai Zone';
        userId = '22222222-2222-2222-2222-222222222222';
      }

      const demoUser: User = {
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        rank,
        territory,
        is_active: true,
      };

      const mockToken = 'demo-jwt-session-token-' + Date.now();
      localStorage.setItem('access_token', mockToken);
      localStorage.setItem('demo_user', JSON.stringify(demoUser));

      set({
        user: demoUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    try {
      const tokens = await api.login(email, password);
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);

      const profile = await api.getMyProfile();
      set({
        user: profile,
        token: tokens.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch {
        // Continue clearing local state
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('demo_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadSession: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    const savedDemoUser = localStorage.getItem('demo_user');
    if (import.meta.env.DEV && savedDemoUser) {
      try {
        set({ user: JSON.parse(savedDemoUser), isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // Fall through
      }
    }

    set({ isLoading: true });
    try {
      const profile = await api.getMyProfile();
      set({ user: profile, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
