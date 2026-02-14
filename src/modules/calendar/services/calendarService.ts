import { apiRequest } from '@shared/services/apiClient';

import type { CalendarEvent } from '../types/calendar';

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listEvents = (token: string) =>
  apiRequest<{ events: CalendarEvent[] }>('/calendar', {
    method: 'GET',
    headers: authHeaders(token),
  });

const createEvent = (
  token: string,
  payload: Omit<CalendarEvent, 'id'>
) =>
  apiRequest<{ event: CalendarEvent }>('/calendar', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteEventRemote = (token: string, id: string) =>
  apiRequest<void>(`/calendar/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export { createEvent, deleteEventRemote, listEvents };
