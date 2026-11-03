import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  MapPin,
  RefreshCw,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface PlanGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    startLatitude: number;
    startLongitude: number;
    maxStops?: number;
    planDate?: string;
    forceRegenerate?: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

export const PlanGenerateModal: React.FC<PlanGenerateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxStops, setMaxStops] = useState<number>(6);
  const [startLat, setStartLat] = useState<number>(12.9716);
  const [startLon, setStartLon] = useState<number>(77.5946);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchGps = () => {
    setIsGpsLoading(true);
    setErrorMsg(null);
    if (!navigator.geolocation) {
      setIsGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartLat(pos.coords.latitude);
        setStartLon(pos.coords.longitude);
        setIsGpsLoading(false);
      },
      () => {
        setIsGpsLoading(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      setPlanDate(new Date().toISOString().split('T')[0]);
      setMaxStops(6);
      setForceRegenerate(false);
      setErrorMsg(null);
      fetchGps();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg(null);
      await onSubmit({
        startLatitude: startLat,
        startLongitude: startLon,
        maxStops,
        planDate,
        forceRegenerate,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Plan generation failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Generate AI Daily Sales Plan
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic route optimization & MCDA lead selection
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Algorithm Highlights */}
        <div className="p-3.5 rounded-2xl bg-[#F0FDF9] border border-sky-100/90 text-xs text-slate-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Zap className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>AI Planning Features:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-teal-800/90 space-y-0.5">
            <li>MCDA scoring with target pacing and backlog capping.</li>
            <li>2-Opt TSPTW traveling salesperson itinerary optimization.</li>
            <li>Mandatory 45-min lunch break scheduled between 13:00 and 14:15.</li>
            <li>Commercial source of truth anchored to CRM Leads.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Plan Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Plan Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0284C7]"
                required
              />
            </div>
          </div>

          {/* Max Stops */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Maximum Stops (1 - 12)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={maxStops}
              onChange={(e) => setMaxStops(parseInt(e.target.value) || 6)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0284C7]"
              required
            />
          </div>

          {/* Starting GPS Origin */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                Daily Origin GPS (Shift Departure)
              </span>
              <button
                type="button"
                onClick={fetchGps}
                disabled={isGpsLoading}
                className="text-[11px] text-[#0284C7] hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isGpsLoading ? 'animate-spin' : ''}`} />
                <span>Get Device Location</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={startLat}
                  onChange={(e) => setStartLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={startLon}
                  onChange={(e) => setStartLon(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Force Regenerate */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRegenerate}
                onChange={(e) => setForceRegenerate(e.target.checked)}
                className="rounded text-[#0284C7] focus:ring-[#0284C7]"
              />
              <span className="text-xs font-medium text-slate-700">
                Force regenerate existing draft plan if already created
              </span>
            </label>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold shadow-md shadow-[#0284C7]/20 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Optimizing Route...' : 'Generate Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
