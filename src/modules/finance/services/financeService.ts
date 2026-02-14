import { apiRequest } from '@shared/services/apiClient';

import type { CategoriesState, Expense, Income, Investment } from '../types/finance';
import type { PlannerDocument, PlannerSavePayload } from '../types/planner';

type FinanceRecord = Expense | Income | Investment;

interface ListResponse<T extends FinanceRecord> {
  items: T[];
  totalAmount: number;
}

interface CategoriesResponse {
  categories: CategoriesState;
}

interface PlannerResponse extends PlannerDocument {
  periodKey: string;
}

const withQuery = (path: string, params?: Record<string, string | number | undefined>) => {
  if (!params) {
    return path;
  }
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listRecords = async <T extends FinanceRecord>(
  token: string,
  collection: 'expenses' | 'incomes' | 'investments',
  params?: { year?: number; month?: number }
) => {
  const endpoint = withQuery(`/finance/${collection}`, {
    year: params?.year,
    month: params?.month,
  });
  const response = await apiRequest<ListResponse<T> | null>(endpoint, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return {
    items: response?.items ?? [],
    totalAmount: response?.totalAmount ?? 0,
  };
};

const createRecord = async <T extends FinanceRecord>(
  token: string,
  collection: 'expenses' | 'incomes' | 'investments',
  payload: Omit<T, 'id'>
) => {
  const response = await apiRequest<{ items: T[] }>(`/finance/${collection}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return response.items;
};

const updateRecord = async <T extends FinanceRecord>(
  token: string,
  collection: 'expenses' | 'incomes' | 'investments',
  id: string,
  payload: Omit<T, 'id'>
) =>
  apiRequest<T>(`/finance/${collection}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const deleteRecord = async (
  token: string,
  collection: 'expenses' | 'incomes' | 'investments',
  id: string
) =>
  apiRequest<void>(`/finance/${collection}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const getCategories = async (token: string) => {
  const response = await apiRequest<CategoriesResponse | null>('/finance/categories', {
    method: 'GET',
    headers: authHeaders(token),
  });
  return response?.categories ?? null;
};

const addCategoryRemote = (token: string, group: keyof CategoriesState, category: string) =>
  apiRequest<void>(`/finance/categories/${group}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ category }),
  });

const removeCategoryRemote = (
  token: string,
  group: keyof CategoriesState,
  category: string
) =>
  apiRequest<void>(withQuery(`/finance/categories/${group}`, { category }), {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const getPlanner = async (token: string, params: { year: number; month: number }) =>
  apiRequest<PlannerResponse | null>(
    withQuery('/finance/planner', {
      year: params.year,
      month: params.month,
    }),
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

const savePlanner = (token: string, payload: PlannerSavePayload) =>
  apiRequest<PlannerResponse>('/finance/planner', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export {
  addCategoryRemote,
  createRecord,
  deleteRecord,
  getCategories,
  getPlanner,
  listRecords,
  removeCategoryRemote,
  savePlanner,
  updateRecord,
};
