import React from 'react';
import {
  X,
  Home,
  Camera,
  CalendarDays,
  Moon,
  CheckSquare,
  Receipt,
  BarChart3,
  Heart,
  Wand2,
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
  const { user } = useAuthStore();
  const { features } = useFeatureStore();

  if (!isOpen) return null;

  const initials = user
    ? `${user.first_name[0] || ''}${user.last_name[0] || ''}`.toUpperCase()
    : 'TB';

  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';

  const allMenuItems = [
    { id: 'dashboard', label: 'Home Dashboard', icon: Home, enabled: true },
    { id: 'attendance', label: 'My Attendance', icon: CalendarDays, enabled: features.attendance },
    { id: 'visits', label: 'Visit Log', icon: Camera, enabled: features.field_visits },
    { id: 'expenses', label: 'Expense Claims', icon: Receipt, enabled: features.expenses },
    { id: 'analytics', label: 'Executive Analytics', icon: BarChart3, enabled: features.analytics && canViewAnalytics },
    { id: 'leaves', label: 'Leave Requests', icon: Moon, enabled: features.leaves },
    { id: 'tasks', label: 'Work Assignment', icon: CheckSquare, enabled: features.tasks },
  ];

  const menuItems = allMenuItems.filter((item) => item.enabled);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
        <div className="p-6 overflow-y-auto flex-1">
          {/* Company Branding Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#00897B] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-teal-700/20">
                {branding.logoInitials}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  {branding.companyName}
                </h3>
                <span className="text-[11px] font-bold text-[#00897B] tracking-wider uppercase block">
                  {branding.portalSubtitle}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="mt-6 p-4 rounded-2xl bg-[#F0FDF9] border border-teal-100/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00897B] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {initials}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'Test BE'}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-0.5">
                  {user?.rank || 'BUSINESS EXECUTIVE'}
                </p>
              </div>
            </div>
            <button className="text-[11px] font-extrabold text-[#00897B] tracking-wider hover:underline">
              PROFILE
            </button>
          </div>

          {/* Section: Employee Dashboards */}
          <div className="mt-8">
            <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase block mb-3 px-2">
              Employee Dashboards
            </span>

            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#E6F7F5] text-[#00897B] border border-teal-200/80 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#00897B]' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

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
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900 font-bold text-xs hover:bg-teal-100/70 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Wand2 className="w-4 h-4 text-teal-700" />
                  <span>Client Setup Wizard</span>
                </div>
                <span className="text-[10px] bg-teal-200/90 text-teal-900 px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                  Config
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50/60">
          <Heart className="w-4 h-4 text-[#00897B]" />
          <span>{branding.footerText}</span>
        </div>
      </div>
    </div>
  );
};
