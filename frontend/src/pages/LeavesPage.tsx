import React, { useState } from 'react';
import { api } from '../api/client';

export const LeavesPage: React.FC = () => {
  const [managerMode, setManagerMode] = useState(false);
  const [leaveType, setLeaveType] = useState('Monthly Leave Quota');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason) {
      setError('Please fill out all leave application fields');
      return;
    }
    setError(null);
    try {
      await api.applyLeave(leaveType, fromDate, toDate, reason);
      setSubmitted(true);
      setReason('');
      setFromDate('');
      setToDate('');
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit leave request');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card matching localhost_9590_leave.png */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Leave Requests</h2>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Submit and track your formal leave applications
          </p>
        </div>

        {/* Manager Mode Toggle Switch Pill */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50/80 border border-slate-200/80 rounded-2xl self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-[#00897B]" />
          <span className="text-[11px] font-extrabold text-slate-600 tracking-wider uppercase">
            Manager Mode
          </span>
          <button
            type="button"
            onClick={() => setManagerMode(!managerMode)}
            className={`w-11 h-6 rounded-full transition-colors relative ml-1 p-0.5 ${
              managerMode ? 'bg-[#00897B]' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                managerMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {submitted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">
          ✔ Your leave request has been submitted for approval.
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* Apply for Leave Card matching localhost_9590_leave.png */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00897B]" />
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Apply for Leave</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Leave Type */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00897B]"
            >
              <option value="Monthly Leave Quota">Monthly Leave Quota</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Earned Leave">Earned Leave</option>
              <option value="Unpaid Leave">Unpaid Leave</option>
            </select>
          </div>

          {/* From Date / To Date side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                From Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00897B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                To Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00897B]"
                />
              </div>
            </div>
          </div>

          {/* Reason for Leave */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
              Reason for Leave
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Not feeling well, family event..."
              className="w-full p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#00897B]"
            />
          </div>

          {/* Submit Button matching screenshot */}
          <button
            type="submit"
            className="w-full py-4 bg-[#00897B] hover:bg-[#00796B] text-white rounded-2xl font-bold text-sm shadow-md shadow-teal-700/20 transition-all text-center"
          >
            Submit Leave Application
          </button>
        </form>
      </div>
    </div>
  );
};
