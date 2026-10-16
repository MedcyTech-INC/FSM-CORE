import React, { useEffect, useState } from 'react';
import {
  Camera,
  Plus,
  Phone,
  CheckCircle,
  MapPin,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { FieldVisit } from '../types/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCamera } from '../hooks/useCamera';

export const VisitsPage: React.FC = () => {
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [targetType, setTargetType] = useState('DOCTOR');
  const [targetName, setTargetName] = useState('');
  const [targetIdentifier, setTargetIdentifier] = useState('');

  const { getLocation } = useGeolocation();
  const { photoBase64, clearPhoto } = useCamera();

  const loadVisits = async () => {
    try {
      const data = await api.listVisits();
      setVisits(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName) return;

    try {
      await api.createVisit({
        target_type: targetType,
        target_name: targetName,
        target_identifier: targetIdentifier || undefined,
        visit_date: new Date().toISOString().split('T')[0],
      });
      setShowAddModal(false);
      setTargetName('');
      setTargetIdentifier('');
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartArrival = async (visitId: string) => {
    setError(null);
    try {
      const coords = await getLocation();
      await api.startVisit(visitId, coords.latitude, coords.longitude, photoBase64 || undefined);
      clearPhoto();
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleComplete = async (visitId: string) => {
    if (!notes) {
      setError('Please provide call notes before completing the visit');
      return;
    }
    try {
      await api.completeVisit(visitId, notes);
      setActiveVisitId(null);
      setNotes('');
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card matching localhost_9590_call-capture.png */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00897B] text-white flex items-center justify-center shadow-md shadow-teal-700/20">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Field Visit Log</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Log your field & clinic visits with GPS-verified arrival and departure proof photos
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3.5 bg-[#00897B] hover:bg-[#00796B] text-white rounded-2xl font-bold text-sm shadow-md shadow-teal-700/20 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Add Field Visit
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Today's Assigned Visits Card matching screenshot */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EEF2F6] shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#00897B] mb-1">
            <Phone className="w-5 h-5 stroke-[2.2]" />
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Today's Assigned Visits ({visits.length})
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400">
            Select a visit to begin logging your arrival proof
          </p>
        </div>

        {/* Empty State / Visit Items Container */}
        {visits.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-3xl py-20 flex flex-col items-center justify-center text-center">
            <div className="text-slate-300 mb-3">
              <Phone className="w-12 h-12 stroke-[1.2]" />
            </div>
            <p className="text-sm font-bold text-slate-600">No visits assigned for today yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl border border-slate-200/80 hover:border-teal-200 bg-slate-50/50 hover:bg-white transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#E6F7F5] text-[#00897B] border border-teal-200/70">
                      {v.target_type}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        v.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : v.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">{v.target_name}</h4>
                  {v.target_identifier && (
                    <span className="text-xs text-slate-400 block font-medium">Ref: {v.target_identifier}</span>
                  )}
                  {v.discussion_notes && (
                    <p className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded-xl border border-slate-200/60 font-medium">
                      📝 {v.discussion_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  {v.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleStartArrival(v.id)}
                      className="px-4 py-2 bg-[#00897B] hover:bg-[#00796B] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Check In Arrival
                    </button>
                  )}
                  {v.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => setActiveVisitId(v.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Complete Call
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {activeVisitId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">Conclude Field Visit</h3>
              <button onClick={() => setActiveVisitId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter discussion notes, products detailed, or client requests..."
              className="w-full p-3.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00897B] mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveVisitId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleComplete(activeVisitId)}
                className="px-5 py-2 bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold rounded-xl"
              >
                Save & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Schedule Field Visit</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Target Entity
                </label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-medium"
                >
                  <option value="DOCTOR">Doctor (Pharma)</option>
                  <option value="CHEMIST">Chemist / Pharmacy</option>
                  <option value="FARMER">Farmer (Agriculture)</option>
                  <option value="DEALER">Dealer / Distributor</option>
                  <option value="PLANT">Industrial Facility / Plant</option>
                  <option value="EQUIPMENT">Machinery / Asset</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Target Name
                </label>
                <input
                  type="text"
                  required
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith, Green Valley Farm"
                  className="w-full p-3 border border-slate-200 rounded-2xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Registration / Account ID (Optional)
                </label>
                <input
                  type="text"
                  value={targetIdentifier}
                  onChange={(e) => setTargetIdentifier(e.target.value)}
                  placeholder="e.g. DOC-9082 or AGRI-401"
                  className="w-full p-3 border border-slate-200 rounded-2xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold rounded-xl"
                >
                  Schedule Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
