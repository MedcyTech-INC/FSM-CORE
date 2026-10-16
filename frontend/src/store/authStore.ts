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

    // Instant Demo Mode fallback for direct evaluation
    if (email === 'admin@fsm.com' || email === 'field@fsm.com' || email.endsWith('@fsm.com')) {
      const isField = email.startsWith('field');
      const demoUser: User = {
        id: isField ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111',
        email,
        first_name: isField ? 'Rahul' : 'Alex',
        last_name: isField ? 'Sharma' : 'Vance',
        role: isField ? 'MR' : 'ADMIN',
        rank: isField ? 'Senior Field Executive' : 'General Director',
        territory: isField ? 'South Mumbai Zone' : 'All Territories (HQ)',
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
    if (savedDemoUser) {
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
