import { api } from '../api/client';
import {
  Followup,
  FollowupCreateInput,
  FollowupCompleteInput,
  FollowupRescheduleInput,
  FollowupCancelInput,
  DueSummary,
  FollowupHistoryItem,
} from './types';

// In-Memory Mock Store for Follow-ups
let mockFollowups: Followup[] = [
  {
    id: 'fup-101',
    employee_id: '11111111-1111-1111-1111-111111111111',
    employee_name: 'Alex Vance',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    lead_id: 'ld-101',
    lead_title: 'Diagnostic Holter Monitor Partnership',
    customer_name: 'Dr. Jane Smith (Cardiologist)',
    action_type: 'Quotation',
    title: 'Send wireless Holter quotation & lease terms',
    due_at: new Date(Date.now() + 18000000).toISOString(), // Due today in 5 hours
    priority: 'HIGH',
    notes: 'Share tier-1 discounted pricing approved by regional manager.',
    status: 'PENDING',
    is_overdue: false,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fup-102',
    employee_id: '11111111-1111-1111-1111-111111111111',
    employee_name: 'Alex Vance',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    lead_id: 'ld-102',
    lead_title: 'Annual Consumables Supply Contract',
    customer_name: 'City Care Hospital',
    action_type: 'Document Collection',
    title: 'Submit finalized vendor credential documents',
    due_at: new Date(Date.now() - 7200000).toISOString(), // Overdue 2 hours ago
    priority: 'HIGH',
    notes: 'Tender committee meets at 4 PM; submit before deadline.',
    status: 'PENDING',
    is_overdue: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fup-103',
    employee_id: '11111111-1111-1111-1111-111111111111',
    employee_name: 'Alex Vance',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    field_visit_id: 'v-101',
    customer_name: 'Dr. Jane Smith (Cardiologist)',
    action_type: 'Revisit',
    title: 'Deliver sample ECG electrodes pack',
    due_at: new Date(Date.now() + 172800000).toISOString(), // Upcoming in 2 days
    priority: 'MEDIUM',
    notes: 'Clinic staff requested 2 sample packs to test with current machines.',
    status: 'PENDING',
    is_overdue: false,
    is_archived: false,
    created_at: new Date(Date.now() - 40000000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const followupsApi = {
  async getDueSummary(): Promise<DueSummary> {
    return (api as any).request('/api/followups/due-summary').catch(() => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      let overdue = 0;
      let dueToday = 0;
      let upcoming = 0;
      let completedToday = 0;

      mockFollowups.forEach((f) => {
        const d = new Date(f.due_at);
        const fStr = f.due_at.split('T')[0];

        if (f.status === 'PENDING') {
          if (d < now) {
            overdue++;
          } else if (fStr === todayStr) {
            dueToday++;
          } else {
            upcoming++;
          }
        } else if (f.status === 'COMPLETED' && f.completed_at && f.completed_at.split('T')[0] === todayStr) {
          completedToday++;
        }
      });

      return {
        due_today: dueToday,
        overdue,
        upcoming,
        completed_today: completedToday,
      };
    });
  },

  async listFollowups(params?: {
    tab?: string;
    lead_id?: string;
    field_visit_id?: string;
    scope?: string;
  }): Promise<Followup[]> {
    const q = new URLSearchParams();
    if (params?.tab) q.append('tab', params.tab);
    if (params?.lead_id) q.append('lead_id', params.lead_id);
    if (params?.field_visit_id) q.append('field_visit_id', params.field_visit_id);
    if (params?.scope) q.append('scope', params.scope);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return (api as any).request(`/api/followups/${queryStr}`).catch(() => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      let items = mockFollowups.map((f) => ({
        ...f,
        is_overdue: f.status === 'PENDING' && new Date(f.due_at) < now,
      }));

      if (params?.lead_id) {
        items = items.filter((f) => f.lead_id === params.lead_id);
      }
      if (params?.field_visit_id) {
        items = items.filter((f) => f.field_visit_id === params.field_visit_id);
      }

      if (params?.tab === 'due_today') {
        items = items.filter(
          (f) => f.status === 'PENDING' && f.due_at.split('T')[0] === todayStr && new Date(f.due_at) >= now
        );
      } else if (params?.tab === 'overdue') {
        items = items.filter((f) => f.status === 'PENDING' && new Date(f.due_at) < now);
      } else if (params?.tab === 'upcoming') {
        items = items.filter((f) => f.status === 'PENDING' && f.due_at.split('T')[0] > todayStr);
      } else if (params?.tab === 'completed') {
        items = items.filter((f) => f.status === 'COMPLETED');
      }

      return items;
    });
  },

  async getFollowup(id: string): Promise<Followup> {
    return (api as any).request(`/api/followups/${id}`).catch(() => {
      const f = mockFollowups.find((x) => x.id === id);
      if (!f) throw new Error('Follow-up not found');
      return {
        ...f,
        is_overdue: f.status === 'PENDING' && new Date(f.due_at) < new Date(),
      };
    });
  },

  async createFollowup(input: FollowupCreateInput): Promise<Followup> {
    return (api as any).request('/api/followups/', {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const f: Followup = {
        id: 'fup-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        employee_name: 'Alex Vance',
        created_by_id: '11111111-1111-1111-1111-111111111111',
        lead_id: input.lead_id,
        lead_customer_id: input.lead_customer_id,
        field_visit_id: input.field_visit_id,
        customer_name: input.customer_name || 'Customer',
        action_type: input.action_type,
        title: input.title,
        due_at: input.due_at,
        priority: input.priority || 'MEDIUM',
        notes: input.notes,
        status: 'PENDING',
        is_overdue: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockFollowups.unshift(f);
      return f;
    });
  },

  async completeFollowup(id: string, input: FollowupCompleteInput): Promise<Followup> {
    return (api as any).request(`/api/followups/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const f = mockFollowups.find((x) => x.id === id);
      if (!f) throw new Error('Follow-up not found');
      f.status = 'COMPLETED';
      f.outcome = input.outcome;
      f.completed_at = new Date().toISOString();
      f.updated_at = new Date().toISOString();
      return f;
    });
  },

  async rescheduleFollowup(id: string, input: FollowupRescheduleInput): Promise<Followup> {
    return (api as any).request(`/api/followups/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const f = mockFollowups.find((x) => x.id === id);
      if (!f) throw new Error('Follow-up not found');
      f.due_at = input.new_due_at;
      f.updated_at = new Date().toISOString();
      return f;
    });
  },

  async cancelFollowup(id: string, input: FollowupCancelInput): Promise<Followup> {
    return (api as any).request(`/api/followups/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).catch(() => {
      const f = mockFollowups.find((x) => x.id === id);
      if (!f) throw new Error('Follow-up not found');
      f.status = 'CANCELLED';
      f.cancel_reason = input.cancel_reason;
      f.updated_at = new Date().toISOString();
      return f;
    });
  },

  async getHistory(id: string): Promise<FollowupHistoryItem[]> {
    return (api as any).request(`/api/followups/${id}/history`).catch(() => []);
  },
};
