import { apiRequest } from '@shared/services/apiClient';

export interface TimeEntryPayload {
  date: string;
  firstCheckIn: string;
  firstCheckOut: string;
  secondCheckIn: string;
  secondCheckOut: string;
  shiftType: string;
  notes: string;
}

export interface TimeEntryResponse extends TimeEntryPayload {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

type ListEntriesParams = {
  month?: string;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const buildQuery = (params?: ListEntriesParams) => {
  if (!params || !params.month) {
    return '/timeclock';
  }
  const query = new URLSearchParams({ month: params.month });
  return `/timeclock?${query.toString()}`;
};

const listEntries = (token: string, params?: ListEntriesParams) =>
  apiRequest<{ entries: TimeEntryResponse[] }>(buildQuery(params), {
    method: 'GET',
    headers: authHeaders(token),
  });

const createEntry = (token: string, payload: TimeEntryPayload) =>
  apiRequest<{ entry: TimeEntryResponse }>('/timeclock', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateEntry = (token: string, id: string, payload: Partial<TimeEntryPayload>) =>
  apiRequest<{ entry: TimeEntryResponse }>(`/timeclock/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteEntry = (token: string, id: string) =>
  apiRequest<void>(`/timeclock/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export { createEntry, deleteEntry, listEntries, updateEntry };
