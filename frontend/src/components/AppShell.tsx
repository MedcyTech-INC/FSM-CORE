import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Search,
  Home,
  MapPin,
  LogOut,
  Users,
  CalendarDays,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { branding } from '../config/branding';
import { NavigationDrawer } from './NavigationDrawer';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, children }) => {
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'FC'
    : 'FC';

  const isLeakageActive =
    currentTab === 'revenue-leakage' ||
    currentTab === 'leakage-rules' ||
    currentTab === 'leakage-scans';
  const isTargetsActive = currentTab === 'targets' || currentTab === 'team-targets';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-['Inter',sans-serif] flex flex-col justify-between">
      {/* Slide-out Drawer */}
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentTab={currentTab}
        onSelectTab={onTabChange}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#EEF2F6] px-4 md:px-8 py-3 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Menu Toggle + Dynamic Company Brand */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00897B] to-[#26A69A] flex items-center justify-center text-white shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-slate-900 tracking-tight text-base uppercase">
                    {branding.companyName}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#00897B] tracking-wider uppercase block mt-0.5">
                  {branding.portalSubtitle}
                </span>
              </div>
            </div>
          </div>

          {/* Center Quick Navigation Links (Desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onTabChange('revenue-leakage')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                isLeakageActive
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm'
                  : 'bg-rose-50/50 text-rose-600 border border-rose-100 hover:bg-rose-100/60'
              }`}
              title="Revenue Leakage Alerts & Oversight"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Revenue Leakage</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </button>

            <button
              onClick={() => onTabChange('targets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                isTargetsActive
                  ? 'bg-teal-50 text-[#00897B] border border-teal-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-[#00897B]" />
              <span>Monthly Targets</span>
            </button>

            <button
              onClick={() => onTabChange('visits')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'visits'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Field Visits
            </button>
          </div>

          {/* Right: Direct Mode, Notifications, User Avatar */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Quick Mobile Revenue Leakage Pill */}
            <button
              onClick={() => onTabChange('revenue-leakage')}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-[11px] font-bold"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Leakage</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </button>

            {/* Direct Mode Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Direct Mode</span>
            </div>

            {/* Notification Bell -> Direct jump to Revenue Leakage alerts */}
            <button
              onClick={() => onTabChange('revenue-leakage')}
              className="relative w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200/70 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Active Revenue Leakage Alerts"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </button>

            {/* Search Icon */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200/70 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Search Navigation"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 py-1 pr-3 bg-slate-50 border border-slate-200/70 rounded-full">
              <div className="w-8 h-8 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-xs">
                {initials}
              </div>
              <div className="hidden md:block text-left pr-1">
                <span className="font-bold text-xs text-slate-900 block leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'Field User'}
                </span>
                <span className="text-[10px] font-medium text-slate-500 block leading-tight">
                  {user?.rank || user?.role || 'Field Executive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 pb-24 md:pb-12">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EEF2F6] z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {/* Home */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-2 ${
              currentTab === 'dashboard' ? 'text-[#00897B]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {currentTab === 'dashboard' && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#00897B] rounded-full" />
            )}
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* Revenue Leakage */}
          <button
            onClick={() => onTabChange('revenue-leakage')}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-2 ${
              isLeakageActive ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {isLeakageActive && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-rose-600 rounded-full" />
            )}
            <div className="relative">
              <ShieldAlert className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold">Leakage</span>
          </button>

          {/* Targets */}
          <button
            onClick={() => onTabChange('targets')}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-2 ${
              isTargetsActive ? 'text-[#00897B]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {isTargetsActive && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#00897B] rounded-full" />
            )}
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-bold">Targets</span>
          </button>

          {/* Visits */}
          <button
            onClick={() => onTabChange('visits')}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-2 ${
              currentTab === 'visits' ? 'text-[#00897B]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {currentTab === 'visits' && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#00897B] rounded-full" />
            )}
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] font-bold">Visits</span>
          </button>

          {/* Attendance */}
          <button
            onClick={() => onTabChange('attendance')}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-2 ${
              currentTab === 'attendance' ? 'text-[#00897B]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {currentTab === 'attendance' && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#00897B] rounded-full" />
            )}
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px] font-bold">Attendance</span>
          </button>

          {/* Menu Drawer Toggle */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors py-1 px-2"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-bold">Menu</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors py-1 px-2"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-bold">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
