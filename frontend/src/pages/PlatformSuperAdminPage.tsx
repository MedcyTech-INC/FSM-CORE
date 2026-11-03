import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Shield,
  MapPin,
  ExternalLink,
  CheckCircle2,
  X,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { Tenant } from '../types/api';
import { useTenantStore } from '../store/tenantStore';

interface PlatformSuperAdminPageProps {
  onSelectTenant?: (slug: string) => void;
  onBackToApp?: () => void;
}

export const PlatformSuperAdminPage: React.FC<PlatformSuperAdminPageProps> = ({
  onSelectTenant,
  onBackToApp,
}) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState<Tenant | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Provisioning Form State
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [slug, setSlug] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('enterprise');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('Admin@12345');
  const [primaryBranchName, setPrimaryBranchName] = useState('');
  const [primaryBranchCity, setPrimaryBranchCity] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0284C7');
  const [industryPreset, setIndustryPreset] = useState<'pharma' | 'agri' | 'fmcg'>('pharma');
  const [submitting, setSubmitting] = useState(false);

  // Branch Creation State
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchState, setBranchState] = useState('');

  const { setTenantSlug } = useTenantStore();

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await api.getPlatformTenants();
      setTenants(data);
    } catch (err) {
      console.warn('Failed to fetch platform tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleLegalNameChange = (val: string) => {
    setLegalName(val);
    if (!tradeName) setTradeName(val.split(' ')[0] || '');
    if (!slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 20)
      );
    }
    if (!primaryBranchName) setPrimaryBranchName(`${val.split(' ')[0]} Corporate HQ`);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let terminologyMapping = {
        target: 'Doctor',
        target_plural: 'Doctors',
        visit: 'DCR Call',
        visit_plural: 'DCR Calls',
        customer: 'Clinic/Hospital',
      };
      if (industryPreset === 'agri') {
        terminologyMapping = {
          target: 'Farmer',
          target_plural: 'Farmers',
          visit: 'Farm Inspection',
          visit_plural: 'Farm Inspections',
          customer: 'Grower / Facility',
        };
      } else if (industryPreset === 'fmcg') {
        terminologyMapping = {
          target: 'Dealer',
          target_plural: 'Dealers',
          visit: 'Outlet Visit',
          visit_plural: 'Outlet Visits',
          customer: 'Retailer / Distributor',
        };
      }

      const payload = {
        slug: slug.trim().toLowerCase(),
        legal_name: legalName.trim(),
        trade_name: tradeName.trim() || legalName.trim(),
        subscription_tier: subscriptionTier,
        admin_first_name: adminFirstName.trim() || 'Tenant',
        admin_last_name: adminLastName.trim() || 'Admin',
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        primary_branch_name: primaryBranchName.trim() || 'Corporate HQ',
        primary_branch_city: primaryBranchCity.trim() || 'Metropolis',
        branding: {
          brand_name: tradeName.trim() || legalName.trim(),
          primary_color: primaryColor,
          terminology_mapping: terminologyMapping,
        },
      };

      await api.provisionPlatformTenant(payload);
      setSuccessToast(`Client organization '${payload.trade_name}' and Root Admin '${payload.admin_email}' provisioned!`);
      setShowProvisionModal(false);
      resetProvisionForm();
      await loadTenants();
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetProvisionForm = () => {
    setLegalName('');
    setTradeName('');
    setSlug('');
    setAdminFirstName('');
    setAdminLastName('');
    setAdminEmail('');
    setPrimaryBranchName('');
    setPrimaryBranchCity('');
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBranchModal) return;
    try {
      await api.createTenantBranch(showBranchModal.id, {
        name: branchName.trim(),
        branch_code: branchCode.trim() || `BR-${branchCity.toUpperCase().substring(0, 3)}-01`,
        city: branchCity.trim(),
        state: branchState.trim() || 'State',
        country: 'India',
        is_head_office: false,
      });
      setSuccessToast(`New branch '${branchName}' attached to ${showBranchModal.trade_name || showBranchModal.legal_name}!`);
      setShowBranchModal(null);
      setBranchName('');
      setBranchCode('');
      setBranchCity('');
    } catch (err: any) {
      alert(`Branch creation failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleLaunchTenantPortal = async (tenantSlug: string) => {
    await setTenantSlug(tenantSlug);
    if (onSelectTenant) {
      onSelectTenant(tenantSlug);
    } else if (onBackToApp) {
      onBackToApp();
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.trade_name && t.trade_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-[#0284C7] selection:text-white">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-slate-950 border-b border-sky-800/30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] flex items-center justify-center text-white shadow-lg shadow-sky-600/30">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white uppercase">
                  Platform Super-Admin Control Plane
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Level 1 Operations
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Tenant Governance, Client Organization Provisioning & Enterprise Branch Scoping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
              >
                &larr; Exit to Workspace
              </button>
            )}
            <button
              onClick={() => setShowProvisionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0284C7] to-sky-500 text-white hover:opacity-95 rounded-xl text-xs font-extrabold shadow-lg shadow-sky-900/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Onboard Organization</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Registered Organizations
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{tenants.length}</span>
              <span className="text-xs text-sky-400 font-semibold">fsm_system.tenants</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Data Isolation Mode
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-extrabold text-emerald-400">PostgreSQL RLS</span>
              <span className="text-[10px] font-mono text-slate-400">SET LOCAL</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Hierarchy Triggers
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-extrabold text-indigo-400">Active</span>
              <span className="text-[10px] text-slate-400 font-mono">trg_integrity</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Statutory Retention
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-extrabold text-cyan-400">fsm_archive</span>
              <span className="text-[10px] text-slate-400">Tier 3 Ready</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by organization or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div className="text-xs text-slate-400 font-semibold">
            Showing {filteredTenants.length} of {tenants.length} corporate organizations
          </div>
        </div>

        {/* Organizations Table */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Corporate Client</th>
                  <th className="px-6 py-4">Subdomain / Slug</th>
                  <th className="px-6 py-4">Subscription</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                        <span>Loading platform organizations...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No corporate organizations found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0284C7] to-cyan-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                          {(t.trade_name || t.legal_name).substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-sm block text-white">{t.trade_name || t.legal_name}</span>
                          <span className="text-[11px] text-slate-400 block">{t.legal_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sky-300 bg-sky-950/60 border border-sky-800/40 px-2 py-1 rounded-md text-[11px]">
                        {t.slug}.fsm.com
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="uppercase text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {t.subscription_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                type="button"
                          onClick={() => setShowBranchModal(t)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                          title="Attach regional branch"
                        >
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          <span>+ Branch</span>
                        </button>
                        <button
                type="button"
                          onClick={() => handleLaunchTenantPortal(t.slug)}
                          className="px-3 py-1.5 rounded-lg bg-[#0284C7] hover:bg-sky-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-sky-900/30"
                        >
                          <span>Open Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: Onboard New Client Organization                                */}
      {/* ===================================================================== */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl my-8 p-6 sm:p-8 shadow-2xl relative text-left">
            <button
              onClick={() => setShowProvisionModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#0284C7] flex items-center justify-center text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Onboard New Corporate Client</h2>
                <p className="text-xs text-slate-400">
                  Provisions tenant record, root administrator, corporate HQ branch, and branding.
                </p>
              </div>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-6">
              {/* Section 1: Legal & Subdomain */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-widest block">
                  1. Corporate Identity & Routing
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Legal Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zydus Healthcare Ltd"
                      value={legalName}
                      onChange={(e) => handleLegalNameChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Trade / Display Brand Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Zydus"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Tenant Subdomain Slug *
                    </label>
                    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-sky-500">
                      <input
                        type="text"
                        required
                        placeholder="zydus"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="bg-transparent border-none text-xs text-white w-full focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs font-mono">.fsm.com</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Subscription Tier
                    </label>
                    <select
                      value={subscriptionTier}
                      onChange={(e) => setSubscriptionTier(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="enterprise">Enterprise (Unlimited Branches & RLS)</option>
                      <option value="growth">Growth (Regional Multi-Branch)</option>
                      <option value="standard">Standard (Single Branch HQ)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Primary HQ Branch */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest block">
                  2. Primary Corporate HQ Branch
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      HQ Branch Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai Corporate HQ"
                      value={primaryBranchName}
                      onChange={(e) => setPrimaryBranchName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai"
                      value={primaryBranchCity}
                      onChange={(e) => setPrimaryBranchCity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Root Tenant Administrator */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block">
                  3. Root Tenant Administrator (Level 2 Admin)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Admin First Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Admin Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sharma"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Admin Corporate Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@zydus.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Temporary Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Branding & Terminology */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block">
                  4. White-Label Branding & Industry Terminology
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Industry Vocabulary Preset
                    </label>
                    <select
                      value={industryPreset}
                      onChange={(e) => setIndustryPreset(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="pharma">Pharmaceutical (Doctor, DCR Call, Clinic)</option>
                      <option value="agri">Agrochemical (Farmer, Farm Inspection, Grower)</option>
                      <option value="fmcg">FMCG & Retail (Dealer, Outlet Visit, Retailer)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Corporate Brand Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#0284C7] to-sky-600 text-white hover:opacity-95 shadow-lg shadow-sky-900/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Provisioning Tenant & HQ...' : 'Complete Organization Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: Add Regional Branch                                            */}
      {/* ===================================================================== */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative text-left">
            <button
              onClick={() => setShowBranchModal(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">
                  Add Regional Branch for {showBranchModal.trade_name || showBranchModal.legal_name}
                </h2>
                <p className="text-xs text-slate-400">
                  Attaches branch to organization without creating a disconnected tenant.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Regional Division"
                  value={branchName}
                  onChange={(e) => {
                    setBranchName(e.target.value);
                    if (!branchCode && e.target.value) {
                      setBranchCode(`BR-${e.target.value.substring(0, 3).toUpperCase()}-01`);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Branch Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BR-PUN-01"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={branchState}
                    onChange={(e) => setBranchState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/50 transition-all cursor-pointer"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
