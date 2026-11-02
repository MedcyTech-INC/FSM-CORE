import React, { useState } from 'react';
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
  MoreHorizontal,
  ChevronRight,
  Receipt,
  BarChart3,
  Wand2,
  Target,
  ShieldAlert,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useFeatureStore } from '../store/featureStore';
import { branding } from '../config/branding';
import { NavigationDrawer } from './NavigationDrawer';
import { SetupWizardModal } from './SetupWizardModal';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, children }) => {
  const { user, logout } = useAuthStore();
  const { features } = useFeatureStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const initials = user
    ? `${user.first_name[0] || ''}${user.last_name[0] || ''}`.toUpperCase()
    : 'AV';

  const isManager = ['ADMIN', 'GM', 'ZSM', 'RSM'].includes(user?.role || '');

  // Get current section title for desktop header
  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Operational Dashboard', subtitle: 'Overview of field pipeline & attendance' };
      case 'leads':
        return { title: 'Lead Management', subtitle: 'Doctors, opportunities & commercial stages' };
      case 'followups':
        return { title: 'Follow-ups & Commitments', subtitle: 'Scheduled doctor calls, visits & SLA tracking' };
      case 'targets':
        return { title: 'Monthly Targets & Pacing', subtitle: 'Personal doctor visit quotas & daily run-rates' };
      case 'team-targets':
        return { title: 'Team Target Allocations', subtitle: 'Territory targets & performance tracking' };
      case 'revenue-leakage':
        return { title: 'Revenue Leakage Detection', subtitle: 'Automated warnings for neglected doctors & stalled pipeline' };
      case 'leakage-rules':
        return { title: 'Leakage Detection Rules', subtitle: 'Configure risk thresholds & scan parameters' };
      case 'leakage-scans':
        return { title: 'Scanner Audit Runs', subtitle: 'Log of automatic detector runs and outcomes' };
      case 'visits':
        return { title: 'Visit Log', subtitle: 'Doctor visits, field check-ins & GPS verification' };
      case 'expenses':
        return { title: 'Expense Management', subtitle: 'Travel mileage, meal allowances & manager approvals' };
      case 'analytics':
        return { title: 'Executive Analytics', subtitle: 'Coverage ratios, team KPIs & territory performance' };
      case 'attendance':
        return { title: 'My Attendance', subtitle: 'Timesheet, daily punch hours & history' };
      case 'leaves':
        return { title: 'Leave Requests', subtitle: 'Leave balances, requests & approvals' };
      case 'tasks':
        return { title: 'Work Assignment', subtitle: 'Daily doctor beat & territory tasks' };
      default:
        return { title: branding.companyName, subtitle: branding.portalSubtitle };
    }
  };

  const pageInfo = getPageTitle();
  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col selection:bg-[#6B52B6] selection:text-white">
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
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => onTabChange('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6B52B6] via-[#7B61C9] to-[#8C74DC] flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-[#6B52B6]/25 group-hover:scale-105 transition-transform">
              {branding.logoInitials}
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm uppercase group-hover:text-[#6B52B6] transition-colors">
                  {branding.companyName}
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-50 text-[#6B52B6] border border-purple-200/70 tracking-wider">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mt-1">
                {branding.portalSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/70 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-1 ring-slate-200 shadow-sm">
              {initials}
            </div>
            <div className="leading-tight">
              <span className="font-bold text-xs text-slate-900 block truncate max-w-[120px]">
                {user ? `${user.first_name} ${user.last_name}` : 'Alex Vance'}
              </span>
              <span className="text-[10px] font-semibold text-[#6B52B6] uppercase tracking-tight block mt-0.5">
                {user?.rank || 'General Director'}
              </span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* SECTION: Commercial Pipeline */}
          <div>
            <span className="text-[10px] font-extrabold text-[#6B52B6] tracking-widest uppercase block mb-2 px-3">
              Sales Pipeline
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Home className={`w-4 h-4 stroke-[2.2] ${currentTab === 'dashboard' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </div>
              </button>

              {features.leads && (
                <button
                  onClick={() => onTabChange('leads')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'leads'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-4 h-4 stroke-[2.2] ${currentTab === 'leads' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Lead Management</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100/80 text-[#6B52B6]">
                    Pipeline
                  </span>
                </button>
              )}

              {features.followups && (
                <button
                  onClick={() => onTabChange('followups')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'followups'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BellRing className={`w-4 h-4 stroke-[2.2] ${currentTab === 'followups' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Follow-ups</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    Actions
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Targets & Risk */}
          <div>
            <span className="text-[10px] font-extrabold text-[#6B52B6] tracking-widest uppercase block mb-2 px-3">
              Targets & Risk
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('targets')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'targets' || currentTab === 'team-targets'
                    ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Target className={`w-4 h-4 stroke-[2.2] ${currentTab === 'targets' || currentTab === 'team-targets' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                  <span>Monthly Targets</span>
                </div>
              </button>

              {isManager && (
                <button
                  onClick={() => onTabChange('revenue-leakage')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'revenue-leakage' || currentTab === 'leakage-rules' || currentTab === 'leakage-scans'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className={`w-4 h-4 stroke-[2.2] ${currentTab === 'revenue-leakage' || currentTab === 'leakage-rules' || currentTab === 'leakage-scans' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Revenue Leakage</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                    Alerts
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Field Operations */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
              Field Operations
            </span>
            <nav className="space-y-1">
              {features.field_visits && (
                <button
                  onClick={() => onTabChange('visits')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'visits'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Camera className={`w-4 h-4 stroke-[2.2] ${currentTab === 'visits' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Visit Log</span>
                  </div>
                </button>
              )}

              {features.tasks && (
                <button
                  onClick={() => onTabChange('tasks')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'tasks'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className={`w-4 h-4 stroke-[2.2] ${currentTab === 'tasks' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Work Assignment</span>
                  </div>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Financials & Executive Analytics */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
              Finance & Performance
            </span>
            <nav className="space-y-1">
              {features.expenses && (
                <button
                  onClick={() => onTabChange('expenses')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'expenses'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Receipt className={`w-4 h-4 stroke-[2.2] ${currentTab === 'expenses' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Expense Claims</span>
                  </div>
                </button>
              )}

              {features.analytics && canViewAnalytics && (
                <button
                  onClick={() => onTabChange('analytics')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'analytics'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className={`w-4 h-4 stroke-[2.2] ${currentTab === 'analytics' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Executive Analytics</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    KPIs
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* SECTION: Attendance & HR */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
              Attendance & HR
            </span>
            <nav className="space-y-1">
              {features.attendance && (
                <button
                  onClick={() => onTabChange('attendance')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'attendance'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className={`w-4 h-4 stroke-[2.2] ${currentTab === 'attendance' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>My Attendance</span>
                  </div>
                </button>
              )}

              {features.leaves && (
                <button
                  onClick={() => onTabChange('leaves')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentTab === 'leaves'
                      ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Moon className={`w-4 h-4 stroke-[2.2] ${currentTab === 'leaves' ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                    <span>Leave Requests</span>
                  </div>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Sidebar Bottom: Sign Out */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 stroke-[2]" />
              <span>Sign Out</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MAIN VIEWPORT (With left padding for desktop sidebar)                 */}
      {/* ===================================================================== */}
      <div className="lg:pl-64 xl:pl-72 flex flex-col flex-1">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Mobile Menu Toggle + Desktop Page Title */}
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                title="Open Menu"
              >
                <Menu className="w-5 h-5 stroke-[2.2]" />
              </button>

              <div>
                <h1 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight leading-none">
                  {pageInfo.title}
                </h1>
                <p className="text-xs text-slate-400 font-medium hidden sm:block mt-1">
                  {pageInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Right: Setup Wizard + Search + Direct Mode + Bell + Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Setup Wizard Button */}
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-[#6B52B6] hover:bg-purple-100 rounded-full text-xs font-bold transition-all shadow-sm"
                title="Launch Client Setup Wizard"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#6B52B6] animate-pulse" />
                <span className="hidden sm:inline">Setup Wizard</span>
              </button>

              {/* Desktop Search Input */}
              <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs text-slate-500 w-52 xl:w-60 focus-within:ring-2 focus-within:ring-[#6B52B6]/20 focus-within:border-[#6B52B6] transition-all">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none text-slate-800 text-xs w-full focus:outline-none placeholder-slate-400"
                />
              </div>

              {/* Direct Mode Pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-600 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold tracking-tight text-slate-700">Direct Mode</span>
              </div>

              {/* Notification Bell */}
              <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all">
                <Bell className="w-4 h-4 stroke-[2]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-full shadow-sm">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center font-bold text-[11px]">
                  {initials}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION DOCK (Strictly hidden on lg: screens)        */}
      {/* ===================================================================== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="max-w-md mx-auto flex items-center justify-around py-2 px-3">
          {/* 1. Dashboard (Home) */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'dashboard'
                ? 'text-[#6B52B6] font-extrabold bg-purple-50 scale-105'
                : 'text-slate-400 hover:text-slate-600 font-semibold'
            }`}
          >
            <Home className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px]">Home</span>
          </button>

          {/* 2. Leads (Pipeline) */}
          <button
            onClick={() => onTabChange('leads')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'leads'
                ? 'text-[#6B52B6] font-extrabold bg-purple-50 scale-105'
                : 'text-slate-400 hover:text-slate-600 font-semibold'
            }`}
          >
            <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px]">Leads</span>
          </button>

          {/* 3. Follow-ups (Actions) */}
          <button
            onClick={() => onTabChange('followups')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'followups'
                ? 'text-[#6B52B6] font-extrabold bg-purple-50 scale-105'
                : 'text-slate-400 hover:text-slate-600 font-semibold'
            }`}
          >
            <BellRing className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px]">Follow-ups</span>
          </button>

          {/* 4. Targets */}
          <button
            onClick={() => onTabChange('targets')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'targets' || currentTab === 'team-targets'
                ? 'text-[#6B52B6] font-extrabold bg-purple-50 scale-105'
                : 'text-slate-400 hover:text-slate-600 font-semibold'
            }`}
          >
            <Target className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px]">Targets</span>
          </button>

          {/* 5. More / Menu (Opens Drawer for Visits, Expenses, Analytics, Leakage, Attendance, Leaves, Tasks, Logout) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-slate-400 hover:text-slate-600 font-semibold transition-all"
          >
            <MoreHorizontal className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
