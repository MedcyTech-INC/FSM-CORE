import React, { useEffect, useState } from 'react';
import { usePlanStore } from '../store/planStore';
import { useAuthStore } from '../store/authStore';
import { RouteProgressCard } from '../components/plan/RouteProgressCard';
import { PlanTimeline } from '../components/plan/PlanTimeline';
import { PlanGenerateModal } from '../components/plan/PlanGenerateModal';
import { MiddayReplanModal } from '../components/plan/MiddayReplanModal';
import { ManagerSupervisoryBar } from '../components/plan/ManagerSupervisoryBar';
import { PlanRejectModal } from '../components/plan/PlanRejectModal';
import { PlanRejectionBanner } from '../components/plan/PlanRejectionBanner';
import {
  Sparkles,
  Calendar,
  AlertCircle,
  RefreshCw,
  Plus,
  Route,
  Navigation,
  RotateCcw,
} from 'lucide-react';

export const DailyPlanPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    activePlan,
    monthlyTarget,
    isLoading,
    isActionLoading,
    error,
    isGenerateModalOpen,
    isReplanModalOpen,
    fetchTodayPlan,
    fetchMonthlyTarget,
    generatePlan,
    replanMidday,
    reconcilePlan,
    approvePlan,
    openGenerateModal,
    closeGenerateModal,
    openReplanModal,
    closeReplanModal,
    clearError,
    resetPlan,
    selectedEmployeeId,
    setSelectedEmployeeId,
    isRejectModalOpen,
    openRejectModal,
    closeRejectModal,
    rejectPlan,
  } = usePlanStore();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchTodayPlan(selectedDate, selectedEmployeeId);
    fetchMonthlyTarget();
  }, [selectedDate, selectedEmployeeId, fetchTodayPlan, fetchMonthlyTarget]);

  const canApprove =
    user?.role && ['ADMIN', 'GM', 'ZSM', 'RSM', 'MANAGER'].includes(user.role);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
      {/* Manager Supervisory Bar (Visible when user has Manager/Admin Authority) */}
      {canApprove && (
        <ManagerSupervisoryBar
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          activePlan={activePlan}
        />
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] flex items-center justify-center text-white shadow-xs shrink-0">
              <Route className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                AI Daily Route & Plan
              </h1>
              <p className="text-xs text-slate-500 font-medium truncate">
                Deterministic route optimization • Lead-centric execution
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Primary Action */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 px-3 py-2 rounded-xl flex-1 sm:flex-initial">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none w-full cursor-pointer"
            />
          </div>

          <button
            onClick={() => fetchTodayPlan(selectedDate, selectedEmployeeId)}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Refresh Route"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0284C7]' : ''}`} />
          </button>

          {activePlan && (
            <button
              onClick={resetPlan}
              className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Reset current plan back to empty state to test generation again"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={openGenerateModal}
            className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm shadow-[#0284C7]/20 transition-all hover:scale-[1.01] w-full sm:w-auto cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Generate Itinerary</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-8 sm:p-12 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-[#0284C7] animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Loading daily itinerary...</p>
          <p className="text-xs text-slate-400">Verifying live plan and CRM targets</p>
        </div>
      ) : activePlan ? (
        <div className="space-y-4 sm:space-y-5">
          {/* Rejection Alert Banner (Visible when plan is rejected by Manager) */}
          {activePlan.status === 'REJECTED' && (
            <PlanRejectionBanner
              plan={activePlan}
              onRegenerate={openGenerateModal}
              isActionLoading={isActionLoading}
            />
          )}

          {/* Hero KPI Summary Card */}
          <RouteProgressCard
            plan={activePlan}
            target={monthlyTarget}
            isActionLoading={isActionLoading}
            onReplan={openReplanModal}
            onReconcile={reconcilePlan}
            onApprove={approvePlan}
            onReject={openRejectModal}
            canApprove={canApprove}
          />

          {/* Chronological Itinerary Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">
                Planned Stops & Milestones
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {activePlan.items.length} Elements
              </span>
            </div>

            <PlanTimeline items={activePlan.items} />
          </div>
        </div>
      ) : (
        /* Empty State: No Plan Generated Yet */
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-10 md:p-14 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center mx-auto shadow-inner">
            <Navigation className="w-7 h-7 stroke-[2]" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
              No Sales Route Generated
            </h2>
            <div>
              <span className="text-xs font-bold text-[#0284C7] bg-sky-50 px-3 py-1 rounded-lg border border-sky-100 inline-block font-mono">
                {selectedDate}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              Generate an intelligent daily itinerary optimized with candidate-sensitive target
              pacing, 2-Opt traveling salesperson sequencing, and an approved 45-minute lunch break.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={openGenerateModal}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm shadow-[#0284C7]/20 transition-all hover:scale-[1.01] cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Today's Route</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals Suite (Planning & Supervisory Only) */}
      <PlanGenerateModal
        isOpen={isGenerateModalOpen}
        onClose={closeGenerateModal}
        onSubmit={generatePlan}
        isLoading={isActionLoading}
      />

      <MiddayReplanModal
        isOpen={isReplanModalOpen}
        onClose={closeReplanModal}
        onSubmit={replanMidday}
        isLoading={isActionLoading}
      />

      <PlanRejectModal
        isOpen={isRejectModalOpen}
        onClose={closeRejectModal}
        onSubmit={rejectPlan}
        repName="Rahul Sharma (Senior MR)"
        isLoading={isActionLoading}
      />
    </div>
  );
};
