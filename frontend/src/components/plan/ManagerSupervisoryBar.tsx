import React from 'react';
import { Users, Shield, CheckCircle2, Clock, AlertTriangle, FileQuestion } from 'lucide-react';
import { PlanResponse } from '../../types/plan';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  territory: string;
  isManager?: boolean;
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alex Vance',
    role: 'General Director / Admin',
    territory: 'HQ / Northern Zone',
    isManager: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Rahul Sharma',
    role: 'Senior Medical Rep (MR)',
    territory: 'South Mumbai Zone',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Amit Sharma',
    role: 'Medical Representative (MR)',
    territory: 'North Delhi Region',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Priya Patel',
    role: 'Medical Representative (MR)',
    territory: 'Bangalore Central Zone',
  },
];

interface ManagerSupervisoryBarProps {
  selectedEmployeeId: string;
  onSelectEmployee: (employeeId: string) => void;
  activePlan: PlanResponse | null;
}

export const ManagerSupervisoryBar: React.FC<ManagerSupervisoryBarProps> = ({
  selectedEmployeeId,
  onSelectEmployee,
  activePlan,
}) => {
  const planStatus = activePlan?.status || 'NO_ROUTE';

  return (
    <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Console Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7] shadow-xs shrink-0">
            <Shield className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-[#0284C7]">
                Manager Supervisory Console
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-[#0284C7] border border-sky-100 tracking-wider uppercase">
                HQ & Territory
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 tracking-tight truncate">
              Review, Approve, or Reject Subordinate Sales Routes
            </p>
          </div>
        </div>

        {/* Right: Team Representative Selector & Status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Representative Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 px-3 py-2 rounded-xl flex-1 min-w-0">
            <Users className="w-4 h-4 text-[#0284C7] shrink-0" />
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Representative
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => onSelectEmployee(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full truncate"
              >
                {TEAM_MEMBERS.map((member) => (
                  <option key={member.id} value={member.id} className="text-slate-900">
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Route Status Pill */}
          <div className="flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-bold shrink-0">
            {planStatus === 'APPROVED' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Approved</span>
              </span>
            )}
            {planStatus === 'PENDING_APPROVAL' && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Pending Review</span>
              </span>
            )}
            {planStatus === 'REJECTED' && (
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Rejected</span>
              </span>
            )}
            {planStatus === 'NO_ROUTE' && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <FileQuestion className="w-4 h-4 text-slate-400" />
                <span>No Route Generated</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
