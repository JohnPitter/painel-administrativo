import { apiRequest } from '@shared/services/apiClient';

export type SubscriptionStatus = 'active' | 'pending_cancel' | 'canceled';

export interface AccountProfile {
  displayName: string;
  photoURL?: string | null;
  subscriptionStatus: SubscriptionStatus;
  updatedAt?: string | null;
  canceledAt?: string | null;
  activeUntil?: string | null;
  cancellationRequestedAt?: string | null;
}

interface UpdateProfilePayload {
  displayName: string;
}

interface UploadAvatarPayload {
  data: string;
  contentType: string;
  fileName?: string;
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const fetchAccountProfile = (token: string) =>
  apiRequest<{ profile: AccountProfile }>('/account/profile', {
    method: 'GET',
    headers: authHeaders(token),
  });

const updateAccountProfile = (token: string, payload: UpdateProfilePayload) =>
  apiRequest<{ profile: AccountProfile }>('/account/profile', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const uploadAccountAvatar = (token: string, payload: UploadAvatarPayload) =>
  apiRequest<{ profile: AccountProfile }>('/account/avatar', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const cancelAccountSubscription = (token: string) =>
  apiRequest<{ profile: AccountProfile }>('/account/cancel', {
    method: 'POST',
    headers: authHeaders(token),
  });

export type { UpdateProfilePayload, UploadAvatarPayload };
export {
  cancelAccountSubscription,
  fetchAccountProfile,
  updateAccountProfile,
  uploadAccountAvatar,
};
