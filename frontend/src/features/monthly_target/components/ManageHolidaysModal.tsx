import React, { useState, useEffect } from 'react';
import { X, CalendarDays, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { targetsApi, TargetsApiError } from '../api/targetsApi';
import { HolidayDTO } from '../types';

interface ManageHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  canEdit?: boolean;
}

export const ManageHolidaysModal: React.FC<ManageHolidaysModalProps> = ({
  isOpen,
  onClose,
  canEdit = true,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [holidays, setHolidays] = useState<HolidayDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [newDate, setNewDate] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRegion, setNewRegion] = useState<string>('National');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchHolidays = async (year: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await targetsApi.getHolidays(year);
      setHolidays(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load holidays');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHolidays(selectedYear);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, selectedYear]);

  if (!isOpen) return null;

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      setError('Date and holiday name are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await targetsApi.addHoliday({
        holiday_date: newDate,
        name: newName.trim(),
        region: newRegion.trim() || 'National',
      });
      setSuccessMsg(`Holiday "${newName}" added successfully.`);
      setNewName('');
      setNewDate('');
      // Auto switch to year of added holiday if different
      const addedYear = parseInt(newDate.split('-')[0], 10);
      if (addedYear !== selectedYear) {
        setSelectedYear(addedYear);
      } else {
        await fetchHolidays(selectedYear);
      }
    } catch (err: any) {
      if (err instanceof TargetsApiError) {
        setError(err.message);
      } else {
        setError(err?.message || 'Failed to add holiday.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (dateStr: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete holiday "${name}" (${dateStr})?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    try {
      await targetsApi.deleteHoliday(dateStr);
      setSuccessMsg(`Holiday "${name}" deleted.`);
      await fetchHolidays(selectedYear);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete holiday.');
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Official Company Holiday Calendar</h2>
              <p className="text-xs text-slate-500">
                Non-working days deducted when calculating target run rates and working days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Add Form (for Admin/Managers) */}
          {canEdit && (
            <div className="bg-teal-50/40 border border-teal-100/80 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Add / Append Holiday to Calendar
                </h3>
              </div>
              <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Holiday Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali, Eid, Republic Day"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Region</label>
                  <input
                    type="text"
                    placeholder="National / State"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isSubmitting ? 'Saving...' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Year Filter & Stats */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Select Year:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[2025, 2026, 2027, 2028].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedYear === yr
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {holidays.length} {holidays.length === 1 ? 'holiday' : 'holidays'} scheduled
            </span>
          </div>

          {/* Holidays List */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading holidays...</div>
          ) : holidays.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No holidays scheduled for {selectedYear}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use the form above to add holidays for this calendar year.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Holiday Name</th>
                    <th className="py-2.5 px-4">Region</th>
                    {canEdit && <th className="py-2.5 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map((h) => (
                    <tr key={h.holiday_date} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {formatDateDisplay(h.holiday_date)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{h.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 text-slate-700">
                          {h.region || 'National'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(h.holiday_date, h.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Delete holiday"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
