import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@modules/auth/services/AuthContext';
import { register as registerUser, applyDisplayName } from '@modules/auth/services/authService';
import {
  clearSubscriptionIntent,
  readSubscriptionIntent,
  type SubscriptionIntent,
} from '@modules/landing/services/subscriptionStorage';
import { getCheckoutSessionStatus } from '@modules/landing/services/subscriptionService';

import styles from './SubscriptionFinalizePage.module.css';

type FinalizeState = 'verifying' | 'awaitingPassword' | 'registering' | 'success' | 'error';

const passwordSchema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme sua senha'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'As senhas precisam ser iguais',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

const SubscriptionFinalizePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin, isGuest } = useAuth();

  const [state, setState] = useState<FinalizeState>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [intent, setIntent] = useState<SubscriptionIntent | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const redirectTimeoutRef = useRef<number | null>(null);

  const sessionId = useMemo(() => searchParams.get('session_id'), [searchParams]);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    let isMounted = true;

    const finalizeCheckout = async () => {
      if (!sessionId) {
        if (isMounted) {
          setState('error');
          setErrorMessage('Sessão de pagamento não encontrada. Refaça o processo de assinatura.');
        }
        return;
      }

      const storedIntent = readSubscriptionIntent();
      if (!storedIntent) {
        if (isMounted) {
          setState('error');
          setErrorMessage(
            'Não encontramos os dados de cadastro associados ao pagamento. Por favor inicie a assinatura novamente.'
          );
        }
        return;
      }
      if (isMounted) {
        setIntent(storedIntent);
      }

      try {
        const checkoutStatus = await getCheckoutSessionStatus(sessionId);

        if (checkoutStatus.status !== 'complete' || checkoutStatus.paymentStatus !== 'paid') {
          throw new Error(
            'O pagamento ainda não foi confirmado pelo provedor. Aguarde alguns segundos e atualize a página.'
          );
        }

        if (isMounted) {
          setCustomerEmail(checkoutStatus.customerEmail ?? storedIntent.email);
          setState('awaitingPassword');
          setPasswordError(null);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setState('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível validar o pagamento. Caso o valor já tenha sido cobrado, entre em contato com o suporte com o número do pedido.'
          );
        }
      }
    };

    finalizeCheckout();

    return () => {
      isMounted = false;
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [sessionId]);

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (!intent) {
      setPasswordError(
        'Não encontramos o cadastro temporário. Refaça o processo de assinatura para definir a senha.'
      );
      return;
    }

    setPasswordError(null);
    setState('registering');

    try {
      const credentials = await registerUser(intent.email, data.password);

      if (intent.name.trim().length > 0) {
        await applyDisplayName(credentials.user, intent.name.trim());
      }

      if (isGuest) {
        await authLogin(intent.email, data.password);
      }

      clearSubscriptionIntent();
      setState('success');

      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 4000);
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
        setPasswordError(
          'Este e-mail já possui uma conta. Faça login com sua senha existente para acessar o painel.'
        );
        setState('awaitingPassword');
        return;
      }

      console.error(error);
      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Não foi possível definir sua senha. Tente novamente em instantes.'
      );
      setState('awaitingPassword');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {state === 'verifying' && (
          <>
            <div className={styles.loader} aria-hidden />
            <h1>Confirmando pagamento</h1>
            <p>Estamos verificando seu pagamento com o Stripe. Isso leva apenas alguns segundos.</p>
          </>
        )}

        {state === 'awaitingPassword' && (
          <>
            <h1>Defina sua senha</h1>
            <p>
              Pagamento confirmado! Escolha uma senha para finalizar seu acesso ao painel. Seu login
              será {customerEmail ?? 'o e-mail informado'}.
            </p>
            <form className={styles.passwordForm} onSubmit={handleSubmit(handlePasswordSubmit)}>
              <div className={styles.fieldGroup}>
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  type="password"
                  placeholder="mínimo 6 caracteres"
                  autoComplete="new-password"
                  {...registerField('password')}
                />
                {errors.password && <span className={styles.error}>{errors.password.message}</span>}
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="confirmPassword">Confirmar senha</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="repita sua senha"
                  autoComplete="new-password"
                  {...registerField('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <span className={styles.error}>{errors.confirmPassword.message}</span>
                )}
              </div>
              {passwordError && <div className={styles.passwordError}>{passwordError}</div>}
              <button type="submit" className={styles.primaryLink} disabled={isSubmitting}>
                {isSubmitting ? 'Salvando senha...' : 'Salvar senha e acessar painel'}
              </button>
            </form>
          </>
        )}

        {state === 'registering' && (
          <>
            <div className={styles.loader} aria-hidden />
            <h1>Preparando sua conta</h1>
            <p>Pagamento aprovado! Estamos criando seu usuário e configurando o painel.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className={styles.successIcon} aria-hidden>✓</div>
            <h1>Assinatura confirmada</h1>
            <p>
              Tudo pronto! {customerEmail ? `Usaremos ${customerEmail} como login.` : 'Sua conta está pronta.'}{' '}
              Você será direcionado ao painel automaticamente em instantes.
            </p>
            <Link className={styles.primaryLink} to="/dashboard">
              Ir agora para o painel
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className={styles.errorIcon} aria-hidden>!</div>
            <h1>Não foi possível concluir</h1>
            <p>{errorMessage}</p>
            <div className={styles.actions}>
              <Link className={styles.primaryLink} to="/assinatura">
                Voltar para assinatura
              </Link>
              <Link className={styles.secondaryLink} to="/">
                Ir para a página inicial
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { SubscriptionFinalizePage };
