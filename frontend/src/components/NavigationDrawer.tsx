import React from 'react';
import {
  X,
  Home,
  CalendarDays,
  Moon,
  CheckSquare,
  TrendingUp,
  BellRing,
  LogOut,
  ChevronRight,
  Receipt,
  BarChart3,
  Wand2,
  Target,
  ShieldAlert,
  Sliders,
  Camera,
  Route,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useFeatureStore } from '../store/featureStore';
import { branding } from '../config/branding';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenWizard?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  onOpenWizard,
}) => {
  const { user, logout } = useAuthStore();
  const { features } = useFeatureStore();

  if (!isOpen) return null;

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'FC'
    : 'FC';

  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';
  const isManager = ['ADMIN', 'GM', 'ZSM', 'RSM'].includes(user?.role || '');
  const isSeniorManager = ['ADMIN', 'GM', 'ZSM'].includes(user?.role || '');

  const pipelineItems = [
    { id: 'dashboard', label: 'Home Dashboard', icon: Home, badge: '', enabled: true },
    { id: 'daily-plan', label: 'AI Daily Sales Plan', icon: Route, badge: 'AI', enabled: true },
    { id: 'leads', label: 'Lead Management', icon: TrendingUp, badge: 'Pipeline', enabled: features.leads },
    { id: 'followups', label: 'Follow-ups', icon: BellRing, badge: 'Actions', enabled: features.followups },
  ].filter((item) => item.enabled);

  const targetItems = [
    { id: 'revenue-leakage', label: 'Revenue Leakage', icon: ShieldAlert, badge: 'Alerts', enabled: true },
    { id: 'targets', label: 'Monthly Targets', icon: Target, badge: '', enabled: true },
    ...(isManager ? [{ id: 'team-targets', label: 'Team Targets', icon: BarChart3, badge: '', enabled: true }] : []),
    ...(isSeniorManager ? [{ id: 'leakage-rules', label: 'Revenue Leakage Rules', icon: Sliders, badge: '', enabled: true }] : []),
  ];

  const fieldItems = [
    { id: 'visits', label: 'Visit Log', icon: Camera, enabled: features.field_visits },
    { id: 'tasks', label: 'Work Assignment', icon: CheckSquare, enabled: features.tasks },
  ].filter((item) => item.enabled);

  const financeItems = [
    { id: 'expenses', label: 'Expense Claims', icon: Receipt, enabled: features.expenses },
    ...(canViewAnalytics ? [{ id: 'analytics', label: 'Executive Analytics', icon: BarChart3, badge: 'KPIs', enabled: features.analytics }] : []),
  ].filter((item) => item.enabled);

  const attendanceItems = [
    { id: 'attendance', label: 'My Attendance', icon: CalendarDays, enabled: features.attendance },
    { id: 'leaves', label: 'Leave Requests', icon: Moon, enabled: features.leaves },
  ].filter((item) => item.enabled);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200">
        <div className="p-6 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6B52B6] via-[#7B61C9] to-[#8C74DC] text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-[#6B52B6]/25">
                {branding.logoInitials}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                  {branding.companyName}
                </h3>
                <span className="text-[10px] font-bold text-[#6B52B6] tracking-wider uppercase block mt-0.5">
                  {branding.portalSubtitle}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* User Profile */}
          <div className="mt-5 p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/50 via-white to-slate-50 border border-purple-200/60 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-1 ring-slate-200 shadow-sm">
                {initials}
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs leading-tight">
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Field User' : 'Field User'}
                </h4>
                <p className="text-[10px] font-bold text-[#6B52B6] uppercase tracking-tight mt-0.5">
                  {user?.rank || user?.role || 'Field Executive'}
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-white text-[#6B52B6] rounded-md border border-purple-200 shadow-sm">
              ONLINE
            </span>
          </div>

          {/* Section: Sales Pipeline */}
          {pipelineItems.length > 0 && (
            <div className="mt-6">
              <span className="text-[10px] font-extrabold text-[#6B52B6] tracking-widest uppercase block mb-2 px-3">
                Sales Pipeline
              </span>
              <nav className="space-y-1">
                {pipelineItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-[#6B52B6]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Section: Targets & Quotas */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-extrabold text-[#6B52B6] tracking-widest uppercase block mb-2 px-3">
              Revenue & Targets
            </span>
            <nav className="space-y-1">
              {targetItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: Field Operations */}
          {fieldItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
                Field Operations
              </span>
              <nav className="space-y-1">
                {fieldItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Section: Financials & Executive Analytics */}
          {financeItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
                Finance & Performance
              </span>
              <nav className="space-y-1">
                {financeItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {'badge' in item && item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Section: Attendance & HR */}
          {attendanceItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-2 px-3">
                Attendance & Time
              </span>
              <nav className="space-y-1">
                {attendanceItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-50 text-[#6B52B6] font-extrabold border border-purple-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#6B52B6]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Quick Config / Setup Wizard */}
          {onOpenWizard && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase block mb-2 px-2">
                Administration
              </span>
              <button
                onClick={() => {
                  onOpenWizard();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-purple-50 border border-purple-200 text-[#6B52B6] font-bold text-xs hover:bg-purple-100 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Wand2 className="w-4 h-4 text-[#6B52B6]" />
                  <span>Client Setup Wizard</span>
                </div>
                <span className="text-[10px] bg-purple-200 text-[#6B52B6] px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                  Config
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Bottom: Sign Out */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 stroke-[2]" />
              <span>Sign Out</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
