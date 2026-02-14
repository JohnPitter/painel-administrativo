import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useTasks } from '../context/TaskContext';
import type { Task, TaskPriority, TaskStatus } from '../types/tasks';
import {
  formatPeriodLabel,
  getAvailableYears,
  getCurrentMonth,
  getCurrentYear,
  matchesPeriod,
  MONTH_OPTIONS,
} from '@modules/finance/utils/period';
import styles from './TaskFormList.module.css';

const PRIORITY_MATRIX: Array<{
  value: TaskPriority;
  quadrant: string;
  title: string;
  description: string;
}> = [
  {
    value: 'do_first',
    quadrant: 'Urgente & Importante',
    title: 'Fazer agora',
    description: 'Críticas para atingir seus objetivos principais. Reserve foco imediato.',
  },
  {
    value: 'schedule',
    quadrant: 'Importante, não urgente',
    title: 'Agendar',
    description: 'Planeje a execução em blocos de tempo dedicados para evitar atropelos.',
  },
  {
    value: 'delegate',
    quadrant: 'Urgente, não importante',
    title: 'Delegar',
    description: 'Permite que outra pessoa execute. Mantenha o acompanhamento próximo.',
  },
  {
    value: 'eliminate',
    quadrant: 'Nem urgente nem importante',
    title: 'Eliminar',
    description: 'Avalie se vale cancelar ou adiar indefinidamente essas demandas.',
  },
];

const taskSchema = z.object({
  title: z.string().min(1, 'Informe o título'),
  description: z.string().optional(),
  dueDate: z.string().min(1, 'Informe o prazo'),
  priority: z.enum(['do_first', 'schedule', 'delegate', 'eliminate']),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  do_first: 'Fazer agora',
  schedule: 'Agendar',
  delegate: 'Delegar',
  eliminate: 'Eliminar',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em progresso',
  completed: 'Concluída',
};
const STATUS_OPTIONS: TaskStatus[] = ['open', 'in_progress', 'completed'];

const TaskFormList = () => {
  const { tasks, addTask, updateTask, deleteTask, toggleTaskStatus } = useTasks();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(getCurrentMonth());
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');

  const yearOptions = useMemo(
    () => getAvailableYears(tasks.map(task => task.dueDate)),
    [tasks]
  );

  const periodLabel =
    viewMode === 'monthly'
      ? formatPeriodLabel(selectedMonth, selectedYear)
      : formatDailySummaryLabel(selectedDate);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesDate =
        viewMode === 'monthly'
          ? matchesPeriod(task.dueDate, selectedYear, selectedMonth)
          : matchesExactDate(task.dueDate, selectedDate);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesDate && matchesStatus;
    });
  }, [tasks, selectedYear, selectedMonth, statusFilter, viewMode, selectedDate]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'schedule',
      dueDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedPriority = watch('priority');

  const resetForm = () => {
    reset({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'schedule',
    });
  };

  const onSubmit = async (data: TaskFormValues) => {
    if (editingId) {
      await updateTask(editingId, {
        ...data,
        priority: data.priority,
      });
    } else {
      await addTask({
        ...data,
        priority: data.priority,
      });
    }

    setEditingId(null);
    resetForm();
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    reset({
      title: task.title,
      description: task.description ?? '',
      dueDate: task.dueDate,
      priority: task.priority,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    if (editingId === id) {
      setEditingId(null);
      resetForm();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const completedCount = filteredTasks.filter(task => task.status === 'completed').length;
  const openCount = filteredTasks.filter(task => task.status !== 'completed').length;

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h2>Lista de tarefas</h2>
          <p>Registre entregas, organize o mês e acompanhe o progresso por prioridade.</p>
        </div>
        <div className={styles.summaryChips}>
          <span>{openCount} pendentes</span>
          <span>{completedCount} concluídas</span>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="task-title">Título</label>
            <input id="task-title" placeholder="O que precisa ser feito?" {...register('title')} />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="task-dueDate">Prazo</label>
            <input id="task-dueDate" type="date" {...register('dueDate')} />
            {errors.dueDate && <span className={styles.error}>{errors.dueDate.message}</span>}
          </div>
        </div>

        <div className={styles.priorityMatrix}>
          <span className={styles.matrixLabel}>Defina a prioridade (matriz de Eisenhower)</span>
          <div className={styles.matrixGrid}>
            {PRIORITY_MATRIX.map(option => (
              <label
                key={option.value}
                className={clsx(
                  styles.matrixCard,
                  selectedPriority === option.value && styles.matrixCardActive
                )}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('priority')}
                  checked={selectedPriority === option.value}
                />
                <span className={styles.matrixBadge}>{option.quadrant}</span>
                <strong>{option.title}</strong>
                <p>{option.description}</p>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="task-description">Descrição</label>
          <textarea
            id="task-description"
            rows={3}
            placeholder="Detalhes importantes, links, checklist..."
            {...register('description')}
          />
          {errors.description && <span className={styles.error}>{errors.description.message}</span>}
        </div>

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Salvar alterações' : 'Adicionar tarefa'}
          </button>
          {editingId && (
            <button type="button" className={styles.secondaryButton} onClick={handleCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <section className={styles.filters}>
        <div className={styles.filterModes} role="group" aria-label="Visualização do período">
          <button
            type="button"
            className={viewMode === 'monthly' ? styles.filterModeButtonActive : styles.filterModeButton}
            onClick={() => setViewMode('monthly')}
          >
            Mensal
          </button>
          <button
            type="button"
            className={viewMode === 'daily' ? styles.filterModeButtonActive : styles.filterModeButton}
            onClick={() => setViewMode('daily')}
          >
            Diário
          </button>
        </div>

        {viewMode === 'monthly' ? (
          <>
            <div className={styles.filterField}>
              <label htmlFor="task-year">Ano</label>
              <div className={styles.selectWrapper}>
                <select
                  id="task-year"
                  value={selectedYear}
                  onChange={event => setSelectedYear(Number(event.target.value))}
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="task-month">Mês</label>
              <div className={styles.selectWrapper}>
                <select
                  id="task-month"
                  value={selectedMonth}
                  onChange={event => setSelectedMonth(Number(event.target.value))}
                >
                  {MONTH_OPTIONS.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.filterField}>
            <label htmlFor="task-day">Dia</label>
            <input
              id="task-day"
              type="date"
              className={styles.dateInput}
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
            />
          </div>
        )}

        <div className={styles.filterField}>
          <label htmlFor="task-status-filter">Status</label>
          <div className={styles.selectWrapper}>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as TaskStatus | 'all')}
            >
              <option value="all">Todos</option>
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.filterSummary}>Período: {periodLabel}</div>
      </section>

      {filteredTasks.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma tarefa para o período selecionado.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Prazo</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Pomodoros</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{new Date(task.dueDate).toLocaleDateString('pt-BR')}</td>
                <td>{PRIORITY_LABEL[task.priority]}</td>
                <td>
                  <div className={styles.tableSelectWrapper}>
                    <select
                      className={styles.tableSelect}
                      value={task.status}
                      onChange={event =>
                        void toggleTaskStatus(task.id, event.target.value as TaskStatus)
                      }
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{task.pomodoros ?? 0}</td>
                <td>
                  <div className={styles.tableActions}>
                    <button type="button" onClick={() => handleEdit(task)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void handleDelete(task.id)}>
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

const matchesExactDate = (dueDate: string, selectedDate: string) => {
  if (!selectedDate) {
    return true;
  }
  const normalize = (value: string) => value?.split('T')[0] ?? '';
  return normalize(dueDate) === normalize(selectedDate);
};

const formatDailySummaryLabel = (dateString: string) => {
  if (!dateString) {
    return 'Dia atual';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Dia selecionado';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export { TaskFormList };
