import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@modules/auth/services/AuthContext';

import heroDashboard from '@modules/landing/assets/hero-dashboard.svg';
import financeOverview from '@modules/landing/assets/finance-overview.svg';
import tasksFocus from '@modules/landing/assets/tasks-focus.svg';
import calendarPlanner from '@modules/landing/assets/calendar-planner.svg';

import styles from './HomePage.module.css';

const featureCards = [
  {
    title: 'Finanças conectadas por IA prática',
    description:
      'Registre receitas, gastos, cartões e investimentos em segundos e deixe o PAI mostrar alertas, projeções e reembolsos ignorados automaticamente.',
    bullets: [
      'Categorias inteligentes, exclusão de lançamentos não contabilizados e gráficos instantâneos',
      'Simulador de investimentos com metas, recorrências e previsões de saldo projetado',
      'Modo visitante ou nuvem com históricos conectados por período',
    ],
  },
  {
    title: 'Controle de tempo centrado em foco',
    description:
      'Registre turnos, acompanhe banco de horas e contraste com metas semanais para liberar energia mental.',
    bullets: [
      'Registros rápidos de entrada, saída e intervalos',
      'Resumo semanal com insights de carga real vs. planejada',
      'Exportação em PDF e histórico local ou cloud em um clique',
    ],
  },
  {
    title: 'Calendário planejado com contexto',
    description:
      'Organize compromissos, conecte com notas e tarefas e tenha clareza do que vem pela frente.',
    bullets: [
      'Visão mensal interativa com contagem e etiquetas inteligentes',
      'Lista de próximos compromissos e atalhos para criação rápida',
      'Etiquetas personalizadas conectadas aos painéis de notas e tarefas',
    ],
  },
  {
    title: 'Gestão de tarefas com copiloto pessoal',
    description: 'Planeje o mês, acompanhe gamificação e mantenha o foco com Pomodoro integrado.',
    bullets: [
      'Matriz de Eisenhower para priorizar o que importa',
      'Métricas mensais, filtros responsivos e timer com registro automático',
      'Pontuação, níveis e streak diário para manter o ritmo',
    ],
  },
  {
    title: 'Notas e base pessoal conectada',
    description:
      'Capture ideias, listas e referências com métricas visuais para entender seu momento.',
    bullets: [
      'Dashboard com notas por tag, itens fixados e atualizadas na semana',
      'Formulário rápido com filtros por tag, busca e modo “pinned only”',
      'Ideal para documentar insights vindos das automações e do CRM pessoal',
    ],
  },
  {
    title: 'Relacionamentos e follow-ups',
    description:
      'Mapeie contatos estratégicos, acompanhe interações e nunca esqueça um próximo passo.',
    bullets: [
      'Pipeline visual por estágio com métricas de prioridade',
      'Registro detalhado de interações com canais, resumos e próximos passos',
      'Filtros por estágio, busca inteligente e etiquetas personalizadas',
    ],
  },
  {
    title: 'Automações entre aplicativos',
    description:
      'Crie gatilhos cruzando finanças, tarefas, calendário, CRM e foco em poucos cliques.',
    bullets: [
      'Eventos pré-configurados para cada módulo ou execuções manuais',
      'Condições e ações para gerar tarefas, notas, alertas ou follow-ups',
      'Indicadores de execuções, último disparo e controle rápido de status',
    ],
  },
];

const moduleChips = [
  'Finanças inteligentes',
  'Tarefas & Foco',
  'Notas conectadas',
  'Calendário inteligente',
  'Controle de tempo',
  'Relacionamentos',
  'Automações',
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isGuest, enterGuestMode } = useAuth();
  const [activatingDemo, setActivatingDemo] = useState(false);

  const isAuthenticated = useMemo(() => Boolean(user) || isGuest, [user, isGuest]);

  const handleAccessPanel = () => {
    if (isAuthenticated && !isGuest) {
      navigate('/dashboard');
      return;
    }

    navigate('/assinatura');
  };

  const handleGuestAccess = () => {
    if (isAuthenticated && isGuest) {
      navigate('/dashboard');
      return;
    }

    setActivatingDemo(true);
    enterGuestMode();
    navigate('/dashboard');
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroContent}>
          <div className={styles.heroTextColumn}>
            <span className={styles.badge}>PAI — Painel Administrativo Inteligente</span>

            <div className={styles.heroCopy}>
              <h1>PAI é seu copiloto estratégico: unifique dados, automações e foco em um só painel.</h1>
              <p>
                O Painel Administrativo Inteligente conecta finanças, tarefas, CRM pessoal, agenda e
                notas para entregar insights em tempo real, sugerir automações e liberar você para
                decisões estratégicas.
              </p>
            </div>

            <div className={styles.moduleChips}>
              {moduleChips.map(chip => (
                <span key={chip} className={styles.moduleChip}>
                  {chip}
                </span>
              ))}
            </div>

            <div className={styles.ctaGroup}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={handleAccessPanel}
                disabled={activatingDemo}
              >
                {isAuthenticated && !isGuest ? 'Ir para o PAI' : 'Assinar o PAI agora'}
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={handleGuestAccess}
                disabled={activatingDemo}
              >
                {activatingDemo ? 'Preparando ambiente...' : 'Continuar como visitante'}
              </button>
              {!isAuthenticated && (
                <button
                  type="button"
                  className={styles.linkAction}
                  onClick={() => navigate('/login')}
                  disabled={activatingDemo}
                >
                  Já tenho assinatura
                </button>
              )}
            </div>

            <div className={styles.heroHighlights}>
              <div className={styles.highlightCard}>
                <span>Aplicativos integrados</span>
                <p>
                  Finanças, tarefas, notas, calendário, ponto, CRM e automações em um cockpit único.
                </p>
              </div>
              <div className={styles.highlightCard}>
                <span>Fluxos inteligentes</span>
                <p>Crie regras que disparam tarefas, notas e follow-ups dentro do PAI.</p>
              </div>
              <div className={styles.highlightCard}>
                <span>Modo cloud ou visitante</span>
                <p>Teste localmente sem custo ou sincronize tudo na nuvem quando preferir.</p>
              </div>
            </div>
          </div>

          <figure className={styles.heroVisual}>
            <img
              src={heroDashboard}
              alt="Visual do painel com gráficos e indicadores de finanças, tarefas e calendário"
              loading="lazy"
            />
            <figcaption>Visual unificado das métricas do seu dia</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featureShowcase}>
          <figure className={styles.featureImageCard}>
            <img
              src={financeOverview}
              alt="Resumo financeiro com gráfico de crescimento e metas concluídas"
              loading="lazy"
            />
            <figcaption>Controle financeiro inteligente com projeções</figcaption>
          </figure>
          <figure className={styles.featureImageCard}>
            <img
              src={tasksFocus}
              alt="Gestor de tarefas com checklists e indicador de foco Pomodoro"
              loading="lazy"
            />
            <figcaption>Rotinas com foco e métricas gamificadas</figcaption>
          </figure>
          <figure className={styles.featureImageCard}>
            <img
              src={calendarPlanner}
              alt="Calendário com eventos organizados por categorias e lembretes"
              loading="lazy"
            />
            <figcaption>Calendário planejado para enxergar prioridades</figcaption>
          </figure>
        </div>

        <div className={styles.featuresGrid}>
          {featureCards.map(card => (
            <article key={card.title} className={styles.featureCard}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <ul>
                {card.bullets.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className={styles.callout}>
          <div className={styles.calloutContent}>
            <h2>Escolha como quer usar</h2>
            <p>
              Assinantes têm todos os dados sincronizados na nuvem por R$ 9,90/mês e recebem um login
              exclusivo para acessar em qualquer dispositivo. Preferiu testar? Use o modo visitante e
              mantenha tudo salvo apenas neste aparelho. Todos os novos aplicativos — notas, relacionamentos
              e automações — já fazem parte dos dois modos.
            </p>
          </div>

          <div className={styles.subscriptionGrid}>
            <article className={styles.subscriptionCard}>
              <header>
                <span className={styles.planBadge}>Plano Cloud</span>
                <strong>R$ 9,90 / mês</strong>
              </header>
              <ul>
                <li>Sincronização automática em nuvem</li>
                <li>Histórico completo de finanças e ponto</li>
                <li>Agenda com alertas em todos os dispositivos</li>
                <li>Atualizações e suporte prioritário</li>
              </ul>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={handleAccessPanel}
                disabled={activatingDemo}
              >
                {isAuthenticated ? 'Acessar painel' : 'Assinar agora'}
              </button>
            </article>

            <article className={styles.subscriptionCard}>
              <header>
                <span className={styles.planBadgeVisitor}>Modo Visitante</span>
                <strong>Sem custo</strong>
              </header>
              <ul>
                <li>Experimente todos os módulos</li>
                <li>Dados salvos apenas neste dispositivo</li>
                <li>Ideal para testes rápidos</li>
                <li>Migrar para cloud quando quiser</li>
              </ul>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={handleGuestAccess}
                disabled={activatingDemo}
              >
                {activatingDemo ? 'Preparando ambiente...' : 'Entrar como visitante'}
              </button>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};

export { HomePage };
