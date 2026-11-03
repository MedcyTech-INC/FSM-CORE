import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Building2,
  Users,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { branding } from '../config/branding';

interface LoginPageProps {
  onOpenSuperAdmin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenSuperAdmin }) => {
  const [email, setEmail] = useState('admin@fsm.com');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'field' | 'super'>('admin');
  const { login, isLoading, error } = useAuthStore();

  const handleSelectRole = (role: 'admin' | 'field' | 'super') => {
    setSelectedRole(role);
    if (role === 'admin') {
      setEmail('admin@fsm.com');
      setPassword('demo123');
    } else if (role === 'super') {
      setEmail('superadmin@fsm.com');
      setPassword('demo123');
    } else {
      setEmail('rep@fsm.com');
      setPassword('demo123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-white font-sans text-slate-800 lg:overflow-hidden">
      {/* ===================================================================== */}
      {/* LEFT COLUMN: Clean White Login Form (Full width on mobile)           */}
      {/* ===================================================================== */}
      <div className="w-full lg:w-1/2 min-h-screen lg:h-full flex flex-col justify-between p-5 sm:p-8 lg:p-6 xl:p-8 bg-white relative z-10 overflow-y-auto lg:overflow-hidden">
        {/* Top bar / header note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {branding.companyName}
            </span>
          </div>
          {/* Quick Demo Switcher for fast testing */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 shadow-xs self-start sm:self-auto max-w-full overflow-x-auto scrollbar-none">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 px-1 shrink-0">Demo:</span>
            <button
              type="button"
              onClick={() => handleSelectRole('admin')}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                selectedRole === 'admin'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Admin
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('field')}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                selectedRole === 'field'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Field Rep
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole('super')}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                selectedRole === 'super'
                  ? 'bg-[#0369A1] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
              title="Platform Super-Admin: Onboard and govern corporate client organizations"
            >
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-sky-200" />
                Super Admin
              </span>
            </button>
          </div>
        </div>

        {/* Center Auth Form */}
        <div className="w-full max-w-sm mx-auto my-auto py-4 sm:py-6 lg:py-2 xl:py-4">
          {/* Diamond Dot Icon */}
          <div className="flex justify-center mb-3 xl:mb-4">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100/80 flex items-center justify-center shadow-xs">
              <svg
                className="w-7 h-7 text-[#0284C7]"
                viewBox="0 0 40 40"
                fill="currentColor"
              >
                <circle cx="20" cy="8" r="2.8" />
                <circle cx="14" cy="14" r="2.8" />
                <circle cx="26" cy="14" r="2.8" />
                <circle cx="8" cy="20" r="2.8" />
                <circle cx="20" cy="20" r="2.8" />
                <circle cx="32" cy="20" r="2.8" />
                <circle cx="14" cy="26" r="2.8" />
                <circle cx="26" cy="26" r="2.8" />
                <circle cx="20" cy="32" r="2.8" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-5 xl:mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0284C7] tracking-tight">
              Welcome to {branding.companyName}
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
              Field sales operations, doctor visit tracking, and follow-up commitments made effortless.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-600 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-200/90 text-slate-800 text-base sm:text-sm placeholder-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#0284C7]/10 transition-all bg-slate-50/50 focus:bg-white"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-200/90 text-slate-800 text-base sm:text-sm placeholder-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#0284C7]/10 transition-all bg-slate-50/50 focus:bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#075985] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-sky-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  'Log In'
                )}
              </button>
            </div>
          </form>

          {/* Bottom Sign-Up Link */}
          <div className="text-center mt-4 text-xs text-slate-500 font-medium">
            Don't have an account?{' '}
            <span className="text-[#0284C7] hover:underline cursor-pointer font-semibold">
              Sign Up
            </span>
          </div>

          {/* Quick Direct Link to Platform Super Admin Portal */}
          {onOpenSuperAdmin && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onOpenSuperAdmin}
                className="w-full py-2.5 px-3 rounded-xl bg-sky-50/80 hover:bg-sky-100 text-[#0284C7] border border-sky-200/80 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer group"
              >
                <Shield className="w-3.5 h-3.5 text-[#0284C7] shrink-0 group-hover:scale-110 transition-transform" />
                <span className="truncate sm:whitespace-normal">🏢 SaaS Super-Admin: Onboard Organizations &rarr;</span>
              </button>
            </div>
          )}
        </div>

        {/* Left Footer */}
        <div className="text-center text-[11px] text-slate-400 pt-2">
          {branding.footerText}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT COLUMN: Ice Blue Hero Graphics (Hidden on mobile, flex on desktop) */}
      {/* ===================================================================== */}
      <div className="hidden lg:flex lg:w-1/2 h-full bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#075985] flex-col justify-between items-center p-6 sm:p-8 lg:p-8 xl:p-10 relative overflow-hidden select-none">
        {/* Subtle decorative glows */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-sky-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full" />

        {/* Floating Cards Container */}
        <div className="w-full max-w-md mx-auto relative flex flex-col items-center justify-center my-auto py-2 xl:py-4">
          {/* TOP CARD: Total Revenues / Pipeline (Offset Top-Right) */}
          <div className="w-full flex justify-end z-20 -mb-5 sm:-mr-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl shadow-sky-950/30 border border-white/60 flex items-center justify-between gap-6 w-72 sm:w-80 transition-transform hover:-translate-y-1 duration-200">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-black">
                    ₹
                  </div>
                  <span>Total Revenues</span>
                </div>

                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
                  ₹4,105<span className="text-xs sm:text-sm font-semibold text-slate-400">/4,123</span>
                </div>

                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                  <span>Monthly Profit</span>
                  <span className="text-emerald-500 font-bold">+₹2,560.78</span>
                </div>
              </div>

              {/* Progress Ring (67% Green) */}
              <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center shrink-0">
                <svg className="w-16 h-16 sm:w-18 sm:h-18 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="3.2"
                    strokeDasharray="67, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xs sm:text-sm font-bold text-slate-800">
                  67%
                </span>
              </div>
            </div>
          </div>

          {/* MAIN CARD: Calendar Widget (Centered / Shifted Left) */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-2xl shadow-sky-950/30 border border-white/60 w-72 sm:w-84 z-10 -ml-4 sm:-ml-8 transition-transform hover:-translate-y-1 duration-200">
            {/* Month Header */}
            <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-800 mb-4">
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tracking-tight text-slate-700 font-extrabold">March</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-2.5">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-700 gap-y-3">
              {/* Previous month days */}
              <span className="text-slate-300">25</span>
              <span className="text-slate-300">26</span>
              <span className="text-slate-300">27</span>
              <span className="text-slate-300">28</span>

              {/* Day 1 with green indicator dot */}
              <span className="relative flex flex-col items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-1" />
                <span>1</span>
              </span>

              <span>2</span>
              <span>3</span>

              {/* Week 2 */}
              <span>4</span>
              <span>5</span>
              {/* Day 6 with red indicator dot */}
              <span className="relative flex flex-col items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute -top-1" />
                <span>6</span>
              </span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>

              {/* Week 3 */}
              <span>11</span>
              <span>12</span>
              <span>13</span>
              <span>14</span>
              <span>15</span>
              {/* Day 16 Active Selection (Ice Blue solid pill) */}
              <span className="flex items-center justify-center">
                <span className="w-7 h-7 rounded-full bg-[#0284C7] text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/40">
                  16
                </span>
              </span>
              <span>17</span>

              {/* Week 4 */}
              <span>18</span>
              <span>19</span>
              <span>20</span>
              <span>21</span>
              <span>22</span>
              <span>23</span>
              <span>24</span>

              {/* Week 5 */}
              <span>25</span>
              <span>26</span>
              <span>27</span>
              <span>28</span>
              <span>29</span>
              <span>30</span>
              <span>31</span>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className="text-center max-w-sm mx-auto z-10 pt-2 pb-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Easy to Understand
          </h2>
          <p className="text-xs text-sky-100/90 mt-2 leading-relaxed">
            Real-time visibility over field visits, doctor commitments, and team follow-ups in one unified place.
          </p>
        </div>
      </div>
    </div>
  );
};
