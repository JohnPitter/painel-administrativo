interface SubscriptionIntent {
  name: string;
  email: string;
  createdAt: number;
}

const STORAGE_KEY = 'painel_admin_subscription_intent';

const persistSubscriptionIntent = (intent: Omit<SubscriptionIntent, 'createdAt'>) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: SubscriptionIntent = { ...intent, createdAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Não foi possível salvar dados temporários da assinatura.', error);
  }
};

const readSubscriptionIntent = (): SubscriptionIntent | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SubscriptionIntent;
    if (!parsed?.email) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Não foi possível ler dados temporários da assinatura.', error);
    return null;
  }
};

const clearSubscriptionIntent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível limpar dados temporários da assinatura.', error);
  }
};

export type { SubscriptionIntent };
export { persistSubscriptionIntent, readSubscriptionIntent, clearSubscriptionIntent };
