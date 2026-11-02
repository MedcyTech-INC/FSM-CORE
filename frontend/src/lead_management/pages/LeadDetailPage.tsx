import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  User,
  Plus,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useLeadsStore } from '../store';
import { LeadStageChip } from '../components/LeadStageChip';
import { LeadTimeline } from '../components/LeadTimeline';
import { StageProgressBar } from '../components/StageProgressBar';
import { StageChangeModal } from '../components/StageChangeModal';
import { AssignLeadModal } from '../components/AssignLeadModal';
import { followupsApi } from '../../followups/api';
import { Followup } from '../../followups/types';
import { FollowupCard } from '../../followups/components/FollowupCard';
import { FollowupFormPage } from '../../followups/pages/FollowupFormPage';

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
}

export const LeadDetailPage: React.FC<LeadDetailPageProps> = ({ leadId, onBack }) => {
  const { selectedLead, timeline, isLoading, fetchLeadDetail, changeStage, assignLead } = useLeadsStore();

  const [leadFollowups, setLeadFollowups] = useState<Followup[]>([]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddingFollowup, setIsAddingFollowup] = useState(false);

  const loadFollowups = async () => {
    try {
      const list = await followupsApi.listFollowups({ lead_id: leadId });
      setLeadFollowups(list);
    } catch {
      setLeadFollowups([]);
    }
  };

  useEffect(() => {
    fetchLeadDetail(leadId);
    loadFollowups();
  }, [leadId, fetchLeadDetail]);

  if (isLoading || !selectedLead) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-9 h-9 border-3 border-[#6B52B6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">Loading opportunity details...</p>
      </div>
    );
  }

  const formattedValue = selectedLead.expected_value
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
        selectedLead.expected_value
      )
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16 max-w-6xl mx-auto">
      {/* 1. TOP NAVIGATION & ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-all shadow-sm active:scale-95 cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          <span>Back to Opportunities Pipeline</span>
        </button>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setIsAddingFollowup(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-purple-50 text-[#6B52B6] hover:bg-purple-100 border border-purple-200/80 text-xs font-extrabold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Schedule Follow-up</span>
          </button>

          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 text-xs font-extrabold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Reassign</span>
          </button>

          <button
            onClick={() => setIsStageModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#6B52B6] hover:bg-[#5B42A4] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#6B52B6]/25 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Change Stage</span>
          </button>
        </div>
      </div>

      {/* 2. STAGE PROGRESSION PIPELINE STEPPER */}
      <StageProgressBar
        currentStage={selectedLead.stage}
        onStageClick={() => setIsStageModalOpen(true)}
      />

      {/* 3. HERO OVERVIEW CARD */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
              <div className="w-6 h-6 rounded-lg bg-purple-50 text-[#6B52B6] flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-slate-800 text-sm">
                {selectedLead.customer_name || 'Individual Customer'}
              </span>
              <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black border border-slate-200/70">
                {selectedLead.customer_type}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {selectedLead.title}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <LeadStageChip stage={selectedLead.stage} size="md" />
            {formattedValue && (
              <span className="text-xl font-black text-emerald-800 bg-emerald-50 px-4 py-1.5 rounded-xl border border-emerald-200/80 shadow-sm tabular-nums">
                {formattedValue}
              </span>
            )}
          </div>
        </div>

        {/* Quick Attributes Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Opportunity Type
            </span>
            <span className="font-extrabold text-slate-900 mt-1 block">{selectedLead.lead_type}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Assigned Representative
            </span>
            <span className="font-extrabold text-slate-900 mt-1 block">
              {selectedLead.employee_name || 'Assigned Rep'}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Lead Source
            </span>
            <span className="font-extrabold text-slate-900 mt-1 block">{selectedLead.lead_source}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Priority Status
            </span>
            <span
              className={`inline-block font-black text-[10px] uppercase px-2.5 py-0.5 rounded-md mt-1 border ${
                selectedLead.priority === 'HIGH'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : selectedLead.priority === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {selectedLead.priority} PRIORITY
            </span>
          </div>
        </div>

        {/* Interested Product & Customer Response */}
        {(selectedLead.interested_product_service || selectedLead.customer_response) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 text-xs">
            {selectedLead.interested_product_service && (
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100">
                <span className="text-[10px] font-extrabold text-[#6B52B6] uppercase tracking-widest block mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interested Product / Service</span>
                </span>
                <span className="font-extrabold text-purple-950 text-sm block">
                  {selectedLead.interested_product_service}
                </span>
              </div>
            )}
            {selectedLead.customer_response && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                  Customer Response / Demand
                </span>
                <span className="font-bold text-slate-800 text-sm block italic">
                  "{selectedLead.customer_response}"
                </span>
              </div>
            )}
          </div>
        )}

        {/* Converted or Lost Outcome Banners */}
        {selectedLead.stage === 'CONVERTED' && selectedLead.conversion_outcome && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold text-emerald-900 block text-sm">
                Conversion Outcome & Agreement
              </span>
              <p className="text-emerald-800 mt-1 font-medium">{selectedLead.conversion_outcome}</p>
            </div>
          </div>
        )}

        {selectedLead.stage === 'LOST' && selectedLead.loss_reason && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold text-rose-900 block text-sm">Reason for Loss</span>
              <p className="text-rose-800 mt-1 font-medium">{selectedLead.loss_reason}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN DETAILS & TIMELINE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Details & Scheduled Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes & Contact Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
              Opportunity Notes & Direct Contacts
            </h3>

            {selectedLead.notes ? (
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                {selectedLead.notes}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No special requirements or notes recorded.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              {selectedLead.contact_person && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-extrabold">
                      Contact Person
                    </span>
                    <span className="font-bold text-slate-900">{selectedLead.contact_person}</span>
                  </div>
                </div>
              )}

              {selectedLead.contact_phone && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#6B52B6] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-extrabold">
                      Direct Phone
                    </span>
                    <a
                      href={`tel:${selectedLead.contact_phone}`}
                      className="font-bold text-[#6B52B6] hover:text-[#5B42A4] hover:underline"
                    >
                      {selectedLead.contact_phone}
                    </a>
                  </div>
                </div>
              )}

              {selectedLead.location_city && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-extrabold">
                      Territory / City
                    </span>
                    <span className="font-bold text-slate-900">{selectedLead.location_city}</span>
                  </div>
                </div>
              )}

              {selectedLead.expected_close_date && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-extrabold">
                      Expected Close
                    </span>
                    <span className="font-bold text-slate-900">
                      {new Date(selectedLead.expected_close_date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked Follow-ups Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                  Scheduled Next Steps ({leadFollowups.length})
                </h3>
                <p className="text-xs text-slate-500 font-medium">Actions committed to this opportunity</p>
              </div>

              <button
                onClick={() => setIsAddingFollowup(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 text-[#6B52B6] hover:bg-purple-100 text-xs font-black rounded-xl border border-purple-200/70 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Follow-up</span>
              </button>
            </div>

            {leadFollowups.length === 0 ? (
              <div className="py-10 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6">
                <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-extrabold text-slate-700">No follow-up action scheduled</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Promised a clinical demo, quotation, or review visit? Never drop an opportunity without a scheduled next step.
                </p>
                <button
                  onClick={() => setIsAddingFollowup(true)}
                  className="mt-4 px-4 py-2 bg-[#6B52B6] hover:bg-[#5B42A4] text-white text-xs font-bold rounded-xl shadow-md shadow-[#6B52B6]/20 transition-all cursor-pointer"
                >
                  Schedule Next Action
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {leadFollowups.map((fup) => (
                  <FollowupCard key={fup.id} followup={fup} onRefresh={loadFollowups} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Activity Timeline */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-4 h-fit sticky top-20">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Audit Timeline</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Verified history of stage & ownership changes</p>
          </div>
          <LeadTimeline timeline={timeline} />
        </div>
      </div>

      {/* 5. MODAL DIALOGS */}
      <StageChangeModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        currentStage={selectedLead.stage}
        pendingFollowupsCount={leadFollowups.filter((f) => f.status === 'PENDING').length}
        onConfirm={async (data) => {
          await changeStage(selectedLead.id, data);
        }}
      />

      <AssignLeadModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        currentEmployeeId={selectedLead.employee_id}
        onConfirm={async (newId, notes) => {
          await assignLead(selectedLead.id, { new_employee_id: newId, notes });
        }}
      />

      {/* Clean Centered Modal Dialog for Add Follow-up */}
      {isAddingFollowup &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 font-sans">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200"
              onClick={() => setIsAddingFollowup(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl z-10 overflow-y-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <FollowupFormPage
                prefillLeadId={selectedLead.id}
                prefillCustomerName={selectedLead.customer_name}
                onClose={() => setIsAddingFollowup(false)}
                onCreated={() => {
                  setIsAddingFollowup(false);
                  loadFollowups();
                  fetchLeadDetail(selectedLead.id);
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
