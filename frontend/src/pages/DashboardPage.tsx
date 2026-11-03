import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Play,
  Square,
  AlertCircle,
  Clock,
  Route,
  MapPin,
  Calendar,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { api } from '../api/client';
import { AttendanceRecord, LeaveBalance } from '../types/api';
import { useAuthStore } from '../store/authStore';
import { useGeolocation } from '../hooks/useGeolocation';

interface DashboardPageProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { getLocation, loading: gpsLoading } = useGeolocation();

  const loadData = async () => {
    try {
      const [todayAtt, bals] = await Promise.all([
        api.getTodayAttendance().catch(() => null),
        api.getLeaveBalances().catch(() => []),
      ]);
      setAttendance(todayAtt);
      setBalances(bals);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalLeaveDays = balances.reduce((acc, curr) => acc + curr.remaining_days, 0) || 18;

  const handlePunchToggle = async () => {
    setError(null);
    try {
      const coords = await getLocation();
      if (!attendance?.punch_in_time) {
        const res = await api.clockIn(coords.latitude, coords.longitude, coords.accuracy);
        setAttendance(res);
      } else if (!attendance?.punch_out_time) {
        const res = await api.clockOut(coords.latitude, coords.longitude, 'Day concluded');
        setAttendance(res);
      }
    } catch (err: any) {
      setError(err.message || 'GPS location acquisition failed');
    }
  };

  const isPunchedIn = !!attendance?.punch_in_time && !attendance?.punch_out_time;
  const isCompleted = !!attendance?.punch_out_time;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const punchInTimeFormatted = attendance?.punch_in_time
    ? new Date(attendance.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Shift Quick-Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Welcome back, {user?.first_name || 'Alex'}
            </h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-100">
              {user?.rank || user?.role || 'Field Lead'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Field operations, active visit schedule and daily compliance &bull; {todayFormatted}
          </p>
        </div>

        {/* Punch In / Out Quick Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex flex-col text-left sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Shift Status
            </span>
            <span className="text-xs font-bold text-slate-800 flex items-center sm:justify-end gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPunchedIn ? 'bg-[#0284C7] animate-pulse' : isCompleted ? 'bg-slate-400' : 'bg-slate-300'
                }`}
              />
              {isPunchedIn
                ? `Active (${punchInTimeFormatted})`
                : isCompleted
                ? 'Concluded'
                : 'Punched Out'}
            </span>
          </div>

          {!isCompleted ? (
            <button
              onClick={handlePunchToggle}
              disabled={gpsLoading}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isPunchedIn
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80'
                  : 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-[#0284C7]/20 hover:scale-[1.01]'
              }`}
            >
              {gpsLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Verifying GPS...</span>
                </>
              ) : isPunchedIn ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Punch Out</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Punch In</span>
                </>
              )}
            </button>
          ) : (
            <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
              Shift Completed
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Row of 3 Compact KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Daily Shift Status */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-sky-300/60 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7]">
              <Clock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
              Presence
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Current Shift
            </span>
            <div className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {isPunchedIn ? 'On Duty & Active' : isCompleted ? 'Completed for Today' : 'Punched Out'}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 truncate">
              {isPunchedIn && punchInTimeFormatted
                ? `Clocked in at ${punchInTimeFormatted} • GPS verified`
                : isCompleted
                ? 'All field records logged for today'
                : 'Punch in above to begin field tracking'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Hours today</span>
            <span className="font-bold text-slate-800">{isPunchedIn ? 'In Progress' : isCompleted ? '8.4 hrs' : '0.0 hrs'}</span>
          </div>
        </div>

        {/* Card 2: AI Daily Sales Plan */}
        <div
          onClick={() => onNavigate?.('daily-plan')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-[#0284C7]/60 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7] group-hover:scale-105 transition-transform">
              <Route className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-sky-50 text-[#0284C7] border border-sky-100 font-mono">
              Route Plan
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Today's Field Calls
            </span>
            <div className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              4 Scheduled Visits
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 truncate">
              Optimized travel path with target pacing boost
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#0284C7] font-bold group-hover:translate-x-0.5 transition-transform">
            <span>Open Sales Plan</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Leave Quota & Balances */}
        <div
          onClick={() => onNavigate?.('leaves')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-[#0284C7]/60 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7] group-hover:scale-105 transition-transform">
              <Coffee className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
              Balance
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Available Leave
            </span>
            <div className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {totalLeaveDays} Days <span className="text-xs font-semibold text-slate-400">remaining</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 truncate">
              Casual, medical & earned quota balance
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#0284C7] font-bold group-hover:translate-x-0.5 transition-transform">
            <span>Apply or View Leaves</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Operational Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left (7 cols): Today's Field Route & Execution Plan */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-[#0284C7] shrink-0">
                  <MapPin className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight truncate">
                    Today's Priority Route & Visits
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400 block truncate">
                    Dynamic transit minimization &amp; HCP calls
                  </span>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('daily-plan')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0284C7] border border-sky-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>View Route</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stops List */}
            <div className="space-y-2.5">
              {/* Stop 1 */}
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100/90 flex items-center justify-between gap-3 hover:bg-sky-50/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 truncate">Dr. Arvind Sharma</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-[#0284C7] shrink-0">
                        Cardiology
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Apollo Hospital, OPD Block B &bull; 09:30 AM</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                  High Priority
                </span>
              </div>

              {/* Stop 2 */}
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100/90 flex items-center justify-between gap-3 hover:bg-sky-50/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 truncate">Dr. Priya Deshmukh</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        Pediatrics
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Care Wellness Clinic &bull; 11:45 AM</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                  Scheduled
                </span>
              </div>

              {/* Stop 3 */}
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100/90 flex items-center justify-between gap-3 hover:bg-sky-50/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 truncate">Dr. Rajesh Kothari</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-[#0284C7] shrink-0">
                        Internal Med
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Fortis Healthcare Center &bull; 02:30 PM</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                  Follow-up
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium flex-wrap gap-2">
            <span>3 stops remaining &bull; 14.8 km travel</span>
            <button
              onClick={() => onNavigate?.('visits')}
              className="text-[#0284C7] font-bold hover:underline cursor-pointer"
            >
              Log Visit Outcome &rarr;
            </button>
          </div>
        </div>

        {/* Right (5 cols): Weekly Attendance Pulse */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-[#0284C7]">
                  <Calendar className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    Weekly Attendance
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400">
                    Daily logged hours &amp; compliance
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[#0284C7] text-[10px] font-extrabold border border-sky-100 uppercase tracking-wider font-mono">
                This Week
              </span>
            </div>

            {/* 6-Day Strip matching design */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-3">
              <div className="bg-[#F8FAFC] rounded-xl p-1.5 sm:p-2.5 text-center border border-slate-100 flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Mon</span>
                <span className="text-xs font-black text-slate-800">8.2h</span>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-1.5 sm:p-2.5 text-center border border-slate-100 flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Tue</span>
                <span className="text-xs font-black text-slate-800">8.5h</span>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-1.5 sm:p-2.5 text-center border border-slate-100 flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Wed</span>
                <span className="text-xs font-black text-slate-800">7.8h</span>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-1.5 sm:p-2.5 text-center border border-slate-100 flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Thu</span>
                <span className="text-xs font-black text-slate-800">8.0h</span>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-1.5 sm:p-2.5 text-center border border-slate-100 flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Fri</span>
                <span className="text-xs font-black text-slate-800">8.4h</span>
              </div>
              <div className="bg-[#0284C7] text-white rounded-xl p-1.5 sm:p-2.5 text-center shadow-xs flex flex-col justify-between h-16 sm:h-18">
                <span className="text-[9px] sm:text-[10px] font-bold text-sky-200 uppercase">Today</span>
                <span className="text-xs font-black text-white">Active</span>
              </div>
            </div>

            {/* Cumulative Metric bar */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-600">Weekly Total</span>
                <span className="text-slate-900 font-extrabold">32.9 / 40.0 hrs</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-[#0284C7]" style={{ width: '82%' }} />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">100% Punctuality recorded</span>
            <button
              onClick={() => onNavigate?.('attendance')}
              className="text-[#0284C7] font-bold hover:underline cursor-pointer"
            >
              Full Timesheet &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
