import type { ReactNode } from 'react';

import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className={styles.wrapper}>
      <section className={styles.hero}>
        <div className={styles.overlay} />
        <div className={styles.heroContent}>
          <span className={styles.chip}>Seu dia organizado</span>
          <h1>Bem-vindo ao painel integrado que cuida da sua rotina</h1>
          <p>
            Acompanhe finanças, tarefas, calendário, notas, relacionamentos e automações em um único
            ambiente. Tudo sincronizado na nuvem e acessível em qualquer dispositivo.
          </p>
          <ul>
            <li>Finanças pessoais com dashboards e projeções</li>
            <li>Agenda, tarefas e Pomodoro conectados</li>
            <li>Notas, relacionamentos e alertas inteligentes</li>
          </ul>
        </div>
      </section>

      <section className={styles.panel}>{children}</section>
    </div>
  );
};

export { AuthLayout };
