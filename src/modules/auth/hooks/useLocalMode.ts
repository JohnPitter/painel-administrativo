import { useMemo } from 'react';

import { useAuth } from '../services/AuthContext';
import { useAccountProfile } from '../services/AccountContext';

const useLocalMode = () => {
  const { isGuest, user } = useAuth();
  const { profile } = useAccountProfile();

  return useMemo(() => {
    if (isGuest || !user) {
      return true;
    }
    if (!profile) {
      return false;
    }
    if (profile.subscriptionStatus === 'active') {
      return false;
    }
    const activeUntil = profile.activeUntil ? new Date(profile.activeUntil) : null;
    if (profile.subscriptionStatus === 'pending_cancel' && activeUntil) {
      return activeUntil.getTime() < Date.now();
    }
    return true;
  }, [isGuest, user, profile]);
};

export { useLocalMode };
