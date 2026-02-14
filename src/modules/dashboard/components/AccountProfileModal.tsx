import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@shared/components/Modal/Modal';
import { useAccountProfile } from '@modules/auth/services/AccountContext';
import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import styles from './AccountProfileModal.module.css';

interface AccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountProfileModal = ({ isOpen, onClose }: AccountProfileModalProps) => {
  const { profile, saveDisplayName, uploadAvatar, cancelSubscription, loading } =
    useAccountProfile();
  const { user, isGuest } = useAuth();
  const isLocalMode = useLocalMode();
  const isReadOnly = isLocalMode && !isGuest;
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
    }
  }, [profile, isOpen]);

  const initials = useMemo(() => {
    if (!profile) {
      return 'U';
    }
    return profile.displayName.charAt(0).toUpperCase();
  }, [profile]);

  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await saveDisplayName(displayName);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsUploading(true);
    try {
      await uploadAvatar(file);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      'Cancelar a assinatura remove o acesso sincronizado até que você renove. Deseja continuar?'
    );
    if (!confirmed) {
      return;
    }
    setIsCanceling(true);
    try {
      await cancelSubscription();
    } finally {
      setIsCanceling(false);
    }
  };

  const handleRenew = () => {
    onClose();
    window.location.assign('/assinatura/renovar');
  };

  if (!profile) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar conta">
        <div className={styles.loadingState}>Carregando informações do perfil...</div>
      </Modal>
    );
  }

  const formattedActiveUntil = profile.activeUntil
    ? new Date(profile.activeUntil).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const statusLabel =
    profile.subscriptionStatus === 'active'
      ? 'Assinatura ativa'
      : profile.subscriptionStatus === 'pending_cancel'
        ? 'Cancelamento agendado'
        : 'Assinatura cancelada';

  const remainingDays =
    formattedActiveUntil && profile.activeUntil
      ? Math.max(
          0,
          Math.ceil((new Date(profile.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

  const statusDescription =
    profile.subscriptionStatus === 'active' && formattedActiveUntil
      ? `Renova automaticamente em ${formattedActiveUntil}.${
          typeof remainingDays === 'number' ? ` Faltam ${remainingDays} dias.` : ''
        }`
      : profile.subscriptionStatus === 'pending_cancel' && formattedActiveUntil
        ? `Você mantém o acesso até ${formattedActiveUntil}.${
            typeof remainingDays === 'number' ? ` Restam ${remainingDays} dias.` : ''
          }`
        : profile.subscriptionStatus === 'canceled' && profile.canceledAt
          ? `Cancelada em ${new Date(profile.canceledAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}.`
          : null;

  const showCancelButton = profile.subscriptionStatus === 'active';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar conta">
      <div className={styles.wrapper}>
        <section className={styles.section}>
          <h3>Foto de perfil</h3>
          <p>Personalize o avatar exibido no topo de cada aplicativo.</p>
          <div className={styles.avatarPreview}>
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={`Foto de ${profile.displayName}`} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <label className={styles.uploadButton}>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={isUploading || isReadOnly}
            />
            {isReadOnly ? 'Renove para alterar' : isUploading ? 'Enviando...' : 'Selecionar nova foto'}
          </label>
        </section>

        <section className={styles.section}>
          <h3>Nome da conta</h3>
          <p>Este nome aparece na mensagem de boas-vindas e nas áreas autenticadas.</p>
          <form className={styles.nameForm} onSubmit={handleNameSubmit}>
            <label>
              Nome exibido
              <input
                type="text"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="Como deseja ser chamado"
                disabled={isReadOnly}
              />
            </label>
            <div className={styles.formFooter}>
              <span>Vinculado ao e-mail {user?.email ?? 'não informado'}</span>
              <button type="submit" disabled={isSaving || isReadOnly}>
                {isReadOnly ? 'Indisponível' : isSaving ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
            {isReadOnly && (
              <p className={styles.lockedInfo}>
                Dados de perfil ficam bloqueados enquanto sua assinatura estiver suspensa.
              </p>
            )}
          </form>
        </section>

        <section className={styles.section}>
          <h3>Status da assinatura</h3>
          <div className={styles.subscriptionStatus}>
            <div>
              <span>Situação atual</span>
              <strong>{statusLabel}</strong>
              {statusDescription && <small>{statusDescription}</small>}
            </div>
            {showCancelButton ? (
              <div className={styles.actionsStack}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={handleCancelSubscription}
                  disabled={isCanceling || loading}
                >
                  {isCanceling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              </div>
            ) : (
              <div className={styles.actionsStack}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  data-testid="renew-subscription"
                  onClick={handleRenew}
                >
                  Renovar assinatura
                </button>
                <p className={styles.warningText}>
                  Ao renovar, você será redirecionado ao fluxo de pagamento para ativar um novo ciclo.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
};

export { AccountProfileModal };
