import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { ScanRunDTO } from '../types';
import { revenueLeakageApi } from '../api/revenueLeakageApi';

interface ScanRunsPageProps {
  onBack: () => void;
}

export const ScanRunsPage: React.FC<ScanRunsPageProps> = ({ onBack }) => {
  const [runs, setRuns] = useState<ScanRunDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await revenueLeakageApi.fetchScanRuns();
      setRuns(data);
    } catch {
      // Mock fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> SUCCEEDED
          </span>
        );
      case 'running':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" /> RUNNING
          </span>
        );
      case 'skipped_source_missing':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            SKIPPED SOURCE MISSING
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> FAILED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Warning Rules</span>
        </button>

        <button
          onClick={loadRuns}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Refresh Scans"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-[#00897B] font-bold text-xs border border-teal-100">
            Engine Health & Audit
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Nightly Scanner Runs & Reliability Log
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xl">
          Monitors automated rule evaluations, heartbeat status, source dependency availability, and sync-grace exclusions.
        </p>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="w-8 h-8 text-[#00897B] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">Loading scanner logs...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rule Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Evaluated</th>
                  <th className="py-3 px-4">Created / Updated / Cleared</th>
                  <th className="py-3 px-4">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{run.rule_code}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(run.status)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {run.mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{run.rows_evaluated} rows</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      <span className="text-emerald-700 font-bold">+{run.alerts_created}</span> created ·{' '}
                      <span className="text-blue-700 font-bold">{run.alerts_updated}</span> updated ·{' '}
                      <span className="text-teal-700 font-bold">{run.alerts_cleared}</span> cleared
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(run.started_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
