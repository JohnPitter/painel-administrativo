import { Navigate, useLocation } from 'react-router-dom';

import { AuthLayout } from '@core/layout/AuthLayout';

import { useAuth } from '../services/AuthContext';
import { LoginForm } from '../components/LoginForm';

const LoginPage = () => {
  const { user, loading, isGuest } = useAuth();
  const location = useLocation();
  const { from } = (location.state as { from?: string } | null) ?? {};
  const redirectPath = typeof from === 'string' && from.length > 0 ? from : '/dashboard';

  if (loading) {
    return (
      <AuthLayout>
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '320px',
            fontSize: '1.1rem',
            color: 'var(--color-accent)',
          }}
        >
          Carregando sessao...
        </div>
      </AuthLayout>
    );
  }

  if (user || isGuest) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};

export { LoginPage };
