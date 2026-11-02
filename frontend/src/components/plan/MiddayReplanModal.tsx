import React, { useState, useEffect } from 'react';
import { X, RefreshCw, MapPin, AlertCircle, Sparkles, Navigation } from 'lucide-react';

interface MiddayReplanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    currentLatitude: number;
    currentLongitude: number;
    replanReason: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export const MiddayReplanModal: React.FC<MiddayReplanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [currentLat, setCurrentLat] = useState<number>(12.9716);
  const [currentLon, setCurrentLon] = useState<number>(77.5946);
  const [reason, setReason] = useState('Traffic delay / road congestion');
  const [customReason, setCustomReason] = useState('');
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
        setCurrentLat(pos.coords.latitude);
        setCurrentLon(pos.coords.longitude);
        setIsGpsLoading(false);
      },
      () => {
        // Fallback default
        setIsGpsLoading(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      fetchGps();
      setReason('Traffic delay / road congestion');
      setCustomReason('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      setErrorMsg('Please specify a reason for replanning.');
      return;
    }

    try {
      setErrorMsg(null);
      await onSubmit({
        currentLatitude: currentLat,
        currentLongitude: currentLon,
        replanReason: finalReason,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Midday replan failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#00897B] flex items-center justify-center shadow-xs">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Dynamic Midday Route Replan
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Re-optimize remaining stops from your current GPS position.
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

        {/* Algorithm Safeguards Notice */}
        <div className="p-3.5 rounded-2xl bg-[#F0FDF9] border border-teal-100/90 text-xs text-teal-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#00897B]" />
            <span>Deterministic Route Continuity Safeguards:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-teal-800/90 space-y-0.5">
            <li>Any currently active stop (ARRIVED) remains pinned.</li>
            <li>Completed and skipped stops are permanently locked.</li>
            <li>45-minute lunch break is preserved between 13:00 and 14:15.</li>
            <li>Pending stops are re-sequenced via 2-Opt TSPTW algorithm.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Location */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#00897B]" />
                Starting GPS Origin
              </span>
              <button
                type="button"
                onClick={fetchGps}
                disabled={isGpsLoading}
                className="text-[11px] text-[#00897B] hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isGpsLoading ? 'animate-spin' : ''}`} />
                <span>Update GPS</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-xl border border-slate-100 flex items-center justify-between">
              <span>Lat: {currentLat.toFixed(5)}</span>
              <span>Lon: {currentLon.toFixed(5)}</span>
            </div>
          </div>

          {/* Replan Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reason for Replanning <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00897B]"
            >
              <option value="Traffic delay / road congestion">Traffic delay / road congestion</option>
              <option value="Doctor emergency / appointment delayed">Doctor emergency / appointment delayed</option>
              <option value="Client requested visit cancellation">Client requested visit cancellation</option>
              <option value="Severe weather / impassable route">Severe weather / impassable route</option>
              <option value="Other">Other reason...</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Reason Details
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain the operational reason..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
          )}

          {/* Action Buttons */}
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
              className="px-6 py-2.5 rounded-xl bg-[#00897B] hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-700/20 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              <span>{isLoading ? 'Re-optimizing...' : 'Calculate New Route'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
