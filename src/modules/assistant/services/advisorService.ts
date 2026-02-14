import { apiRequest } from '@shared/services/apiClient';

type AssistantSummary = {
  totalExpenses: number;
  totalIncomes: number;
  netBalance: number;
  topExpenseCategory: { label: string; amount: number } | null;
  topIncomeCategory: { label: string; amount: number } | null;
  latestInvestment: Record<string, unknown> | null;
  expenseCount: number;
  incomeCount: number;
  investmentCount: number;
};

interface AssistantResponse {
  reply: string;
  summary: AssistantSummary;
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const sendAssistantMessage = (token: string, message: string) =>
  apiRequest<AssistantResponse>('/assistant/chat', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
    },
    body: JSON.stringify({ message }),
  });

export type { AssistantResponse, AssistantSummary };
export { sendAssistantMessage };
