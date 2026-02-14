import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useAccountProfile } from '@modules/auth/services/AccountContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import { AccountProfileModal } from '@modules/dashboard/components/AccountProfileModal';

import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
}

const DashboardLayout = ({ title, subtitle, children, actions }: DashboardLayoutProps) => {
  const { user, logout, isGuest } = useAuth();
  const { profile } = useAccountProfile();
  const isLocalMode = useLocalMode();
  const navigate = useNavigate();
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);

  const handleSignOut = async () => {
    const wasGuest = isGuest;
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao sair da sessão', error);
      return;
    }

    if (wasGuest) {
      navigate('/', { replace: true });
    }
  };

  const resolvedDisplayName = useMemo(() => {
    if (isGuest) {
      return 'Visitante';
    }
    return (
      profile?.displayName ??
      user?.displayName ??
      user?.email?.split('@')[0] ??
      'Usuário'
    );
  }, [isGuest, profile?.displayName, user?.displayName, user?.email]);

  const greetingMessage = useMemo(() => {
    const greeting = getGreetingByHour();
    const shortName = resolvedDisplayName.split(' ')[0];
    return `${greeting}, ${shortName}!`;
  }, [resolvedDisplayName]);

  const userInitial = resolvedDisplayName.charAt(0).toUpperCase();
  const showLocalWarning = useMemo(() => !isGuest && isLocalMode, [isGuest, isLocalMode]);
  const subscriptionSummary = useMemo(() => {
    if (isGuest || !profile) {
      return null;
    }
    const activeUntilDate = profile.activeUntil ? new Date(profile.activeUntil) : null;
    const daysRemaining =
      activeUntilDate && activeUntilDate.getTime() > Date.now()
        ? Math.max(
            0,
            Math.ceil((activeUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          )
        : null;

    if (profile.subscriptionStatus === 'active' && activeUntilDate) {
      return `Ativa · renova em ${activeUntilDate.toLocaleDateString('pt-BR')} (${
        daysRemaining ?? 0
      } dias)`;
    }

    if (profile.subscriptionStatus === 'pending_cancel' && activeUntilDate) {
      return `Cancelamento agendado · expira em ${activeUntilDate.toLocaleDateString(
        'pt-BR'
      )} (${daysRemaining ?? 0} dias)`;
    }

    return 'Acesso suspenso · renove para sincronizar novamente';
  }, [isGuest, profile]);

  return (
    <div className={styles.wrapper}>
      {showLocalWarning && (
        <div className={styles.localWarning}>
          <strong>Modo local</strong>
          <span>
            Sua assinatura está inativa. Novos registros ficam apenas neste dispositivo até você
            renovar.
          </span>
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.brandChip}>Painel Administrativo</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <p className={styles.greeting}>{greetingMessage}</p>
        </div>

        <div className={styles.headerActions}>
          {actions}
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {profile?.photoURL && !isGuest ? (
                <img src={profile.photoURL} alt={`Foto de ${resolvedDisplayName}`} />
              ) : (
                userInitial
              )}
            </div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{resolvedDisplayName}</span>
              {!isGuest && user?.email && <span className={styles.userEmail}>{user.email}</span>}
              {subscriptionSummary && <span className={styles.userSubscription}>{subscriptionSummary}</span>}
              <div className={styles.userButtons}>
                {!isGuest && (
                  <button
                    type="button"
                    className={styles.manageButton}
                    onClick={() => setAccountModalOpen(true)}
                  >
                    Gerenciar conta
                  </button>
                )}
                <button type="button" className={styles.logoutButton} onClick={() => void handleSignOut()}>
                  {isGuest ? 'Sair do modo visitante' : 'Encerrar sessão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.content}>{children}</main>
      {!isGuest && (
        <AccountProfileModal
          isOpen={isAccountModalOpen}
          onClose={() => setAccountModalOpen(false)}
        />
      )}
    </div>
  );
};

const getGreetingByHour = () => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Bom dia';
  }
  if (hour < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
};

export { DashboardLayout };
