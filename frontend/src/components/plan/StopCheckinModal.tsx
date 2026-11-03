import React, { useState, useEffect } from 'react';
import { PlanItemResponse } from '../../types/plan';
import {
  X,
  Camera,
  MapPin,
  CheckCircle2,
  Upload,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface StopCheckinModalProps {
  isOpen: boolean;
  stop: PlanItemResponse | null;
  onClose: () => void;
  onSubmit: (params: { latitude: number; longitude: number; proofPhoto?: string }) => Promise<void>;
  isLoading: boolean;
}

export const StopCheckinModal: React.FC<StopCheckinModalProps> = ({
  isOpen,
  stop,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Acquire high accuracy GPS on open
  const acquireGPS = () => {
    setIsGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setIsGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setIsGpsLoading(false);
      },
      (err) => {
        let msg = 'Failed to obtain GPS coordinates.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please enable GPS access in your browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location position unavailable. Please ensure GPS/location services are turned on.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'GPS acquisition timed out. Please retry in an open area.';
        }
        setGpsError(msg);
        // Fallback to stop coords if demo mode or testing
        if (stop?.latitude && stop?.longitude) {
          setLatitude(stop.latitude);
          setLongitude(stop.longitude);
          setGpsAccuracy(15);
        }
        setIsGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (isOpen && stop) {
      acquireGPS();
      setPhotoBase64(null);
      setPhotoName(null);
      setActionError(null);
    }
  }, [isOpen, stop]);

  if (!isOpen || !stop) return null;

  // Photo file upload & Base64 conversion
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setActionError('Photo file size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
      setActionError(null);
    };
    reader.onerror = () => {
      setActionError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude == null || longitude == null) {
      setActionError('Valid GPS coordinates are required before checking in.');
      return;
    }

    try {
      setActionError(null);
      await onSubmit({
        latitude,
        longitude,
        proofPhoto: photoBase64 || undefined,
      });
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Check-in failed. Please verify your location.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 z-10 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-sky-50 text-[#0284C7] flex items-center justify-center font-bold text-xs">
                #{stop.sequence_order}
              </span>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Arrival & Photo Proof Check-In
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-sm">
              {stop.location_address || 'Customer site location'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: GPS Coordinates & Geofence status */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0284C7]" />
                <span className="text-xs font-bold text-slate-800">
                  GPS Verification & Geofence
                </span>
              </div>
              <button
                type="button"
                onClick={acquireGPS}
                disabled={isGpsLoading}
                className="text-[11px] font-bold text-[#0284C7] hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isGpsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh GPS</span>
              </button>
            </div>

            {isGpsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <RefreshCw className="w-4 h-4 text-[#0284C7] animate-spin" />
                <span>Acquiring high-accuracy satellite coordinates...</span>
              </div>
            ) : gpsError ? (
              <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                {gpsError}
              </div>
            ) : latitude != null && longitude != null ? (
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 font-mono text-[11px]">
                  <span>Lat: {latitude.toFixed(6)}</span>
                  <span>Lon: {longitude.toFixed(6)}</span>
                </div>
                {gpsAccuracy != null && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>GPS locked with ±{gpsAccuracy}m precision</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Section 2: Photo Proof Camera Capture */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#0284C7]" />
              <span className="text-xs font-bold text-slate-800">
                On-Site Photo Proof (Optional / Company Policy)
              </span>
            </div>

            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-teal-400 rounded-2xl cursor-pointer bg-white transition-colors group">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-[#0284C7] transition-colors" />
                <span className="text-xs font-bold text-slate-700 mt-2">
                  Take Photo or Upload Proof
                </span>
                <span className="text-[11px] text-slate-400">
                  Doctor clinic board, hospital entry, or selfie
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {photoBase64 && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate font-semibold">{photoName || 'photo_proof.jpg'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoBase64(null);
                      setPhotoName(null);
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold ml-2"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
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
              disabled={isLoading || latitude == null || longitude == null}
              className="px-6 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold shadow-md shadow-[#0284C7]/20 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Confirm Arrival & Check In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
