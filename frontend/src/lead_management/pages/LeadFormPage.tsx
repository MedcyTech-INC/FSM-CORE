import React, { useState, useEffect } from 'react';
import { ArrowLeft, Building2, IndianRupee, Calendar, Sparkles } from 'lucide-react';
import { useLeadsStore } from '../store';
import { leadsApi } from '../api';
import { LeadCustomer, LeadPriority, Lead } from '../types';

interface LeadFormPageProps {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
  prefillVisitId?: string;
  prefillTargetName?: string;
  prefillTargetType?: string;
}

const LEAD_TYPES = [
  'Hospital service',
  'Medicine supply',
  'Medical equipment',
  'Diagnostic partnership',
  'Pharma contract',
  'Other',
];

const CUSTOMER_TYPES = ['Doctor', 'Clinic', 'Hospital', 'Pharmacy', 'Distributor', 'Other'];

export const LeadFormPage: React.FC<LeadFormPageProps> = ({
  onClose,
  onCreated,
  prefillVisitId,
  prefillTargetName,
  prefillTargetType,
}) => {
  const { createLead } = useLeadsStore();

  const [customerSearch, setCustomerSearch] = useState(prefillTargetName || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [customerType, setCustomerType] = useState<string>(prefillTargetType || 'Doctor');
  const [suggestedCustomers, setSuggestedCustomers] = useState<LeadCustomer[]>([]);

  const [title, setTitle] = useState('');
  const [leadType, setLeadType] = useState(LEAD_TYPES[0]);
  const [interestedProductService, setInterestedProductService] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [leadSource, setLeadSource] = useState(prefillVisitId ? 'Doctor Visit' : 'Referral');
  const [priority, setPriority] = useState<LeadPriority>('MEDIUM');
  const [expectedValue, setExpectedValue] = useState<string>('');
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>('');
  const [locationCity, setLocationCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search existing customers
  useEffect(() => {
    if (customerSearch.trim().length >= 2 && !selectedCustomerId) {
      leadsApi.searchCustomers(customerSearch).then((results) => {
        setSuggestedCustomers(results);
      });
    } else {
      setSuggestedCustomers([]);
    }
  }, [customerSearch, selectedCustomerId]);

  const handleSelectCustomer = (c: LeadCustomer) => {
    setSelectedCustomerId(c.id);
    setCustomerSearch(c.name);
    setCustomerType(c.customer_type);
    if (c.location_city) setLocationCity(c.location_city);
    if (c.phone) setContactPhone(c.phone);
    setSuggestedCustomers([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerSearch.trim()) {
      setError('Please provide a customer or doctor name.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter an opportunity title.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newLead = await createLead({
        title: title.trim(),
        lead_type: leadType,
        interested_product_service: interestedProductService.trim() || undefined,
        customer_response: customerResponse.trim() || undefined,
        lead_source: leadSource,
        priority,
        expected_value: expectedValue ? parseFloat(expectedValue) : undefined,
        expected_close_date: expectedCloseDate || undefined,
        lead_customer_id: selectedCustomerId,
        customer_name: customerSearch.trim(),
        customer_type: customerType,
        location_city: locationCity.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        field_visit_id: prefillVisitId,
      });
      onCreated(newLead);
    } catch (err: any) {
      setError(err.message || 'Failed to save lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 font-sans">
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between p-6 pb-0 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6B52B6] to-[#7B61C9] text-white flex items-center justify-center shadow-md shadow-[#6B52B6]/20 shrink-0">
            <Sparkles className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {prefillVisitId ? 'Convert Field Visit to Lead' : 'Record Sales Opportunity'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Log commercial requirements. You can schedule immediate follow-ups right after.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all shadow-subtle active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          <span>Close</span>
        </button>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Customer Master */}
          <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#6B52B6]" />
                <span>Customer / Account Master</span>
              </h3>
              <span className="text-[10px] text-[#6B52B6] font-extrabold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                REQUIRED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer / Clinic / Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerId(undefined);
                  }}
                  placeholder="Type name (e.g. Dr. Sharma or Apollo City Clinic)"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
                />

                {/* Autocomplete Suggestion Dropdown */}
                {suggestedCustomers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {suggestedCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full text-left p-3 hover:bg-purple-50/70 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900 block">{cust.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {cust.customer_type} {cust.location_city ? `· ${cust.location_city}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-[#6B52B6] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/70">
                          SELECT
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-bold text-slate-800"
                >
                  {CUSTOMER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Opportunity Commercials */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Opportunity Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Holter Monitor Annual Lease or Antibiotics Bulk Contract"
                className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Interested Product / Service *
                </label>
                <input
                  type="text"
                  required
                  value={interestedProductService}
                  onChange={(e) => setInterestedProductService(e.target.value)}
                  placeholder="E.g., Diagnostic Packages, ECG Machines, Dialysis Consumables"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer Response / Demand *
                </label>
                <input
                  type="text"
                  required
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  placeholder="E.g., Requested Pricing Sheet, Wants On-Site Clinical Demo"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Opportunity Type
                </label>
                <select
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none font-semibold text-slate-800"
                >
                  <option value="Hospital service">Hospital service</option>
                  <option value="Medicine supply">Medicine supply</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Diagnostic partnership">Diagnostic partnership</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as LeadPriority)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none font-bold text-slate-800"
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lead Source
                </label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 bg-white focus:outline-none font-semibold text-slate-800"
                >
                  <option value="Doctor Visit">Doctor Visit</option>
                  <option value="Referral">Referral</option>
                  <option value="ASHA">ASHA</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expected Opportunity Value (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={expectedValue}
                    onChange={(e) => setExpectedValue(e.target.value)}
                    placeholder="E.g. 50000"
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expected Close Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="E.g., Dr. Sharma"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98000 00000"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Location / City
                </label>
                <input
                  type="text"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="E.g., Mumbai, Pune"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 font-medium"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Commercial Notes & Client Requirements
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What are the specific requirements? Competitor pricing mentioned, urgency, or next steps?"
                className="w-full text-xs p-3.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-[#6B52B6]/20 focus:border-[#6B52B6] font-medium"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-[#6B52B6] via-[#7B61C9] to-[#8C74DC] text-white hover:opacity-95 shadow-glow-brand disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {isSubmitting ? 'Saving Opportunity...' : 'Save Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
