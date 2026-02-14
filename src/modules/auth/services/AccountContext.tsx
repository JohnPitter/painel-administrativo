import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { updateProfile as updateAuthProfile, type User } from 'firebase/auth';
import toast from 'react-hot-toast';

import type { ApiError } from '@shared/services/apiClient';
import {
  cancelAccountSubscription,
  fetchAccountProfile,
  updateAccountProfile,
  uploadAccountAvatar,
  type AccountProfile,
  type SubscriptionStatus,
} from '@modules/auth/services/accountService';
import { useAuth } from './AuthContext';

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AVATAR_SIZE = 4 * 1024 * 1024;

const isApiForbidden = (error: unknown) => {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as ApiError).status === 403;
  }
  return false;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Formato de arquivo inválido.'));
        return;
      }
      const parts = reader.result.split(',');
      resolve(parts.length > 1 ? parts.pop() ?? '' : reader.result);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });

interface AccountContextValue {
  profile: AccountProfile | null;
  loading: boolean;
  saveDisplayName: (name: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

const buildDefaultProfile = (user: User): AccountProfile => ({
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Usuário',
  photoURL: user.photoURL ?? null,
  subscriptionStatus: 'active',
  activeUntil: new Date(Date.now() + BILLING_CYCLE_MS).toISOString(),
});

function AccountProvider({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const getAuthToken = useCallback(async () => {
    if (!user || isGuest) {
      throw new Error('Operação disponível apenas para contas autenticadas');
    }
    return user.getIdToken();
  }, [user, isGuest]);

  const hydrateProfile = useCallback(async () => {
    if (!user || isGuest) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetchAccountProfile(token);
      setProfile(response.profile);
    } catch (error) {
      console.error('Falha ao carregar perfil da conta', error);
      setProfile(buildDefaultProfile(user));
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, isGuest, user]);

  useEffect(() => {
    void hydrateProfile();
  }, [hydrateProfile]);

  const saveDisplayName = useCallback(
    async (name: string) => {
      try {
        const trimmed = name.trim();
        if (!trimmed) {
          toast.error('Informe um nome válido.');
          return;
        }
        const token = await getAuthToken();
        const response = await updateAccountProfile(token, { displayName: trimmed });
        setProfile(response.profile);
        if (user) {
          await updateAuthProfile(user, { displayName: response.profile.displayName });
        }
        toast.success('Nome atualizado com sucesso.');
      } catch (error) {
        if (isApiForbidden(error)) {
          toast.error('Renove sua assinatura para editar o perfil.');
          return;
        }
        console.error(error);
        toast.error('Não foi possível atualizar o nome. Tente novamente em instantes.');
      }
    },
    [getAuthToken, user]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      try {
        if (!file) {
          return;
        }
        if (file.size > MAX_AVATAR_SIZE) {
          toast.error('Escolha uma imagem de até 4MB.');
          return;
        }
        const base64 = await fileToBase64(file);
        const token = await getAuthToken();
        const response = await uploadAccountAvatar(token, {
          data: base64,
          contentType: file.type || 'application/octet-stream',
          fileName: file.name,
        });
        setProfile(response.profile);
        if (user) {
          await updateAuthProfile(user, { photoURL: response.profile.photoURL ?? undefined });
        }
        toast.success('Foto atualizada.');
      } catch (error) {
        if (isApiForbidden(error)) {
          toast.error('Renove sua assinatura para alterar a foto.');
          return;
        }
        console.error(error);
        toast.error('Não foi possível enviar a foto. Tente novamente.');
      }
    },
    [getAuthToken, user]
  );

  const cancelSubscription = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await cancelAccountSubscription(token);
      setProfile(response.profile);
      toast.success('Cancelamento agendado. Você continuará com acesso até o fim do ciclo atual.');
    } catch (error) {
      if (isApiForbidden(error)) {
        toast.error('Sua assinatura já está suspensa.');
        return;
      }
      console.error(error);
      toast.error('Não foi possível cancelar a assinatura agora.');
    }
  }, [getAuthToken]);

  const value = useMemo(
    (): AccountContextValue => ({
      profile,
      loading,
      saveDisplayName,
      uploadAvatar,
      cancelSubscription,
    }),
    [profile, loading, saveDisplayName, uploadAvatar, cancelSubscription]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

function useAccountProfile() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccountProfile must be used within an AccountProvider');
  }
  return context;
}

export { AccountProvider, useAccountProfile, BILLING_CYCLE_MS };
