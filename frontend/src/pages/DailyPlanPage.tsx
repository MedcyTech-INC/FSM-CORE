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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Manager Supervisory Bar (Visible when user has Manager/Admin Authority) */}
      {canApprove && (
        <ManagerSupervisoryBar
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          activePlan={activePlan}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00897B] to-[#26A69A] flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                AI Daily Route & Plan
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Deterministic route optimization • Lead-centric CRM execution
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Primary Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={() => fetchTodayPlan(selectedDate, selectedEmployeeId)}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors"
            title="Refresh Route"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {activePlan && (
            <button
              onClick={resetPlan}
              className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              title="Reset current plan back to empty state to test generation again"
            >
              <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
              <span>Reset Plan</span>
            </button>
          )}

          <button
            onClick={openGenerateModal}
            className="px-4 py-2.5 rounded-2xl bg-[#00897B] hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm shadow-teal-700/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Itinerary</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800">
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
        <div className="rounded-3xl bg-white border border-[#EEF2F6] p-12 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-[#00897B] animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Loading daily itinerary...</p>
          <p className="text-xs text-slate-400">Verifying live plan and CRM targets</p>
        </div>
      ) : activePlan ? (
        <div className="space-y-6">
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
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
                Planned Stops & Milestones
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {activePlan.items.length} Timeline Elements
              </span>
            </div>

            <PlanTimeline items={activePlan.items} />
          </div>
        </div>
      ) : (
        /* Empty State: No Plan Generated Yet */
        <div className="rounded-3xl bg-white border border-[#EEF2F6] p-10 md:p-16 text-center space-y-5 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-teal-50 text-[#00897B] flex items-center justify-center mx-auto shadow-inner">
            <Navigation className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
              No Sales Route Generated for {selectedDate}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Generate an intelligent daily itinerary optimized with candidate-sensitive target
              pacing, OSRM 2-Opt traveling salesperson sequencing, and an approved 45-minute lunch break.
            </p>
          </div>

          <button
            onClick={openGenerateModal}
            className="px-6 py-3 rounded-2xl bg-[#00897B] hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-teal-700/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Today's Route</span>
          </button>
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
