const normalizeBasePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }
  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
  return `/${withoutSlashes}`;
};

const resolveBaseUrl = () => {
  const explicit =
    import.meta.env.VITE_API_URL?.toString().trim() ||
    import.meta.env.VITE_BILLING_API_URL?.toString().trim();

  if (explicit) {
    return normalizeBasePath(explicit);
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isFirebaseHosting =
      host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
    if (isFirebaseHosting) {
      return 'https://southamerica-east1-painel-administrativo-br.cloudfunctions.net/api';
    }
  }

  return '/api';
};

const DEFAULT_BASE_URL = resolveBaseUrl();

export interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

const resolvePath = (path: string) => {
  if (!path.startsWith('/')) {
    return `${DEFAULT_BASE_URL}/${path}`;
  }
  if (!DEFAULT_BASE_URL) {
    return path;
  }
  return `${DEFAULT_BASE_URL}${path}`;
};

const apiRequest = async <T>(path: string, init: RequestInit = {}) => {
  const url = resolvePath(path);
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type');
  const payload = contentType && contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const error: ApiError = new Error(
      (payload && typeof payload === 'object' && (payload as { message?: string }).message) ||
        'Não foi possível concluir a operação. Tente novamente em instantes.'
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return null as T;
  }

  return (payload as T) ?? (null as T);
};

export { apiRequest };
