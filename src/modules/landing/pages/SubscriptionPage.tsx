import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@modules/auth/services/AuthContext';
import {
  createCheckoutSession,
  type CreateCheckoutSessionParams,
} from '@modules/landing/services/subscriptionService';
import {
  persistSubscriptionIntent,
  clearSubscriptionIntent,
} from '@modules/landing/services/subscriptionStorage';

import styles from './SubscriptionPage.module.css';

const checkoutSchema = z.object({
  name: z.string().min(3, 'Informe seu nome completo'),
  email: z
    .string()
    .min(1, 'Informe um e-mail válido')
    .email('Formato de e-mail inválido'),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  const isAuthenticated = useMemo(() => Boolean(user) && !isGuest, [user, isGuest]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: CheckoutFormData) => {
    try {
      setSubmissionError(null);

      const successUrl = `${window.location.origin}/assinatura/finalizar?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/assinatura`;

      const payload: CreateCheckoutSessionParams = {
        name: data.name,
        email: data.email,
        successUrl,
        cancelUrl,
      };

      const session = await createCheckoutSession(payload);

      persistSubscriptionIntent({
        name: data.name,
        email: data.email,
      });

      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl;
        return;
      }

      throw new Error(
        'A sessão de checkout foi criada, porém nenhum endereço de pagamento foi retornado.'
      );
    } catch (error) {
      console.error(error);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o pagamento. Tente novamente em instantes.'
      );
      clearSubscriptionIntent();
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.panel}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/', { replace: false })}
        >
          ← Voltar sem assinar
        </button>
        <header className={styles.header}>
          <span className={styles.badge}>Plano Cloud</span>
          <h1>Ative sua assinatura</h1>
          <p>
            Complete os dados abaixo para acessar o painel em todos os seus dispositivos. Você será
            redirecionado ao Stripe para concluir o pagamento com segurança.
          </p>
        </header>

        <div className={styles.planHighlight}>
          <strong>R$ 9,90 / mês</strong>
          <ul>
            <li>Sincronização na nuvem e backup automático</li>
            <li>Histórico completo de finanças e ponto</li>
            <li>Calendário com alertas em todos os dispositivos</li>
            <li>Suporte prioritário por e-mail</li>
          </ul>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.fieldGroup}>
            <label htmlFor="name">Seu nome</label>
            <input id="name" type="text" placeholder="Nome e sobrenome" {...register('name')} />
            {errors.name && <span className={styles.error}>{errors.name.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" placeholder="você@email.com" {...register('email')} />
            {errors.email && <span className={styles.error}>{errors.email.message}</span>}
          </div>

          {submissionError && <div className={styles.formError}>{submissionError}</div>}

          <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
            {isSubmitting ? 'Redirecionando...' : 'Ir para pagamento seguro'}
          </button>

          <p className={styles.securityInfo}>
            O pagamento é processado pelo Stripe. Após a confirmação, pediremos a criação da sua senha
            para liberar o painel.
          </p>
        </form>
      </section>
    </div>
  );
};

export { SubscriptionPage };
