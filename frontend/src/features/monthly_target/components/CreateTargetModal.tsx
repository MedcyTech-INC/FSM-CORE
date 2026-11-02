import React, { useState, useEffect } from 'react';
import {
  X,
  Target as TargetIcon,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { targetsApi, TargetsApiError } from '../api/targetsApi';
import {
  MetricType,
  TargetCreatePayload,
  TargetAssignmentCreatePayload,
} from '../types';

interface CreateTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTargetModal: React.FC<CreateTargetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [metricType, setMetricType] = useState<MetricType>('doctor_visits');
  const [targetValue, setTargetValue] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assignments, setAssignments] = useState<TargetAssignmentCreatePayload[]>([
    { entity_type: 'representative', entity_id: '22222222-2222-2222-2222-222222222222' },
  ]);

  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Generate a fresh idempotency key every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(crypto.randomUUID());
      setErrorBanner(null);
      setFieldErrors({});

      // Set default dates: 1st of next month to end of next month, or current month
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${lastDay}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddAssignment = () => {
    setAssignments([
      ...assignments,
      { entity_type: 'representative', entity_id: '22222222-2222-2222-2222-222222222222' },
    ]);
  };

  const handleRemoveAssignment = (index: number) => {
    if (assignments.length <= 1) return;
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleUpdateAssignment = (index: number, field: 'entity_type' | 'entity_id', val: string) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: val };
    setAssignments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setFieldErrors({});

    // Client validation
    const errs: Record<string, string> = {};
    if (!title.trim() || title.length < 3) {
      errs.title = 'Title must be at least 3 characters long.';
    }
    const valNum = Number(targetValue);
    if (!targetValue || isNaN(valNum) || valNum <= 0) {
      errs.target_value = 'Target value must be a positive number.';
    }
    if (['doctor_visits', 'new_leads', 'conversions'].includes(metricType) && !Number.isInteger(valNum)) {
      errs.target_value = 'Count metrics require whole numbers.';
    }
    if (!startDate) errs.start_date = 'Start date is required.';
    if (!endDate) errs.end_date = 'End date is required.';
    if (startDate && endDate && endDate <= startDate) {
      errs.end_date = 'End date must be strictly after start date.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TargetCreatePayload = {
        title: title.trim(),
        metric_type: metricType,
        target_value: valNum,
        start_date: startDate,
        end_date: endDate,
        assignments,
      };

      await targetsApi.createTarget(payload, idempotencyKey);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof TargetsApiError) {
        if (err.code === 'overlapping_target') {
          setErrorBanner('A representative already has an active individual target for this metric in overlapping dates.');
        } else if (err.code === 'outside_scope') {
          setErrorBanner('One or more assignees are outside your reporting hierarchy scope.');
        } else if (err.code === 'not_supported') {
          setErrorBanner(err.message || 'Customer and product targets are currently disabled.');
        } else {
          setErrorBanner(err.message || 'Failed to create target.');
        }
      } else {
        setErrorBanner(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00897B] text-white flex items-center justify-center shadow-sm">
              <TargetIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">Create Monthly Target</h3>
              <p className="text-xs font-medium text-slate-500">Set numeric goals for reps, teams or territories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Error Banner */}
          {errorBanner && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Target Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. November Doctor Coverage Drive"
              className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 ${
                fieldErrors.title ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'
              }`}
            />
            {fieldErrors.title && <span className="text-xs text-rose-600 font-bold block mt-1">{fieldErrors.title}</span>}
          </div>

          {/* Metric Type & Target Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Metric Tracked *
              </label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value as MetricType)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20"
              >
                <option value="doctor_visits">Doctor Visits</option>
                <option value="revenue">Revenue (INR)</option>
                <option value="collections">Collections (INR)</option>
                <option value="new_leads">New Leads</option>
                <option value="conversions">Conversions</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Goal Value *
              </label>
              <input
                type="number"
                step={['revenue', 'collections'].includes(metricType) ? '0.01' : '1'}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={['revenue', 'collections'].includes(metricType) ? '₹ 5,00,000' : '120'}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 ${
                  fieldErrors.target_value ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'
                }`}
              />
              {fieldErrors.target_value && (
                <span className="text-xs text-rose-600 font-bold block mt-1">{fieldErrors.target_value}</span>
              )}
            </div>
          </div>

          {/* Date Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 ${
                  fieldErrors.start_date ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'
                }`}
              />
              {fieldErrors.start_date && (
                <span className="text-xs text-rose-600 font-bold block mt-1">{fieldErrors.start_date}</span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 ${
                  fieldErrors.end_date ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'
                }`}
              />
              {fieldErrors.end_date && (
                <span className="text-xs text-rose-600 font-bold block mt-1">{fieldErrors.end_date}</span>
              )}
            </div>
          </div>

          {/* Assignments Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assignees ({assignments.length}) *
              </label>
              <button
                type="button"
                onClick={handleAddAssignment}
                className="text-xs font-bold text-[#00897B] hover:text-[#00796B] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Assignee
              </button>
            </div>

            <div className="space-y-2.5">
              {assignments.map((asg, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80"
                >
                  <select
                    value={asg.entity_type}
                    onChange={(e) => handleUpdateAssignment(index, 'entity_type', e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                  >
                    <option value="representative">Representative (MR)</option>
                    <option value="team">Sales Team</option>
                    <option value="territory">Territory</option>
                    <option value="branch">Branch</option>
                    <option value="customer" disabled>Customer (Disabled)</option>
                    <option value="product" disabled>Product (Disabled)</option>
                  </select>

                  <select
                    value={asg.entity_id}
                    onChange={(e) => handleUpdateAssignment(index, 'entity_id', e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                  >
                    {asg.entity_type === 'representative' && (
                      <>
                        <option value="22222222-2222-2222-2222-222222222222">Rahul Sharma (MR - Mumbai)</option>
                        <option value="33333333-3333-3333-3333-333333333333">Priya Verma (MR - Pune)</option>
                      </>
                    )}
                    {asg.entity_type === 'team' && (
                      <option value="44444444-4444-4444-4444-444444444444">Cardio Sales Team Alpha</option>
                    )}
                    {asg.entity_type === 'territory' && (
                      <option value="55555555-5555-5555-5555-555555555555">South Mumbai Zone</option>
                    )}
                    {asg.entity_type === 'branch' && (
                      <option value="66666666-6666-6666-6666-666666666666">Western Maharashtra Branch</option>
                    )}
                  </select>

                  {assignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignment(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Note: Customer and Product targets are disabled until master product lines are linked.
            </p>
          </div>

          {/* Submit Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-[#00897B] hover:bg-[#00796B] transition-all shadow-sm shadow-teal-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Target...
                </>
              ) : (
                'Create Target'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
