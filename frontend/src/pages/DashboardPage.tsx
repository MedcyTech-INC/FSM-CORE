import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Play,
  Square,
  AlertCircle,
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Greeting & Leave Balance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Hello, {user?.first_name || 'Alex'} {user?.last_name || ''}
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-0.5">Good Morning</p>
        </div>

        {/* Leave Balance Card */}
        <div
          onClick={() => onNavigate?.('leaves')}
          className="inline-flex items-center gap-3.5 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-sm self-start sm:self-auto cursor-pointer hover:border-[#6B52B6]/50 hover:shadow-md transition-all group"
          title="View Leave Requests"
        >
          <div className="w-11 h-11 rounded-xl border border-slate-200/80 flex items-center justify-center text-[#6B52B6] bg-purple-50 group-hover:scale-105 transition-transform">
            <Coffee className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Leave Balance
            </span>
            <span className="text-lg font-black text-slate-900 leading-none">
              {totalLeaveDays} <span className="text-xs font-semibold text-slate-500">days</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Punch Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl border border-slate-200/80 flex items-center justify-center text-slate-700 bg-slate-50 shadow-inner">
            {isPunchedIn ? (
              <span className="w-4 h-4 rounded-full bg-[#6B52B6] animate-pulse" />
            ) : (
              <Play className="w-6 h-6 ml-0.5 text-slate-700" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
              {isPunchedIn ? 'Punched In' : isCompleted ? 'Shift Completed' : 'Punched Out'}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Today - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {attendance?.punch_in_time && (
                <span className="ml-1 text-slate-700 font-semibold">
                  • In at {new Date(attendance.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>

        <div>
          {!isCompleted ? (
            <button
              onClick={handlePunchToggle}
              disabled={gpsLoading}
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isPunchedIn
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-[#6B52B6] hover:bg-[#5B42A4] text-white shadow-[#6B52B6]/25'
              }`}
            >
              {gpsLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying GPS...</span>
                </>
              ) : isPunchedIn ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Punch Out</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Punch In</span>
                </>
              )}
            </button>
          ) : (
            <span className="inline-block px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold">
              Shift Finished
            </span>
          )}
        </div>
      </div>

      {/* AI Daily Sales Plan Quick Hero Card */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-[#1E293B] rounded-3xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>AI Route Optimization</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Today's AI Sales Plan & Route
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            MCDA candidate prioritization with target pacing boost, 2-Opt TSPTW dynamic travel minimization, and automated 45-minute lunch break scheduling.
          </p>
        </div>

        <button
          onClick={() => onNavigate?.('daily-plan')}
          className="px-6 py-3.5 rounded-2xl bg-[#00897B] hover:bg-teal-600 text-white font-extrabold text-xs shadow-md shadow-teal-900/40 transition-all hover:scale-[1.03] inline-flex items-center justify-center gap-2 self-start md:self-auto shrink-0"
        >
          <span>Open Sales Route</span>
        </button>
      </div>

      {/* Attendance Summary Section */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-[#6B52B6]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Attendance Summary</h3>
          </div>
          <span className="px-3 py-1 bg-purple-50 text-[#6B52B6] text-[11px] font-extrabold rounded-xl uppercase tracking-wider border border-purple-100">
            This Month
          </span>
        </div>

        {/* Visual blocks matching original layout */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="h-28 bg-[#F8FAFC] rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Mon</span>
            <span className="text-lg font-black text-slate-800">8.2 hrs</span>
          </div>
          <div className="h-28 bg-[#F8FAFC] rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Tue</span>
            <span className="text-lg font-black text-slate-800">8.5 hrs</span>
          </div>
          <div className="h-28 bg-[#F8FAFC] rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Wed</span>
            <span className="text-lg font-black text-slate-800">7.8 hrs</span>
          </div>
          <div className="h-28 bg-[#F8FAFC] rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Thu</span>
            <span className="text-lg font-black text-slate-800">8.0 hrs</span>
          </div>
          <div className="h-28 bg-[#F8FAFC] rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Fri</span>
            <span className="text-lg font-black text-slate-800">8.4 hrs</span>
          </div>
          <div className="h-28 bg-[#6B52B6] text-white rounded-2xl p-4 flex flex-col justify-between shadow-md shadow-[#6B52B6]/25">
            <span className="text-[11px] font-bold text-purple-200 uppercase">Today</span>
            <span className="text-lg font-black text-white">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
