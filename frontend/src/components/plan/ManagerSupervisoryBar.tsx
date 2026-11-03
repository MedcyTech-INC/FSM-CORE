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
    <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-4 md:p-5 shadow-lg border border-slate-700/80 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Console Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-teal-400">
                Manager Supervisory Console
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-200 border border-teal-400/30 tracking-wider uppercase">
                HQ & Territory Scope
              </span>
            </div>
            <p className="text-sm font-black text-white mt-0.5 tracking-tight">
              Review, Approve, or Reject Subordinate Sales Routes
            </p>
          </div>
        </div>

        {/* Right: Team Representative Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-2xl shadow-inner">
            <Users className="w-4 h-4 text-teal-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Viewing Territory Representative:
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => onSelectEmployee(e.target.value)}
                className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer pr-4"
              >
                {TEAM_MEMBERS.map((member) => (
                  <option key={member.id} value={member.id} className="bg-slate-900 text-white">
                    {member.name} ({member.role} — {member.territory})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Route Status Pill for the selected rep */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs font-bold">
            {planStatus === 'APPROVED' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Approved</span>
              </span>
            )}
            {planStatus === 'PENDING_APPROVAL' && (
              <span className="inline-flex items-center gap-1.5 text-amber-300 animate-pulse">
                <Clock className="w-4 h-4" />
                <span>Pending Review</span>
              </span>
            )}
            {planStatus === 'REJECTED' && (
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Rejected</span>
              </span>
            )}
            {planStatus === 'NO_ROUTE' && (
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <FileQuestion className="w-4 h-4" />
                <span>No Route Generated</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
