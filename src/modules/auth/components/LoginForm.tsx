import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '../services/AuthContext';
import styles from './LoginForm.module.css';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail')
    .email('Formato de e-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const { login, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setAuthError(null);
      await login(data.email, data.password);
    } catch (error) {
      setAuthError('Não foi possível realizar o login. Verifique suas credenciais.');
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <button
        type="button"
        className={styles.homeButton}
        onClick={() => navigate('/')}
        aria-label="Voltar para a home"
      >
        ← Voltar para a home
      </button>
      <header className={styles.header}>
        <span className={styles.badge}>Área do assinante</span>
        <h1>Entre para continuar sua jornada</h1>
        <p>Retome seus dados de finanças, tarefas, notas, calendário e automações com total segurança.</p>
      </header>

      <div className={styles.fieldGroup}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          {...register('email')}
        />
        {errors.email && <span className={styles.error}>{errors.email.message}</span>}
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && <span className={styles.error}>{errors.password.message}</span>}
      </div>

      {authError && <div className={styles.authError}>{authError}</div>}

      <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
        {isSubmitting ? 'Entrando...' : 'Entrar'}
      </button>

      <div className={styles.guestArea}>
        <span>Prefere usar sem login?</span>
        <button
          type="button"
          className={styles.guestButton}
          onClick={() => enterGuestMode()}
          disabled={isSubmitting}
        >
          Usar sem login
        </button>
        <p className={styles.guestHint}>
          Seus dados ficam salvos apenas neste dispositivo. Depois você pode ativar sincronização
          fazendo login com uma conta.
        </p>
      </div>
    </form>
  );
};

export { LoginForm };
