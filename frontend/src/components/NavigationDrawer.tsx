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
      <div className="relative w-80 max-w-[85vw] bg-white h-[100dvh] shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200">
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0284C7] via-[#0EA5E9] to-[#38BDF8] text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                {branding.logoInitials}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                  {branding.companyName}
                </h3>
                <span className="text-[10px] font-bold text-[#0284C7] tracking-wider uppercase block mt-0.5">
                  All Modules & Navigation
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* Section: Sales Pipeline */}
          {pipelineItems.length > 0 && (
            <div>
              <span className="text-[10px] font-extrabold text-[#0284C7] tracking-widest uppercase block mb-1.5 px-2">
                Sales Pipeline
              </span>
              <nav className="space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-[#0284C7]">
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
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[10px] font-extrabold text-[#0284C7] tracking-widest uppercase block mb-1.5 px-2">
              Revenue & Targets
            </span>
            <nav className="space-y-0.5">
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
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
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-1.5 px-2">
                Field Operations
              </span>
              <nav className="space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
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
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-1.5 px-2">
                Finance & Performance
              </span>
              <nav className="space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {'badge' in item && item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-100">
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
            <div className="pt-3 border-t border-slate-100 pb-4">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-1.5 px-2">
                Attendance & Time
              </span>
              <nav className="space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-[#0284C7] font-extrabold border border-sky-200 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-[#0284C7]' : 'text-slate-400'}`} />
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
            <div className="pt-3 border-t border-slate-100 pb-2">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block mb-1.5 px-2">
                Administration
              </span>
              <button
                onClick={() => {
                  onOpenWizard();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#0284C7] font-bold text-xs hover:bg-sky-100 transition-all shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Client Setup Wizard</span>
                </div>
                <span className="text-[9px] bg-sky-200/80 text-[#0284C7] px-1.5 py-0.5 rounded uppercase font-mono font-bold">
                  Config
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Bottom: Sign Out */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
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
