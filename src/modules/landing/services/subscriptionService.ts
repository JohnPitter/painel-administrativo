const DEFAULT_BILLING_API_URL = import.meta.env.DEV ? '' : '/api';

interface CreateCheckoutSessionParams {
  name: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
  context?: 'signup' | 'renewal';
}

interface CreateCheckoutSessionResponse {
  checkoutUrl?: string;
  sessionId?: string;
}

interface CheckoutSessionStatusResponse {
  status: 'open' | 'complete' | 'expired' | 'canceled';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  customerEmail?: string;
  metadata?: Record<string, string> | null;
}

interface RenewSubscriptionResponse {
  activeUntil?: string;
}

const resolveBaseUrl = () => {
  const candidate =
    import.meta.env.VITE_BILLING_API_URL?.toString().trim() ||
    import.meta.env.VITE_API_URL?.toString().trim() ||
    DEFAULT_BILLING_API_URL;

  if (!candidate) {
    return '';
  }

  return candidate.replace(/\/$/, '');
};

const jsonRequest = async <T>(path: string, init: RequestInit) => {
  const baseUrl = resolveBaseUrl();
  const url = baseUrl ? `${baseUrl}${path}` : path;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload.message === 'string' && payload.message) ||
      'Não foi possível concluir a operação de assinatura.';
    throw new Error(message);
  }

  return payload as T;
};

const createCheckoutSession = (params: CreateCheckoutSessionParams) =>
  jsonRequest<CreateCheckoutSessionResponse>('/checkout/sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  });

const getCheckoutSessionStatus = (sessionId: string) =>
  jsonRequest<CheckoutSessionStatusResponse>(`/checkout/sessions/${sessionId}`, {
    method: 'GET',
  });

const confirmRenewal = (sessionId: string, token: string) =>
  jsonRequest<RenewSubscriptionResponse>('/billing/renew', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  });

export type {
  CreateCheckoutSessionParams,
  CreateCheckoutSessionResponse,
  CheckoutSessionStatusResponse,
};
export { confirmRenewal, createCheckoutSession, getCheckoutSessionStatus };
