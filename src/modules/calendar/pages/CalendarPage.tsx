import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@core/layout/DashboardLayout';

import { useCalendar } from '../context/CalendarContext';
import type { CalendarEvent } from '../types/calendar';
import styles from './CalendarPage.module.css';

const tagOptions: CalendarEvent['tag'][] = ['Reunião', 'Pessoal', 'Estudo', 'Saúde'];

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const CalendarPage = () => {
  const navigate = useNavigate();
  const { events, addEvent, removeEvent } = useCalendar();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [formState, setFormState] = useState<Omit<CalendarEvent, 'id'>>({
    date: new Date().toISOString().split('T')[0] ?? '',
    time: '09:00',
    title: '',
    description: '',
    tag: 'Reunião',
  });

  const daysInMonth = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const total = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: total }, (_, index) => new Date(year, month, index + 1));
  }, [selectedDate]);

  const eventsByDay = useMemo(() => {
    return events.reduce<Map<string, CalendarEvent[]>>((accumulator, event) => {
      const list = accumulator.get(event.date) ?? [];
      list.push(event);
      accumulator.set(event.date, list);
      return accumulator;
    }, new Map());
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(event => new Date(`${event.date}T${event.time}`) >= now)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
      .slice(0, 5);
  }, [events]);

  const handleMonthChange = (direction: number) => {
    const next = new Date(selectedDate);
    next.setMonth(selectedDate.getMonth() + direction);
    setSelectedDate(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    await addEvent(formState);
    if (formState.date) {
      const nextSelected = new Date(formState.date);
      if (!Number.isNaN(nextSelected.getTime())) {
        setSelectedDate(nextSelected);
      }
    }
    setFormState(prev => ({
      ...prev,
      title: '',
      description: '',
    }));
  };

  const handleRemove = async (id: string) => {
    await removeEvent(id);
  };

  return (
    <DashboardLayout
      title="Calendário pessoal"
      subtitle="Planeje compromissos, acompanhe eventos e mantenha uma visão consolidada da agenda."
      actions={
        <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
          ← Voltar para aplicativos
        </button>
      }
    >
      <section className={styles.wrapper}>
        <section className={styles.calendarCard}>
          <header className={styles.calendarHeader}>
            <button type="button" onClick={() => handleMonthChange(-1)}>
              ←
            </button>
            <h2>{getMonthLabel(selectedDate)}</h2>
            <button type="button" onClick={() => handleMonthChange(1)}>
              →
            </button>
          </header>

          <div className={styles.weekDays}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className={styles.grid}>
            {renderLeadingBlanks(selectedDate).map(index => (
              <span key={`blank-${index}`} />
            ))}
            {daysInMonth.map(day => {
              const iso = day.toISOString().split('T')[0] ?? '';
              const dayEvents = eventsByDay.get(iso) ?? [];
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={iso}
                  type="button"
                  className={isToday ? styles.today : undefined}
                  onClick={() => {
                    setFormState(prev => ({ ...prev, date: iso }));
                    setSelectedDate(day);
                  }}
                >
                  <span>{day.getDate()}</span>
                  {dayEvents.length > 0 && <small>{dayEvents.length} evento(s)</small>}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.formCard}>
          <header>
            <h3>Adicionar evento</h3>
            <p>Selecione uma data no calendário ou ajuste manualmente para criar um evento rápido.</p>
          </header>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              <span>Data</span>
              <input
                type="date"
                value={formState.date}
                onChange={event => setFormState(prev => ({ ...prev, date: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Horário</span>
              <input
                type="time"
                value={formState.time}
                onChange={event => setFormState(prev => ({ ...prev, time: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Título</span>
              <input
                type="text"
                value={formState.title}
                onChange={event => setFormState(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Checkpoint, consulta, aniversário..."
                required
              />
            </label>
            <label>
              <span>Categoria</span>
              <select
                value={formState.tag}
                onChange={event => setFormState(prev => ({ ...prev, tag: event.target.value as CalendarEvent['tag'] }))}
              >
                {tagOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.notesField}>
              <span>Descrição</span>
              <textarea
                rows={3}
                value={formState.description}
                onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Detalhes, links de reunião ou lembretes especiais."
              />
            </label>

            <button type="submit">Adicionar evento</button>
          </form>
        </section>

        <section className={styles.eventsCard}>
          <header>
            <h3>Próximos eventos</h3>
            <p>Veja rapidamente o que está chegando e ajuste a agenda com antecedência.</p>
          </header>
          {upcomingEvents.length === 0 ? (
            <div className={styles.emptyState}>Nenhum evento futuro planejado.</div>
          ) : (
            <ul className={styles.eventList}>
              {upcomingEvents.map(event => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>
                      {new Date(event.date).toLocaleDateString('pt-BR')} às {event.time} —{' '}
                      <mark>{event.tag}</mark>
                    </span>
                    <p>{event.description || 'Sem descrição adicional.'}</p>
                  </div>
                  <button type="button" onClick={() => handleRemove(event.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </DashboardLayout>
  );
};

const renderLeadingBlanks = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const weekday = firstDay.getDay(); // 0 (Domingo) - 6 (Sábado)
  return Array.from({ length: weekday }, (_, index) => index);
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export { CalendarPage };
