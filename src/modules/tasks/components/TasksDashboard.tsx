import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { MetricCard } from '@shared/components/MetricCard';
import { useTasks } from '../context/TaskContext';
import type { Task } from '../types/tasks';
import { formatPeriodLabel } from '@modules/finance/utils/period';
import styles from './TasksDashboard.module.css';

type Timeframe = 'monthly' | 'daily';

const statusLabel = {
  open: 'Aberta',
  in_progress: 'Em progresso',
  completed: 'Concluída',
};

const TasksDashboard = () => {
  const { tasks, pomodoros, gamification } = useTasks();
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly');

  const statusCounts = useMemo(() =>
    tasks.reduce(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      { open: 0, in_progress: 0, completed: 0 }
    ),
  [tasks]);

  const monthlyDataset = useMemo(() => buildMonthlyDataset(tasks), [tasks]);
  const dailyDataset = useMemo(() => buildDailyDataset(tasks), [tasks]);
  const chartDataset = timeframe === 'monthly' ? monthlyDataset : dailyDataset;

  const pomodoroByTask = useMemo(() => {
    const map = new Map<string, number>();
    pomodoros.forEach(session => {
      const key = session.taskId ?? 'Sem tarefa';
      map.set(key, (map.get(key) ?? 0) + session.durationMinutes);
    });

      return Array.from(map.entries()).map(([taskId, minutes]) => ({
        task: taskId === 'Sem tarefa' ? 'Sem tarefa vinculada' : formatTaskTitle(tasks, taskId),
        minutes,
      }));
  }, [pomodoros, tasks]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.metricGrid}>
        <MetricCard label="Pendentes" value={String(statusCounts.open)} trend="negative" footnote="Tarefas em aberto" />
        <MetricCard label="Em progresso" value={String(statusCounts.in_progress)} trend="neutral" />
        <MetricCard label="Concluídas" value={String(statusCounts.completed)} trend="positive" footnote={`Streak atual: ${gamification.streak} dias`} />
        <MetricCard label="Pontuação" value={gamification.totalPoints.toLocaleString('pt-BR')} trend="positive" footnote={`Nível ${gamification.level}`} />
      </div>

      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <div className={styles.cardHeaderCopy}>
            <h3>Evolução de tarefas</h3>
            <p>Volume de tarefas criadas, concluídas e em andamento por período.</p>
          </div>
          <div className={styles.timeframeToggle} role="group" aria-label="Alterar período do gráfico">
            <button
              type="button"
              className={timeframe === 'monthly' ? styles.timeframeButtonActive : styles.timeframeButton}
              onClick={() => setTimeframe('monthly')}
            >
              Mensal
            </button>
            <button
              type="button"
              className={timeframe === 'daily' ? styles.timeframeButtonActive : styles.timeframeButton}
              onClick={() => setTimeframe('daily')}
            >
              Diária
            </button>
          </div>
        </header>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartDataset}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 39, 118, 0.1)" />
              <XAxis dataKey="label" interval={timeframe === 'daily' ? 0 : undefined} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="created" stroke="#002776" fill="rgba(0, 39, 118, 0.35)" name="Criadas" />
              <Area type="monotone" dataKey="completed" stroke="#00923f" fill="rgba(0, 146, 63, 0.35)" name="Concluídas" />
              <Area type="monotone" dataKey="active" stroke="#ff7a00" fill="rgba(255, 122, 0, 0.35)" name="Em andamento" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <div className={styles.cardHeaderCopy}>
            <h3>Tempo em Pomodoro</h3>
            <p>Duração acumulada de sessões por tarefa.</p>
          </div>
        </header>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pomodoroByTask}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 39, 118, 0.1)" />
              <XAxis dataKey="task" interval={0} angle={-15} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={value => `${value} min`} />
              <Legend />
              <Bar dataKey="minutes" fill="#ffd500" name="Minutos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
};

const formatTaskTitle = (tasks: Task[], taskId: string) => {
  const found = tasks.find(task => task.id === taskId);
  return found ? found.title : 'Tarefa removida';
};

const buildMonthlyDataset = (tasks: Task[]) => {
  const grouped = new Map<
    string,
    { sortValue: string; label: string; created: number; completed: number; active: number }
  >();

  tasks.forEach(task => {
    const date = new Date(task.dueDate);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = grouped.get(key) ?? {
      sortValue: key,
      label: formatPeriodLabel(date.getMonth() + 1, date.getFullYear()),
      created: 0,
      completed: 0,
      active: 0,
    };

    current.created += 1;
    if (task.status === 'completed') {
      current.completed += 1;
    } else {
      current.active += 1;
    }
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.sortValue.localeCompare(b.sortValue))
    .map(({ sortValue: _sortValue, ...rest }) => rest);
};

const DAILY_RANGE_DAYS = 14;

const buildDailyDataset = (tasks: Task[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (DAILY_RANGE_DAYS - 1));

  const grouped = new Map<
    string,
    { sortValue: string; label: string; created: number; completed: number; active: number }
  >();

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const sortValue = d.toISOString().slice(0, 10);
    grouped.set(sortValue, {
      sortValue,
      label: formatDailyLabel(d),
      created: 0,
      completed: 0,
      active: 0,
    });
  }

  tasks.forEach(task => {
    const date = new Date(task.dueDate);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    date.setHours(0, 0, 0, 0);
    const sortValue = date.toISOString().slice(0, 10);
    const entry = grouped.get(sortValue);
    if (!entry) {
      return;
    }
    entry.created += 1;
    if (task.status === 'completed') {
      entry.completed += 1;
    } else {
      entry.active += 1;
    }
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.sortValue.localeCompare(b.sortValue))
    .map(({ sortValue: _sortValue, ...rest }) => rest);
};

const formatDailyLabel = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);

export { TasksDashboard };
