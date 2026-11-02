import React, { useEffect, useState } from 'react';
import {
  Filter,
  ChevronRight,
  CheckCircle,
  RefreshCw,
  Building2,
  UserCheck,
  MapPin,
} from 'lucide-react';
import { AlertItemDTO, AttentionPriority } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';
import { AlertActionModal } from '../components/AlertActionModal';

interface AlertsDashboardPageProps {
  onSelectAlert: (alertId: string) => void;
  onNavigateToRules?: () => void;
  canConfigureRules?: boolean;
}

export const AlertsDashboardPage: React.FC<AlertsDashboardPageProps> = ({
  onSelectAlert,
  onNavigateToRules,
  canConfigureRules = false,
}) => {
  const [alerts, setAlerts] = useState<AlertItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<AlertItemDTO | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await revenueLeakageApi.fetchAlerts({
        attention_priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 20,
      });
      setAlerts(data.items);
      setTotal(data.total);
    } catch {
      // Mock fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [page, priorityFilter, statusFilter]);

  const getPriorityBadge = (priority: AttentionPriority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            HIGH ATTENTION
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            MEDIUM
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
            LOW
          </span>
        );
    }
  };

  const getEntityIcon = (type: string) => {
    if (type === 'lead') return <UserCheck className="w-3.5 h-3.5 text-blue-600" />;
    if (type === 'territory') return <MapPin className="w-3.5 h-3.5 text-emerald-600" />;
    return <Building2 className="w-3.5 h-3.5 text-teal-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-[#00897B] font-bold text-xs border border-teal-100">
              Operational Warnings
            </span>
            <span className="text-xs text-slate-400">Nightly Scanner Active</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Field Operational Warnings
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Automated compliance and run-rate oversight across client cadence, open leads, order frequency, and territory pace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAlerts}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh Alert List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canConfigureRules && onNavigateToRules && (
            <button
              onClick={onNavigateToRules}
              className="px-4 py-2 text-xs font-bold text-[#00897B] bg-[#F0FDF9] border border-teal-200/80 rounded-xl hover:bg-teal-50 transition-colors"
            >
              Configure Rules
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="high">High Attention</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none"
            >
              <option value="active">Active Warnings</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing {alerts.length} of {total} records
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="w-8 h-8 text-[#00897B] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">Loading operational warnings...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">All Operations Healthy</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No operational warnings match your active filters. Scheduled scans will notify if thresholds are exceeded.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-5 bg-white rounded-2xl border border-slate-100 hover:border-teal-200 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              onClick={() => onSelectAlert(alert.id)}
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {getPriorityBadge(alert.attention_priority)}
                  <span className="text-xs font-bold text-slate-400">·</span>
                  <span className="text-xs font-bold text-[#00897B] uppercase tracking-wide">
                    {alert.rule_name}
                  </span>
                  {alert.occurrence_no > 1 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Occurrence {alert.occurrence_no}
                    </span>
                  )}
                  {alert.escalation_level > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      Escalated L{alert.escalation_level}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    {getEntityIcon(alert.entity_type)}
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    {alert.entity_label}
                  </h4>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {alert.priority_reason}
                </p>

                {alert.exposure_amount && alert.exposure_basis && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <span>Reference Exposure:</span>
                    <span className="text-slate-800 font-bold">
                      INR {Number(alert.exposure_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400">({alert.exposure_basis})</span>
                  </div>
                )}
              </div>

              {/* Action Buttons & Status */}
              <div
                className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {alert.status === 'active' && (
                  <button
                    onClick={() => setSelectedAlertForAction(alert)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] rounded-xl shadow-sm transition-all"
                  >
                    Take Action
                  </button>
                )}
                <button
                  onClick={() => onSelectAlert(alert.id)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                  title="View Detail"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {selectedAlertForAction && (
        <AlertActionModal
          alert={selectedAlertForAction}
          isOpen={true}
          onClose={() => setSelectedAlertForAction(null)}
          onSuccess={() => {
            setSelectedAlertForAction(null);
            loadAlerts();
          }}
        />
      )}
    </div>
  );
};
