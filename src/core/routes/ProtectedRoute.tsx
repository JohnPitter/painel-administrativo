import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useAccountProfile } from '@modules/auth/services/AccountContext';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, isGuest } = useAuth();
  const { loading: profileLoading } = useAccountProfile();
  const location = useLocation();

  const isAccountLoading = !isGuest && !!user && profileLoading;

  if (loading || isAccountLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          color: 'var(--color-accent)',
        }}
      >
        Carregando painel...
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export { ProtectedRoute };
