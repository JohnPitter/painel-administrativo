import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@core/layout/DashboardLayout';
import { useCalendar } from '@modules/calendar/context/CalendarContext';
import { useAuth } from '@modules/auth/services/AuthContext';
import { Modal } from '@shared/components/Modal/Modal';

import { AppCard } from '../components/AppCard';
import styles from './DashboardPage.module.css';

const appShortcuts = [
  {
    title: 'Finanças Pessoais',
    description: 'Controle gastos, receitas e investimentos em um só lugar.',
    path: '/financas',
    accentColor: '#00923f',
  },
  {
    title: 'Notas Pessoais',
    description: 'Capture ideias rápidas, listas e referências importantes.',
    path: '/notas',
    accentColor: '#ff7a00',
  },
  {
    title: 'Tarefas & Foco',
    description: 'Organize prazos, controle Pomodoro e acompanhe gamificação.',
    path: '/tarefas',
    accentColor: '#ffd500',
  },
  {
    title: 'Controle de Tempo',
    description: 'Registre jornadas, acompanhe horas e mantenha um histórico pessoal.',
    path: '/ponto',
    accentColor: '#00b4d8',
  },
  {
    title: 'Calendário',
    description: 'Planeje eventos, visualize compromissos e organize a semana em minutos.',
    path: '/calendario',
    accentColor: '#6a4c93',
  },
  {
    title: 'Relacionamentos',
    description: 'Mapeie contatos estratégicos e acompanhe follow-ups críticos.',
    path: '/relacionamentos',
    accentColor: '#d62828',
  },
  {
    title: 'Automações',
    description: 'Crie gatilhos entre apps para alertas, tarefas e notas automáticas.',
    path: '/automacoes',
    accentColor: '#ff006e',
  },
  {
    title: 'Assistente Financeiro',
    description: 'Converse com o PAI e receba análises dos seus números.',
    path: '/consultor',
    accentColor: '#0086ff',
  },
];

const PREFERENCE_KEY = 'dashboard_reminders_always_show';

type ReminderEvent = {
  id: string;
  type: 'calendar';
  title: string;
  description: string;
  date: Date;
  tag: string;
};

type ReminderItem = ReminderEvent;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { events } = useCalendar();
  const [alwaysShow, setAlwaysShow] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(PREFERENCE_KEY);
    if (stored !== null) {
      try {
        setAlwaysShow(JSON.parse(stored) as boolean);
      } catch (error) {
        console.error('Preferência de lembretes inválida', error);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify(alwaysShow));
  }, [alwaysShow, hydrated]);

  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { weekStart: start, weekEnd: end };
  }, [events]);

  const calendarReminders = useMemo<ReminderEvent[]>(() => {
    return events
      .map(event => ({
        event,
        date: new Date(`${event.date}T${event.time}`),
      }))
      .filter(item => isWithinRange(item.date, weekStart, weekEnd))
      .map(item => ({
        id: item.event.id,
        type: 'calendar' as const,
        title: item.event.title,
        description: item.event.description,
        date: item.date,
        tag: item.event.tag,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, weekStart, weekEnd]);

  const reminders: ReminderItem[] = useMemo(
    () => [...calendarReminders].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [calendarReminders]
  );

  useEffect(() => {
    if (reminders.length === 0) {
      setAutoOpened(false);
      return;
    }
    if (hydrated && alwaysShow && !autoOpened) {
      setIsModalOpen(true);
      setAutoOpened(true);
    }
  }, [alwaysShow, reminders.length, hydrated, autoOpened]);

  useEffect(() => {
    if (!alwaysShow) {
      setAutoOpened(false);
    }
  }, [alwaysShow]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const toggleAlwaysShow = () => {
    setAlwaysShow(prev => !prev);
  };

  const actions = reminders.length > 0 && (
    <button type="button" className={styles.reminderButton} onClick={() => setIsModalOpen(true)}>
      Ver lembretes desta semana
    </button>
  );

  return (
    <>
      <DashboardLayout
        title="Painel de Aplicações"
        subtitle="Escolha um aplicativo para começar sua gestão."
        actions={actions}
      >
        {isGuest && (
          <section className={styles.subscriptionBanner}>
            <div className={styles.bannerContent}>
              <span className={styles.bannerBadge}>Modo visitante</span>
              <h2>Gostou do painel? Assine e mantenha tudo sincronizado.</h2>
              <p>
                Com o plano cloud você garante backup automático, histórico completo de finanças,
                ponto e calendário, além de acessar notas, relacionamentos e automações em qualquer dispositivo.
              </p>
            </div>
            <div className={styles.bannerActions}>
              <button
                type="button"
                className={styles.bannerPrimary}
                onClick={() => navigate('/assinatura')}
              >
                Conhecer benefícios da assinatura
              </button>
              <span className={styles.bannerHighlight}>R$ 9,90/mês · Cancelamento simples</span>
            </div>
          </section>
        )}
        <section className={styles.shortcuts}>
          {appShortcuts.map(shortcut => (
            <AppCard key={shortcut.title} {...shortcut} />
          ))}
        </section>
      </DashboardLayout>

      <Modal
        isOpen={isModalOpen && reminders.length > 0}
        title="Lembretes da semana"
        onClose={handleCloseModal}
        footer={
          <>
            <button type="button" className={styles.modalSecondaryButton} onClick={toggleAlwaysShow}>
              {alwaysShow ? 'Não mostrar automaticamente' : 'Mostrar sempre ao entrar'}
            </button>
            <button type="button" className={styles.modalPrimaryButton} onClick={handleCloseModal}>
              Entendi
            </button>
          </>
        }
      >
        <div className={styles.modalSection}>
          {calendarReminders.length > 0 && (
            <section>
              <h3>Eventos do calendário</h3>
              <ul className={styles.reminderList}>
                {calendarReminders.map(item => (
                  <li key={`calendar-${item.id}`}>
                    <span className={styles.reminderTag}>{item.tag}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{formatDateTime(item.date)}</span>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Modal>
    </>
  );
};

const startOfWeek = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  start.setDate(start.getDate() + diff);
  return start;
};

const isWithinRange = (target: Date, start: Date, end: Date) => target >= start && target < end;

const formatDateTime = (date: Date) =>
  date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export { DashboardPage };
