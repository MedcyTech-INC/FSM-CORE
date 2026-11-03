import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Bell,
  Search,
  Home,
  Moon,
  LogOut,
  CalendarDays,
  CheckSquare,
  TrendingUp,
  BellRing,
  ChevronDown,
  Receipt,
  BarChart3,
  Wand2,
  Target,
  ShieldAlert,
  Shield,
  Camera,
  Building2,
  Route,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useFeatureStore } from '../store/featureStore';
import { useTenantStore } from '../store/tenantStore';
import { branding } from '../config/branding';
import { NavigationDrawer } from './NavigationDrawer';
import { SetupWizardModal } from './SetupWizardModal';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, children }) => {
  const { user, logout, togglePersona } = useAuthStore();
  const { features } = useFeatureStore();
  const { branding: tenantBranding, branches, activeBranchId, setActiveBranch, t } = useTenantStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen]);

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'AV'
    : 'AV';

  const isManager = ['ADMIN', 'GM', 'ZSM', 'RSM'].includes(user?.role || '');
  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';

  // Get current section title for desktop header
  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Operational Dashboard', subtitle: 'Overview of field pipeline & attendance' };
      case 'daily-plan':
        return { title: 'AI Daily Sales Plan', subtitle: 'Dynamic route optimization and itinerary execution' };
      case 'leads':
        return { title: 'Lead Management', subtitle: `${t('target_plural', 'Doctors')}, opportunities & commercial stages` };
      case 'followups':
        return { title: 'Follow-ups & Commitments', subtitle: `Scheduled ${t('target', 'doctor')} calls, visits & SLA tracking` };
      case 'targets':
        return { title: 'Monthly Targets & Pacing', subtitle: `Personal ${t('visit', 'doctor visit')} quotas & daily run-rates` };
      case 'team-targets':
        return { title: 'Team Target Allocations', subtitle: 'Territory targets & performance tracking' };
      case 'revenue-leakage':
        return { title: 'Revenue Leakage Detection', subtitle: `Automated warnings for neglected ${t('target_plural', 'doctors').toLowerCase()} & stalled pipeline` };
      case 'leakage-rules':
        return { title: 'Leakage Detection Rules', subtitle: 'Configure risk thresholds & scan parameters' };
      case 'leakage-scans':
        return { title: 'Scanner Audit Runs', subtitle: 'Log of automatic detector runs and outcomes' };
      case 'visits':
        return { title: 'Visit Log', subtitle: `${t('visit_plural', 'Doctor visits')}, field check-ins & GPS verification` };
      case 'expenses':
        return { title: 'Expense Management', subtitle: 'Travel mileage, meal allowances & manager approvals' };
      case 'analytics':
        return { title: 'Executive Analytics', subtitle: 'Coverage ratios, team KPIs & territory performance' };
      case 'attendance':
        return { title: 'My Attendance', subtitle: 'Timesheet, daily punch hours & history' };
      case 'leaves':
        return { title: 'Leave Requests', subtitle: 'Leave balances, requests & approvals' };
      case 'tasks':
        return { title: 'Work Assignment', subtitle: `Daily ${t('target', 'doctor')} beat & territory tasks` };
      default:
        return { title: tenantBranding.brand_name || branding.companyName, subtitle: branding.portalSubtitle };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col selection:bg-[#0284C7] selection:text-white">
      {/* Slide-out Mobile Navigation Drawer */}
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentTab={currentTab}
        onSelectTab={onTabChange}
        onOpenWizard={() => setWizardOpen(true)}
      />

      {/* Dynamic Client Setup Wizard Modal */}
      <SetupWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* ===================================================================== */}
      {/* DESKTOP SIDEBAR (Visible on lg: and up)                               */}
      {/* ===================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 fixed inset-y-0 left-0 bg-white border-r border-slate-200/80 z-30 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        {/* Brand Header */}
        <div className="p-6 pb-5 border-b border-slate-100 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => onTabChange('dashboard')}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-md group-hover:scale-105 transition-transform"
              style={{ backgroundColor: tenantBranding.primary_color || '#0284C7' }}
            >
              {tenantBranding.brand_name ? tenantBranding.brand_name.substring(0, 2).toUpperCase() : branding.logoInitials}
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm uppercase group-hover:text-[#0284C7] transition-colors">
                  {tenantBranding.brand_name || branding.companyName}
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-sky-50 text-[#0284C7] border border-sky-200/70 tracking-wider">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mt-1">
                {branding.portalSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* SECTION: Commercial Pipeline */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-3">
              Sales Pipeline
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'dashboard'
                  ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Home className={`w-4 h-4 stroke-[2.2] ${currentTab === 'dashboard' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </div>
              </button>

              <button
                onClick={() => onTabChange('daily-plan')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'daily-plan'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Route className={`w-4 h-4 stroke-[2.2] ${currentTab === 'daily-plan' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                  <span>AI Daily Sales Plan</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
                  AI
                </span>
              </button>

              {features.leads && (
                <button
                  onClick={() => onTabChange('leads')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'leads'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-4 h-4 stroke-[2.2] ${currentTab === 'leads' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Lead Management</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
                    Pipeline
                  </span>
                </button>
              )}

              {features.followups && (
                <button
                  onClick={() => onTabChange('followups')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'followups'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <BellRing className={`w-4 h-4 stroke-[2.2] ${currentTab === 'followups' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Follow-ups</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                    Actions
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Targets & Risk */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-3">
              Targets & Risk
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('targets')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'targets' || currentTab === 'team-targets'
                  ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Target className={`w-4 h-4 stroke-[2.2] ${currentTab === 'targets' || currentTab === 'team-targets' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                  <span>Monthly Targets</span>
                </div>
              </button>

              {isManager && (
                <button
                  onClick={() => onTabChange('revenue-leakage')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'revenue-leakage' || currentTab === 'leakage-rules' || currentTab === 'leakage-scans'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className={`w-4 h-4 stroke-[2.2] ${currentTab === 'revenue-leakage' || currentTab === 'leakage-rules' || currentTab === 'leakage-scans' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Revenue Leakage</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
                    Alerts
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Field Operations */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-3">
              Field Operations
            </span>
            <nav className="space-y-1">
              {features.field_visits && (
                <button
                  onClick={() => onTabChange('visits')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'visits'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Camera className={`w-4 h-4 stroke-[2.2] ${currentTab === 'visits' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Visit Log</span>
                  </div>
                </button>
              )}

              {features.tasks && (
                <button
                  onClick={() => onTabChange('tasks')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'tasks'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className={`w-4 h-4 stroke-[2.2] ${currentTab === 'tasks' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Work Assignment</span>
                  </div>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Finance & Governance */}
          {(features.expenses || (features.analytics && canViewAnalytics)) && (
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-3">
                Finance & Reports
              </span>
              <nav className="space-y-1">
                {features.expenses && (
                  <button
                    onClick={() => onTabChange('expenses')}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'expenses'
                      ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className={`w-4 h-4 stroke-[2.2] ${currentTab === 'expenses' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                      <span>Expense Claims</span>
                    </div>
                  </button>
                )}

                {features.analytics && canViewAnalytics && (
                  <button
                    onClick={() => onTabChange('analytics')}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'analytics'
                      ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 className={`w-4 h-4 stroke-[2.2] ${currentTab === 'analytics' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                      <span>Executive Analytics</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
                      KPIs
                    </span>
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* SECTION: Time & Attendance */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-3">
              Attendance & Leaves
            </span>
            <nav className="space-y-1">
              {features.attendance && (
                <button
                  onClick={() => onTabChange('attendance')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'attendance'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className={`w-4 h-4 stroke-[2.2] ${currentTab === 'attendance' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>My Attendance</span>
                  </div>
                </button>
              )}

              {features.leaves && (
                <button
                  onClick={() => onTabChange('leaves')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'leaves'
                    ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Moon className={`w-4 h-4 stroke-[2.2] ${currentTab === 'leaves' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                    <span>Leave Requests</span>
                  </div>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Platform SaaS Governance */}
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.is_tenant_root_admin) && (
            <div>
              <span className="text-[10px] font-extrabold text-[#0284C7] tracking-wider uppercase block mb-1.5 px-3">
                SaaS Control Plane
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => onTabChange('platform-admin')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === 'platform-admin'
                      ? 'bg-[#0284C7] text-white font-extrabold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className={`w-4 h-4 ${currentTab === 'platform-admin' ? 'text-white' : 'text-[#0284C7]'}`} />
                    <span>Organizations & HQ</span>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${currentTab === 'platform-admin' ? 'bg-white/20 text-white' : 'bg-sky-100 text-[#0284C7]'}`}>
                    SaaS
                  </span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Sidebar Bottom Branding */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span>{tenantBranding.brand_name || branding.companyName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-500">PRO</span>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MAIN LAYOUT WRAPPER (Offset by sidebar width on desktop)              */}
      {/* ===================================================================== */}
      <div className="lg:pl-64 xl:pl-72 flex flex-col flex-1">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Brand Mark (Mobile) + Desktop/Mobile Page Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                onClick={() => onTabChange('dashboard')}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-xs lg:hidden shrink-0 cursor-pointer"
                style={{ backgroundColor: tenantBranding.primary_color || '#0284C7' }}
                title="Go to Home"
              >
                {tenantBranding.brand_name ? tenantBranding.brand_name.substring(0, 2).toUpperCase() : branding.logoInitials}
              </div>

              <div className="min-w-0">
                <h1 className="font-extrabold text-slate-900 text-sm sm:text-base lg:text-lg tracking-tight leading-none truncate">
                  {pageInfo.title}
                </h1>
                <p className="text-xs text-slate-400 font-medium hidden sm:block mt-1 truncate">
                  {pageInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Right: Search + Tenant Badge + Setup Wizard + Bell + Profile Menu */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Desktop Search Input */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 w-44 xl:w-56 focus-within:ring-2 focus-within:ring-[#0284C7]/20 focus-within:border-[#0284C7] focus-within:bg-white transition-all">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none text-slate-800 text-xs w-full focus:outline-none placeholder-slate-400"
                />
              </div>

              {/* Tenant & Branch Context Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-[#0284C7]" />
                <span className="font-bold text-slate-800 text-xs">{tenantBranding.brand_name || 'Corporate HQ'}</span>
                {branches.length > 0 && (
                  <select
                    value={activeBranchId || branches[0].id}
                    onChange={(e) => setActiveBranch(e.target.value)}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 ml-1 border-none cursor-pointer outline-none"
                    title="Active Branch"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Setup Wizard Button (Hidden on mobile to prioritize title space) */}
              {isManager && (
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-200/80 text-[#0284C7] hover:bg-sky-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Launch Client Setup Wizard"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span className="hidden xl:inline">Setup Wizard</span>
                </button>
              )}

              {/* Notification Bell */}
              <button
                type="button"
                className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4 stroke-[2]" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>

              {/* User Avatar & Dropdown Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="text-left hidden xl:block leading-tight mr-0.5">
                    <span className="text-xs font-bold text-slate-800 block truncate max-w-[110px]">
                      {user ? `${user.first_name} ${user.last_name}` : 'Alex Vance'}
                    </span>
                    <span className="text-[10px] font-semibold text-[#0284C7] uppercase tracking-tight block">
                      {user?.rank || user?.role || 'General Director'}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0284C7] to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {initials}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown Menu */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0284C7] to-sky-400 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {user ? `${user.first_name} ${user.last_name}` : 'Alex Vance'}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@fsm.com'}</p>
                        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
                          {user?.rank || user?.role || 'General Director'}
                        </span>
                      </div>
                    </div>

                    {/* Persona Switcher inside Profile Menu */}
                    <div className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          togglePersona();
                          setProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#0284C7]" />
                          <span>Switch to {user?.role === 'MR' ? 'Manager (Alex)' : 'Field Rep (Rahul)'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#0284C7] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                          Switch
                        </span>
                      </button>
                    </div>

                    <div className="my-1 border-t border-slate-100" />

                    {/* Sign Out Button */}
                    <div className="px-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION DOCK (Strictly hidden on lg: screens)        */}
      {/* ===================================================================== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-around py-1.5 px-2">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'dashboard'
                ? 'text-[#0284C7] font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${currentTab === 'dashboard' ? 'bg-sky-50' : ''}`}>
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] tracking-tight">Home</span>
          </button>

          <button
            onClick={() => onTabChange('daily-plan')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'daily-plan'
                ? 'text-[#0284C7] font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${currentTab === 'daily-plan' ? 'bg-sky-50' : ''}`}>
              <Route className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] tracking-tight">Plan</span>
          </button>

          {features.leads && (
            <button
              onClick={() => onTabChange('leads')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                currentTab === 'leads'
                  ? 'text-[#0284C7] font-extrabold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${currentTab === 'leads' ? 'bg-sky-50' : ''}`}>
                <TrendingUp className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] tracking-tight">{t('target_plural', 'Leads')}</span>
            </button>
          )}

          {features.attendance && (
            <button
              onClick={() => onTabChange('attendance')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                currentTab === 'attendance'
                  ? 'text-[#0284C7] font-extrabold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${currentTab === 'attendance' ? 'bg-sky-50' : ''}`}>
                <CalendarDays className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] tracking-tight">Attendance</span>
            </button>
          )}

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer font-medium"
          >
            <div className="p-1 rounded-xl">
              <Menu className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] tracking-tight">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
