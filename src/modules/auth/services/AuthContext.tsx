import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';

import { login as loginWithFirebase, logout as logoutFromFirebase, observeAuth } from './authService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const GUEST_MODE_KEY = 'painel_admin_guest_mode';

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem(GUEST_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const persistGuestFlag = useCallback((value: boolean) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (value) {
        window.localStorage.setItem(GUEST_MODE_KEY, 'true');
      } else {
        window.localStorage.removeItem(GUEST_MODE_KEY);
      }
    } catch (error) {
      console.warn('Não foi possível persistir o modo visitante', error);
    }
  }, []);

  useEffect(() => {
    if (isGuest) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = observeAuth(authUser => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isGuest]);

  const enterGuestMode = useCallback(() => {
    setIsGuest(true);
    persistGuestFlag(true);
    setUser(null);
    setLoading(false);
  }, [persistGuestFlag]);

  const login = useCallback(async (email: string, password: string) => {
    if (isGuest) {
      setIsGuest(false);
      persistGuestFlag(false);
    }

    setLoading(true);
    try {
      await loginWithFirebase(email, password);
    } finally {
      setLoading(false);
    }
  }, [isGuest, persistGuestFlag]);

  const logout = useCallback(async () => {
    if (isGuest) {
      setIsGuest(false);
      persistGuestFlag(false);
      setUser(null);
      return;
    }

    await logoutFromFirebase();
  }, [isGuest, persistGuestFlag]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isGuest,
      login,
      logout,
      enterGuestMode,
    }),
    [user, loading, isGuest, login, logout, enterGuestMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };
