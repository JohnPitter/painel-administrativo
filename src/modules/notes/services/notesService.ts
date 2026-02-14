import { apiRequest } from '@shared/services/apiClient';

import type { Note } from '../types/notes';

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listNotes = (token: string) =>
  apiRequest<{ notes: Note[] }>('/notes', {
    method: 'GET',
    headers: authHeaders(token),
  });

const createNote = (token: string, payload: Omit<Note, 'id'>) =>
  apiRequest<{ note: Note }>('/notes', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateNoteRemote = (token: string, id: string, payload: Partial<Omit<Note, 'id'>>) =>
  apiRequest<{ id: string } & Partial<Note>>(`/notes/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteNoteRemote = (token: string, id: string) =>
  apiRequest<void>(`/notes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export { createNote, deleteNoteRemote, listNotes, updateNoteRemote };
