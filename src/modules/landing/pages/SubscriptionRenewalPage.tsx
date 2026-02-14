import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@modules/auth/services/AuthContext';
import { confirmRenewal, createCheckoutSession } from '@modules/landing/services/subscriptionService';

import styles from './SubscriptionRenewalPage.module.css';

type RenewalState = 'starting' | 'verifying' | 'success' | 'error';

const SubscriptionRenewalPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [state, setState] = useState<RenewalState>('starting');
  const [message, setMessage] = useState('Preparando renovação...');

  const sessionId = useMemo(() => searchParams.get('session_id'), [searchParams]);

  useEffect(() => {
    const run = async () => {
      if (!user || isGuest) {
        setState('error');
        setMessage('Faça login na sua conta para concluir a renovação.');
        return;
      }
      if (!sessionId) {
        try {
          setState('starting');
          setMessage('Redirecionando você para o Stripe...');
          const origin = window.location.origin;
          const successUrl = `${origin}/assinatura/renovar?session_id={CHECKOUT_SESSION_ID}`;
          const cancelUrl = `${origin}/dashboard`;
          const response = await createCheckoutSession({
            name:
              user.displayName ??
              user.email?.split('@')[0] ??
              'Usuário',
            email: user.email!,
            successUrl,
            cancelUrl,
            userId: user.uid,
            context: 'renewal',
          });
          if (response.checkoutUrl) {
            window.location.href = response.checkoutUrl;
            return;
          }
          throw new Error('Não foi possível iniciar o checkout.');
        } catch (error) {
          console.error('Renewal start failed', error);
          setState('error');
          setMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível iniciar a renovação. Tente novamente mais tarde.'
          );
        }
        return;
      }
      try {
        setState('verifying');
        setMessage('Confirmando pagamento com o Stripe...');
        const token = await user.getIdToken();
        const response = await confirmRenewal(sessionId, token);
        setState('success');
        setMessage(
          response?.activeUntil
            ? `Assinatura renovada! Novo ciclo ativo até ${new Date(response.activeUntil).toLocaleDateString(
                'pt-BR'
              )}.`
            : 'Assinatura renovada com sucesso! Você já pode voltar ao painel.'
        );
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2500);
      } catch (error) {
        console.error('Renewal verification failed', error);
        setState('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar o pagamento. Caso o valor já tenha sido cobrado, entre em contato com o suporte.'
        );
      }
    };

    void run();
  }, [sessionId, user, isGuest, navigate]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {(state === 'starting' || state === 'verifying') && (
          <>
            <div className={styles.loader} aria-hidden />
            <h1>Confirmando renovação</h1>
            <p>{message}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className={styles.successIcon} aria-hidden>
              ✓
            </div>
            <h1>Assinatura reativada</h1>
            <p>{message}</p>
            <div className={styles.actions}>
              <button type="button" onClick={() => navigate('/dashboard', { replace: true })}>
                Voltar ao painel
              </button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className={styles.errorIcon} aria-hidden>
              !
            </div>
            <h1>Não foi possível concluir</h1>
            <p>{message}</p>
            <div className={styles.actions}>
              <Link to="/dashboard">Voltar ao painel</Link>
              <Link to="/assinatura">Refazer pagamento</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { SubscriptionRenewalPage };
