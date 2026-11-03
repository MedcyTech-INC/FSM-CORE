import { create } from 'zustand';
import { Branch, Tenant, TenantBranding } from '../types/api';

export const defaultBranding: TenantBranding = {
  brand_name: 'Medcy FSM Platform',
  primary_color: '#0284C7',
  logo_url: null,
  terminology_mapping: {
    target: 'Doctor',
    target_plural: 'Doctors',
    visit: 'DCR Call',
    visit_plural: 'DCR Calls',
    customer: 'Clinic/Hospital',
  },
};

export function detectSubdomainSlug(): string {
  if (typeof window === 'undefined') return 'default';
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return localStorage.getItem('tenant_slug') || 'default';
  }
  const parts = host.split('.');
  if (parts.length >= 3 && !['www', 'api', 'app', 'admin', 'platform'].includes(parts[0])) {
    return parts[0];
  }
  return localStorage.getItem('tenant_slug') || 'default';
}

interface TenantState {
  tenantSlug: string;
  tenantProfile: Tenant | null;
  branding: TenantBranding;
  branches: Branch[];
  activeBranchId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTenantContext: (slug?: string) => Promise<void>;
  setTenantSlug: (slug: string) => Promise<void>;
  setActiveBranch: (branchId: string | null) => void;
  t: (termKey: string, fallback?: string) => string;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  tenantSlug: detectSubdomainSlug(),
  tenantProfile: null,
  branding: defaultBranding,
  branches: [],
  activeBranchId: null,
  isLoading: false,
  error: null,

  loadTenantContext: async (customSlug?: string) => {
    const slug = customSlug || get().tenantSlug || detectSubdomainSlug();
    set({ isLoading: true, error: null, tenantSlug: slug });
    localStorage.setItem('tenant_slug', slug);

    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': slug,
      };

      // 1. Fetch Branding & Terminology Dictionary
      const brandingRes = await fetch(`${BASE_URL}/api/tenant/branding`, { headers }).catch(() => null);
      let brandingData = defaultBranding;
      if (brandingRes && brandingRes.ok) {
        brandingData = await brandingRes.json();
      }

      // Dynamic CSS brand primary color injection
      if (brandingData.primary_color && typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--brand-primary', brandingData.primary_color);
      }

      // 2. Fetch Branches under Tenant
      const branchesRes = await fetch(`${BASE_URL}/api/tenant/branches`, { headers }).catch(() => null);
      let branchesData: Branch[] = [];
      if (branchesRes && branchesRes.ok) {
        branchesData = await branchesRes.json();
      }

      // 3. Fetch Tenant Profile
      const profileRes = await fetch(`${BASE_URL}/api/tenant/profile`, { headers }).catch(() => null);
      let profileData: Tenant | null = null;
      if (profileRes && profileRes.ok) {
        profileData = await profileRes.json();
      }

      set({
        branding: brandingData,
        branches: branchesData,
        tenantProfile: profileData,
        activeBranchId: branchesData.length > 0 ? branchesData[0].id : null,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Failed to load multi-tenant context:', err);
      set({ branding: defaultBranding, isLoading: false });
    }
  },

  setTenantSlug: async (slug: string) => {
    localStorage.setItem('tenant_slug', slug);
    set({ tenantSlug: slug });
    await get().loadTenantContext(slug);
  },

  setActiveBranch: (branchId: string | null) => {
    set({ activeBranchId: branchId });
  },

  t: (termKey: string, fallback?: string): string => {
    const mapping = get().branding?.terminology_mapping || {};
    if (mapping[termKey]) {
      return mapping[termKey];
    }
    return fallback || termKey;
  },
}));
