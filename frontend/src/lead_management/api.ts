import { api } from '../api/client';
import {
  Lead,
  LeadCreateInput,
  LeadUpdateInput,
  LeadStageChangeInput,
  LeadAssignInput,
  LeadHistoryItem,
  LeadSummary,
  LeadCustomer,
  LeadCustomerCreate,
} from './types';

// In-Memory Mock Store for offline/demo operation
let mockLeads: Lead[] = [
  {
    id: 'ld-101',
    employee_id: '11111111-1111-1111-1111-111111111111',
    employee_name: 'Alex Vance',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_name: 'Dr. Jane Smith (Cardiologist)',
    customer_type: 'Doctor',
    title: 'Diagnostic Holter Monitor Partnership',
    lead_type: 'Medical Equipment',
    lead_source: 'Doctor Visit',
    stage: 'INTERESTED',
    priority: 'HIGH',
    expected_value: 120000,
    expected_close_date: '2026-11-15',
    location_city: 'Mumbai',
    contact_person: 'Dr. Jane Smith',
    contact_phone: '+91 98200 12345',
    notes: 'Clinic is looking to lease 2 wireless Holter monitors for outpatient cardiac monitoring.',
    next_follow_up_due: new Date(Date.now() + 86400000).toISOString(),
    next_follow_up_title: 'Send wireless Holter quotation & lease terms',
    pending_followups_count: 1,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ld-102',
    employee_id: '11111111-1111-1111-1111-111111111111',
    employee_name: 'Alex Vance',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_name: 'City Care Hospital',
    customer_type: 'Hospital',
    title: 'Annual Consumables Supply Contract',
    lead_type: 'Medicine supply',
    lead_source: 'Referral',
    stage: 'QUALIFIED',
    priority: 'MEDIUM',
    expected_value: 450000,
    expected_close_date: '2026-12-01',
    location_city: 'Pune',
    contact_person: 'Mr. Ramesh Shinde (Purchase)',
    contact_phone: '+91 94220 98765',
    notes: 'Tender opens next week; need competitive tier-2 pricing.',
    next_follow_up_due: new Date(Date.now() - 3600000).toISOString(), // Overdue
    next_follow_up_title: 'Submit finalized vendor credential documents',
    pending_followups_count: 1,
    is_archived: false,
    created_at: new Date(Date.now() - 400000000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockCustomers: LeadCustomer[] = [
  {
    id: 'cust-1',
    name: 'Dr. Jane Smith (Cardiologist)',
    customer_type: 'Doctor',
    phone: '+91 98200 12345',
    location_city: 'Mumbai',
    location_area: 'Bandra West',
    territory: 'West Zone',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    name: 'City Care Hospital',
    customer_type: 'Hospital',
    phone: '+91 94220 98765',
    location_city: 'Pune',
    location_area: 'Shivajinagar',
    territory: 'West Zone',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const leadsApi = {
  async getSummary(): Promise<LeadSummary> {
    return (api as any).request('/api/leads/summary').catch(() => {
      const open = mockLeads.filter((l) => !['CONVERTED', 'LOST'].includes(l.stage)).length;
      const interested = mockLeads.filter((l) => l.stage === 'INTERESTED').length;
      const qualified = mockLeads.filter((l) => l.stage === 'QUALIFIED').length;
      const converted = mockLeads.filter((l) => l.stage === 'CONVERTED').length;
      const lost = mockLeads.filter((l) => l.stage === 'LOST').length;
      const totalVal = mockLeads
        .filter((l) => !['CONVERTED', 'LOST'].includes(l.stage))
        .reduce((sum, l) => sum + (l.expected_value || 0), 0);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const attention = mockLeads.filter((l) => {
        const lastActive = l.last_interaction_date ? new Date(l.last_interaction_date) : new Date(l.updated_at);
        const isStale = !['CONVERTED', 'LOST'].includes(l.stage) && lastActive < sevenDaysAgo;
        const isFollowupNeeded =
          ['INTERESTED', 'QUALIFIED'].includes(l.stage) &&
          (!l.next_follow_up_due || l.pending_followups_count === 0);
        return isStale || isFollowupNeeded;
      }).length;

      return {
        total_leads: mockLeads.length,
        open_leads: open,
        interested_leads: interested,
        qualified_leads: qualified,
        converted_leads: converted,
        lost_leads: lost,
        needs_attention_count: attention,
        total_pipeline_value: totalVal,
        my_leads_count: mockLeads.length,
      };
    });
  },

  async listLeads(params?: { stage?: string; priority?: string; scope?: string; search?: string }): Promise<Lead[]> {
    const q = new URLSearchParams();
    if (params?.stage) q.append('stage', params.stage);
    if (params?.priority) q.append('priority', params.priority);
    if (params?.scope) q.append('scope', params.scope);
    if (params?.search) q.append('search', params.search);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return (api as any).request(`/api/leads/${queryStr}`).catch(() => {
      let filtered = [...mockLeads];
      if (params?.stage && params.stage !== 'ALL') {
        filtered = filtered.filter((l) => l.stage === params.stage);
      }
      if (params?.priority) {
        filtered = filtered.filter((l) => l.priority === params.priority);
      }
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.title.toLowerCase().includes(s) ||
            l.customer_name?.toLowerCase().includes(s) ||
            l.location_city?.toLowerCase().includes(s)
        );
      }
      return filtered;
    });
  },

  async getLead(id: string): Promise<Lead> {
    return (api as any).request(`/api/leads/${id}`).catch(() => {
      const found = mockLeads.find((l) => l.id === id);
      if (!found) throw new Error('Lead not found');
      return found;
    });
  },

  async createLead(input: LeadCreateInput): Promise<Lead> {
    return (api as any).request('/api/leads/', {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const newLead: Lead = {
        id: 'ld-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        employee_name: 'Alex Vance',
        created_by_id: '11111111-1111-1111-1111-111111111111',
        title: input.title,
        lead_type: input.lead_type,
        interested_product_service: input.interested_product_service,
        customer_response: input.customer_response,
        lead_source: input.lead_source || 'Doctor Visit',
        stage: 'NEW',
        priority: input.priority || 'MEDIUM',
        expected_value: input.expected_value,
        expected_close_date: input.expected_close_date,
        customer_name: input.customer_name,
        customer_type: input.customer_type || 'Doctor',
        location_city: input.location_city,
        contact_person: input.contact_person,
        contact_phone: input.contact_phone,
        notes: input.notes,
        last_interaction_date: new Date().toISOString(),
        field_visit_id: input.field_visit_id,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockLeads.unshift(newLead);
      return newLead;
    });
  },

  async updateLead(id: string, input: LeadUpdateInput): Promise<Lead> {
    return (api as any).request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).catch(() => {
      const found = mockLeads.find((l) => l.id === id);
      if (!found) throw new Error('Lead not found');
      Object.assign(found, input, { updated_at: new Date().toISOString() });
      return found;
    });
  },

  async changeStage(id: string, input: LeadStageChangeInput): Promise<Lead> {
    return (api as any).request(`/api/leads/${id}/stage`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const found = mockLeads.find((l) => l.id === id);
      if (!found) throw new Error('Lead not found');
      found.stage = input.new_stage;
      if (input.conversion_outcome) found.conversion_outcome = input.conversion_outcome;
      if (input.loss_reason) found.loss_reason = input.loss_reason;
      if (['CONVERTED', 'LOST'].includes(input.new_stage)) {
        found.closed_at = new Date().toISOString();
      } else {
        found.closed_at = undefined;
      }
      found.updated_at = new Date().toISOString();
      return found;
    });
  },

  async assignLead(id: string, input: LeadAssignInput): Promise<Lead> {
    return (api as any).request(`/api/leads/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const found = mockLeads.find((l) => l.id === id);
      if (!found) throw new Error('Lead not found');
      found.employee_id = input.new_employee_id;
      found.updated_at = new Date().toISOString();
      return found;
    });
  },

  async getTimeline(id: string): Promise<LeadHistoryItem[]> {
    return (api as any).request(`/api/leads/${id}/timeline`).catch(() => [
      {
        id: 'lh-1',
        lead_id: id,
        actor_id: '11111111-1111-1111-1111-111111111111',
        actor_name: 'Alex Vance',
        event_type: 'CREATED',
        new_value: 'NEW',
        notes: 'Opportunity logged from field visit',
        occurred_at: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 'lh-2',
        lead_id: id,
        actor_id: '11111111-1111-1111-1111-111111111111',
        actor_name: 'Alex Vance',
        event_type: 'STAGE_CHANGED',
        old_value: 'NEW',
        new_value: 'INTERESTED',
        notes: 'Doctor confirmed clinic interest in diagnostic trial',
        occurred_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);
  },

  async searchCustomers(q?: string, type?: string): Promise<LeadCustomer[]> {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (type) params.append('customer_type', type);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return (api as any).request(`/api/lead-customers/search${queryStr}`).catch(() => {
      if (!q) return mockCustomers;
      const s = q.toLowerCase();
      return mockCustomers.filter(
        (c) => c.name.toLowerCase().includes(s) || (c.phone && c.phone.includes(s))
      );
    });
  },

  async createCustomer(input: LeadCustomerCreate): Promise<LeadCustomer> {
    return (api as any).request('/api/lead-customers/', {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const c: LeadCustomer = {
        id: 'cust-' + Date.now(),
        name: input.name,
        customer_type: input.customer_type,
        phone: input.phone,
        location_city: input.location_city,
        location_area: input.location_area,
        territory: input.territory,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockCustomers.unshift(c);
      return c;
    });
  },
};
