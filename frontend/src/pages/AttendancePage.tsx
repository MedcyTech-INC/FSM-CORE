import React from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const currentMonth = 'October 2026';

  // Days in month mock representation
  const calendarDays = [
    { day: '', status: '' }, { day: '', status: '' }, { day: '', status: '' }, { day: 1, status: 'present' }, { day: 2, status: 'present' }, { day: 3, status: 'present' }, { day: 4, status: 'holiday' },
    { day: 5, status: 'present' }, { day: 6, status: 'present' }, { day: 7, status: 'present' }, { day: 8, status: 'present' }, { day: 9, status: 'present' }, { day: 10, status: 'present' }, { day: 11, status: 'holiday' },
    { day: 12, status: 'present' }, { day: 13, status: 'present' }, { day: 14, status: 'present' }, { day: 15, status: 'present' }, { day: 16, status: 'present' }, { day: 17, status: 'present' }, { day: 18, status: 'holiday' },
    { day: 19, status: 'present' }, { day: 20, status: 'present' }, { day: 21, status: 'present' }, { day: 22, status: 'present' }, { day: 23, status: 'present' }, { day: 24, status: 'present' }, { day: 25, status: 'holiday' },
    { day: 26, status: 'present' }, { day: 27, status: 'present' }, { day: 28, status: 'present' }, { day: 29, status: 'present' }, { day: 30, status: 'present' }, { day: 31, status: 'present' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Monthly Summary Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00897B]" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentMonth}</h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Previous Month
            </button>
            <button className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1">
              Next Month <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Present */}
          <div className="p-5 rounded-2xl bg-[#F0FDF9]/80 border border-emerald-100/70 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Present Days
              </span>
              <span className="text-3xl font-black text-[#00897B]">4</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
          </div>

          {/* Absent */}
          <div className="p-5 rounded-2xl bg-[#FEF2F2]/80 border border-rose-100/70 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Absent Days
              </span>
              <span className="text-3xl font-black text-[#E11D48]">0</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FEF2F2] border border-rose-200 text-rose-500 flex items-center justify-center">
              <X className="w-6 h-6 stroke-[3]" />
            </div>
          </div>

          {/* Half Days */}
          <div className="p-5 rounded-2xl bg-[#FFFBEB]/80 border border-amber-100/70 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Half Days
              </span>
              <span className="text-3xl font-black text-[#D97706]">0</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] border border-amber-200 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          {/* Leaves Taken */}
          <div className="p-5 rounded-2xl bg-[#F5F3FF]/80 border border-purple-100/70 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Leaves Taken
              </span>
              <span className="text-3xl font-black text-[#7C3AED]">0</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#F5F3FF] border border-purple-200 text-purple-600 flex items-center justify-center">
              <Moon className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Sheet Grid Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00897B]" />
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              My Attendance Sheet - {currentMonth}
            </h3>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00897B]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
              <span>Half Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
              <span>On Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Holiday</span>
            </div>
          </div>
        </div>

        {/* Calendar Days Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-100 text-center py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <div>SUN</div>
            <div>MON</div>
            <div>TUE</div>
            <div>WED</div>
            <div>THU</div>
            <div>FRI</div>
            <div>SAT</div>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarDays.map((cell, idx) => (
              <div
                key={idx}
                className="h-20 p-2.5 flex flex-col justify-between hover:bg-slate-50/60 transition-colors"
              >
                {cell.day ? (
                  <>
                    <span className="text-xs font-bold text-slate-600">{cell.day}</span>
                    <div className="self-end">
                      {cell.status === 'present' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00897B] block" />
                      )}
                      {cell.status === 'holiday' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 block" />
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
