import { apiRequest } from '@shared/services/apiClient';

export interface AutomationRuleInput {
  name: string;
  active: boolean;
  source: string;
  event: string;
  condition: string;
  conditionValue?: string;
  action: string;
  actionPayload?: string;
  runCount: number;
  createdAt: string;
}

export interface AutomationRuleResponse extends AutomationRuleInput {
  id: string;
  lastRun?: string;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listAutomations = (token: string) =>
  apiRequest<{ automations: AutomationRuleResponse[] }>('/automations', {
    method: 'GET',
    headers: authHeaders(token),
  });

const createAutomation = (token: string, payload: AutomationRuleInput) =>
  apiRequest<{ automation: AutomationRuleResponse }>('/automations', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateAutomation = (token: string, id: string, payload: Partial<AutomationRuleInput>) =>
  apiRequest<{ id: string } & Partial<AutomationRuleResponse>>(`/automations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteAutomation = (token: string, id: string) =>
  apiRequest<void>(`/automations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export { createAutomation, deleteAutomation, listAutomations, updateAutomation };
