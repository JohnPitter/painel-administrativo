import { apiRequest } from '@shared/services/apiClient';

type RelationshipStage = 'Contato inicial' | 'Oportunidade' | 'Negociação' | 'Fidelizado';
type RelationshipPriority = 'Alta' | 'Média' | 'Baixa';
type RelationshipChannel = 'Ligação' | 'Reunião' | 'E-mail' | 'Mensagem' | 'Anotação';

interface RelationshipInteraction {
  id: string;
  date: string;
  channel: RelationshipChannel;
  summary: string;
  nextStep?: string;
}

interface RelationshipContact {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  stage: RelationshipStage;
  priority: RelationshipPriority;
  lastInteraction?: string;
  nextAction?: string;
  tags: string[];
  interactions: RelationshipInteraction[];
  createdAt?: string;
}

interface RelationshipInteractionInput {
  channel: RelationshipChannel;
  summary: string;
  nextStep?: string;
  nextAction?: string;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listContacts = (token: string) =>
  apiRequest<{ contacts: RelationshipContact[] }>('/relationships', {
    method: 'GET',
    headers: authHeaders(token),
  });

type RelationshipContactInput = Omit<RelationshipContact, 'id'>;

const createContact = (token: string, payload: RelationshipContactInput) =>
  apiRequest<{ contact: RelationshipContact }>('/relationships', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateContact = (token: string, id: string, payload: Partial<RelationshipContact>) =>
  apiRequest<{ id: string } & Partial<RelationshipContact>>(`/relationships/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteContact = (token: string, id: string) =>
  apiRequest<void>(`/relationships/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const addInteractionRemote = (token: string, id: string, payload: RelationshipInteractionInput) =>
  apiRequest<{ contact: RelationshipContact }>(`/relationships/${id}/interactions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export type {
  RelationshipContact,
  RelationshipContactInput,
  RelationshipInteraction,
  RelationshipInteractionInput,
  RelationshipPriority,
  RelationshipStage,
};
export {
  addInteractionRemote,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
};
