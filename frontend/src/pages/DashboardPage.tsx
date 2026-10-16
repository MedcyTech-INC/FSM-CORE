import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Play,
  Square,
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
    <div className="space-y-6">
      {/* Top Greeting & Leave Balance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Hello, {user?.first_name || 'Test'}
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-0.5">Good Morning</p>
        </div>

        {/* Leave Balance Card */}
        <div
          onClick={() => onNavigate?.('leaves')}
          className="inline-flex items-center gap-3.5 bg-white px-5 py-3 rounded-3xl border border-slate-200/70 shadow-sm self-start sm:self-auto cursor-pointer hover:border-teal-200 hover:shadow-md transition-all"
          title="View Leave Requests"
        >
          <div className="w-11 h-11 rounded-full border border-slate-200/80 flex items-center justify-center text-slate-600 bg-slate-50/50">
            <Coffee className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Leave Balance
            </span>
            <span className="text-lg font-black text-slate-900 leading-none">
              {totalLeaveDays} <span className="text-xs font-medium text-slate-500">days</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Punch Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border border-slate-200/80 flex items-center justify-center text-slate-700 bg-slate-50/60 shadow-inner">
            {isPunchedIn ? (
              <span className="w-4 h-4 rounded-full bg-[#00897B] animate-pulse" />
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
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isPunchedIn
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-[#00897B] hover:bg-[#00796B] text-white shadow-teal-700/20'
              }`}
            >
              {gpsLoading ? (
                'Verifying GPS...'
              ) : isPunchedIn ? (
                <>
                  <Square className="w-4 h-4" /> Punch Out
                </>
              ) : (
                'Punch In'
              )}
            </button>
          ) : (
            <span className="inline-block px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold">
              Shift Finished
            </span>
          )}
        </div>
      </div>

      {/* Attendance Summary Section */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-[#00897B]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Attendance Summary</h3>
          </div>
          <span className="px-3 py-1 bg-[#E6F7F5] text-[#00897B] text-[11px] font-extrabold rounded-xl uppercase tracking-wider">
            This Month
          </span>
        </div>

        {/* Visual blocks matching screenshot */}
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
          <div className="h-28 bg-[#00897B] text-white rounded-2xl p-4 flex flex-col justify-between shadow-md shadow-teal-700/20">
            <span className="text-[11px] font-bold text-teal-100 uppercase">Today</span>
            <span className="text-lg font-black text-white">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
