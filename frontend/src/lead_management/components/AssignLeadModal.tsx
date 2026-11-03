import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCheck, Search } from 'lucide-react';
import { api } from '../../api/client';
import { User } from '../../types/api';

interface AssignLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployeeId: string;
  onConfirm: (newEmployeeId: string, notes?: string) => Promise<void>;
}

export const AssignLeadModal: React.FC<AssignLeadModalProps> = ({
  isOpen,
  onClose,
  currentEmployeeId,
  onConfirm,
}) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(currentEmployeeId);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api
        .getDirectory()
        .then((list) => {
          setEmployees(list.filter((u) => u.is_active));
        })
        .catch(() => {
          setEmployees([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || selectedEmpId === currentEmployeeId) {
      setError('Please choose a different employee to reassign to.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedEmpId, notes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reassign lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const full = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase()) || emp.role.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm font-sans animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
      />
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center shadow-subtle border border-sky-100/60">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Reassign Lead Ownership</h3>
              <p className="text-xs text-slate-500 font-medium">Transfer opportunity to a field representative</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search team member by name or role..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20 font-medium"
            />
          </div>

          {/* Employee List */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading directory...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No matching employees found</div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedEmpId === emp.id;
                const isCurrent = currentEmployeeId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-[#0284C7] bg-sky-50/80 ring-1 ring-[#0284C7]'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-slate-900 block">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">{emp.role}</span>
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        Current Rep
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Audit Notes */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
              Reason / Transfer Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Reassigned to territory specialist per sales realignment."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20 font-medium"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedEmpId === currentEmployeeId}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md shadow-[#0284C7]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Transferring...' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
