import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import { generateId } from '@shared/utils/id';
import type { ApiError } from '@shared/services/apiClient';

import {
  createTask as createTaskRemote,
  deleteTask as deleteTaskRemote,
  getGamification,
  listPomodoros,
  listTasks,
  logPomodoro as logPomodoroRemote,
  updateTask as updateTaskRemote,
  updateTaskStatus,
} from '../services/taskService';
import type { PomodoroSession, Task, TaskContextValue, TaskPriority, TaskState } from '../types/tasks';

const LOCAL_STORAGE_KEY = 'guest_tasks_state';
const REMOTE_CACHE_PREFIX = 'task_remote_state';
const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

const initialState: TaskState = {
  tasks: [],
  pomodoros: [],
  gamification: {
    totalPoints: 0,
    level: 1,
    streak: 0,
    lastCompletedAt: null,
  },
};

const sortTasksByDueDate = (tasks: Task[]) =>
  [...tasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

const calculateLevel = (totalPoints: number) => Math.max(1, Math.floor(totalPoints / 100) + 1);

const EISENHOWER_PRIORITIES: TaskPriority[] = ['do_first', 'schedule', 'delegate', 'eliminate'];
const legacyPriorityMap: Record<string, TaskPriority> = {
  high: 'do_first',
  medium: 'schedule',
  low: 'delegate',
};

const normalizePriority = (priority: string | undefined): TaskPriority => {
  if (!priority) {
    return 'schedule';
  }

  if (EISENHOWER_PRIORITIES.includes(priority as TaskPriority)) {
    return priority as TaskPriority;
  }

  return legacyPriorityMap[priority] ?? 'schedule';
};

const mapGuestState = (raw: Partial<TaskState> | null | undefined): TaskState => {
  const totalPoints = raw?.gamification?.totalPoints ?? initialState.gamification.totalPoints;
  return {
    tasks: (raw?.tasks ?? []).map(task => ({
      ...task,
      priority: normalizePriority(task.priority),
    })),
    pomodoros: raw?.pomodoros ?? [],
    gamification: {
      totalPoints,
      level: calculateLevel(totalPoints),
      streak: raw?.gamification?.streak ?? initialState.gamification.streak,
      lastCompletedAt:
        raw?.gamification?.lastCompletedAt ?? initialState.gamification.lastCompletedAt,
    },
  };
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

const computeStreak = (current: TaskState['gamification'], completedAt: Date) => {
  const lastDate = current.lastCompletedAt ? new Date(current.lastCompletedAt) : null;
  let streak = 1;

  if (lastDate) {
    const completedDay = new Date(completedAt);
    completedDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(lastDate);
    lastDay.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((completedDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      streak = current.streak;
    } else if (diffDays === 1) {
      streak = current.streak + 1;
    }
  }

  return streak;
};

const buildRemoteCacheKey = (uid: string) => `${REMOTE_CACHE_PREFIX}_${uid}`;

const getErrorStatus = (error: unknown) => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as ApiError).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
};

const isAccessDeniedError = (error: unknown) => {
  const status = getErrorStatus(error);
  return status === 401 || status === 403;
};

const normalizeTask = (task: Task): Task => ({
  ...task,
  priority: normalizePriority(task.priority),
});

const normalizeGamification = (
  gamification: Partial<TaskState['gamification']> | null | undefined
): TaskState['gamification'] => {
  const totalPoints = gamification?.totalPoints ?? initialState.gamification.totalPoints;
  return {
    totalPoints,
    level: calculateLevel(totalPoints),
    streak: gamification?.streak ?? initialState.gamification.streak,
    lastCompletedAt: gamification?.lastCompletedAt ?? initialState.gamification.lastCompletedAt,
  };
};

function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [state, setState] = useState<TaskState>(initialState);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const persistGuestState = useCallback((next: TaskState) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Erro ao salvar tarefas locais', error);
    }
  }, []);

  const updateGuestState = useCallback(
    (updater: (prev: TaskState) => TaskState) => {
      setState(prev => {
        const next = updater(prev);
        persistGuestState(next);
        return next;
      });
    },
    [persistGuestState]
  );

  const loadGuestState = useCallback(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        setState(initialState);
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(stored) as Partial<TaskState> | null;
      setState(mapGuestState(parsed));
    } catch (error) {
      console.error('Erro ao carregar tarefas locais', error);
      setState(initialState);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistRemoteCache = useCallback(
    (next: TaskState) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Não foi possível salvar cache remoto das tarefas', error);
      }
    },
    [user]
  );

  const loadRemoteCache = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(buildRemoteCacheKey(user.uid));
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as Partial<TaskState> | null;
      if (!parsed) {
        return null;
      }
      return mapGuestState(parsed);
    } catch (error) {
      console.warn('Não foi possível carregar cache remoto das tarefas', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteState = useCallback(async (): Promise<TaskState> => {
    const token = await getRemoteToken();
    const [tasksResponse, pomodorosResponse, gamificationResponse] = await Promise.all([
      listTasks(token),
      listPomodoros(token),
      getGamification(token),
    ]);
    const snapshot: TaskState = {
      tasks: sortTasksByDueDate(tasksResponse.tasks.map(normalizeTask)),
      pomodoros: pomodorosResponse.pomodoros ?? [],
      gamification: normalizeGamification(gamificationResponse.gamification),
    };
    persistRemoteCache(snapshot);
    return snapshot;
  }, [getRemoteToken, persistRemoteCache]);

  const scheduleBackgroundSync = useCallback(() => {
    if (typeof window === 'undefined' || isGuestMode || !user) {
      return;
    }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const snapshot = await fetchRemoteState();
        setState(snapshot);
      } catch (error) {
        console.error('Falha ao sincronizar tarefas em segundo plano', error);
      } finally {
        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    }, 2000);
  }, [fetchRemoteState, isGuestMode, user]);

  const refreshGamification = useCallback(async () => {
    try {
      const token = await getRemoteToken();
      const response = await getGamification(token);
      setState(prev => ({
        ...prev,
        gamification: normalizeGamification(response.gamification),
      }));
    } catch (error) {
      console.error('Erro ao atualizar gamificação', error);
    }
  }, [getRemoteToken]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isGuestMode || !user) {
      setLoading(true);
      loadGuestState();
      return;
    }

    let active = true;
    setLoading(true);
    const cached = loadRemoteCache();
    if (cached) {
      setState(cached);
      setLoading(false);
    }

    fetchRemoteState()
      .then(snapshot => {
        if (!active) {
          return;
        }
        setState(snapshot);
        setLoading(false);
      })
      .catch(error => {
        if (!active) {
          return;
        }
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestState();
          toast.error('Sua assinatura está suspensa. Os dados serão mantidos localmente.');
          return;
        }
        console.error('Erro ao carregar tarefas do servidor', error);
        toast.error('Não foi possível carregar suas tarefas agora.');
        setLoading(false);
      });

  return () => {
      active = false;
    };
  }, [fetchRemoteState, isGuestMode, loadGuestState, loadRemoteCache, user]);

  const addTask: TaskContextValue['addTask'] = useCallback(
    async data => {
      const now = new Date().toISOString();
      const payload: Omit<Task, 'id'> = {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: normalizePriority(data.priority ?? 'schedule'),
        status: data.status ?? 'open',
        createdAt: now,
        updatedAt: now,
        pomodoros: data.pomodoros ?? 0,
      };

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          ...prev,
          tasks: sortTasksByDueDate([
            ...prev.tasks,
            {
              ...payload,
              id: generateId(),
            },
          ]),
        }));
        toast.success('Tarefa criada');
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await createTaskRemote(token, {
          ...payload,
        });
        const createdTask = normalizeTask(response.task);
        setState(prev => ({
          ...prev,
          tasks: sortTasksByDueDate([...prev.tasks, createdTask]),
        }));
        toast.success('Tarefa criada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao criar tarefa', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            ...prev,
            tasks: sortTasksByDueDate([
              ...prev.tasks,
              {
                ...payload,
                id: generateId(),
              },
            ]),
          }));
          toast.success('Tarefa registrada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível criar a tarefa');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const updateTask: TaskContextValue['updateTask'] = useCallback(
    async (id, data) => {
      const now = new Date().toISOString();
      const normalizedData =
        data.priority !== undefined
          ? { ...data, priority: normalizePriority(data.priority) }
          : data;

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          ...prev,
          tasks: sortTasksByDueDate(
            prev.tasks.map(task =>
              task.id === id
                ? {
                    ...task,
                    ...normalizedData,
                    updatedAt: now,
                  }
                : task
            )
          ),
        }));
        toast.success('Tarefa atualizada');
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await updateTaskRemote(token, id, normalizedData);
        setState(prev => ({
          ...prev,
          tasks: sortTasksByDueDate(
            prev.tasks.map(task =>
              task.id === id
                ? {
                    ...task,
                    ...normalizedData,
                    ...(response.updatedAt ? { updatedAt: response.updatedAt } : {}),
                  }
                : task
            )
          ),
        }));
        toast.success('Tarefa atualizada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar tarefa', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            ...prev,
            tasks: sortTasksByDueDate(
              prev.tasks.map(task =>
                task.id === id
                  ? {
                      ...task,
                      ...normalizedData,
                      updatedAt: now,
                    }
                  : task
              )
            ),
          }));
          toast.success('Tarefa atualizada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível atualizar a tarefa');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const deleteTask: TaskContextValue['deleteTask'] = useCallback(
    async id => {
      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== id),
        }));
        toast.success('Tarefa removida');
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteTaskRemote(token, id);
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== id),
        }));
        toast.success('Tarefa removida');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover tarefa', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            ...prev,
            tasks: prev.tasks.filter(task => task.id !== id),
          }));
          toast.success('Tarefa removida localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível remover a tarefa');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const toggleTaskStatus: TaskContextValue['toggleTaskStatus'] = useCallback(
    async (id, status) => {
      const completedAt = new Date();
      const completedIso = completedAt.toISOString();

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task =>
            task.id === id
              ? {
                  ...task,
                  status,
                  updatedAt: completedIso,
                }
              : task
          ),
        }));
        toast.success(status === 'completed' ? 'Tarefa concluída!' : 'Status atualizado');
        if (status === 'completed') {
          updateGuestState(prev => {
            const totalPoints = prev.gamification.totalPoints + 10;
            return {
              ...prev,
              gamification: {
                totalPoints,
                level: calculateLevel(totalPoints),
                streak: computeStreak(prev.gamification, completedAt),
                lastCompletedAt: completedIso,
              },
            };
          });
        }
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await updateTaskStatus(token, id, status);
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task =>
            task.id === id
              ? {
                  ...task,
                  status: response.status,
                  updatedAt: response.updatedAt,
                }
              : task
          ),
        }));
        toast.success(status === 'completed' ? 'Tarefa concluída!' : 'Status atualizado');
        await refreshGamification();
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar status da tarefa', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            ...prev,
            tasks: prev.tasks.map(task =>
              task.id === id
                ? {
                    ...task,
                    status,
                    updatedAt: completedIso,
                  }
                : task
            ),
          }));
          toast.success('Status atualizado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível atualizar a tarefa');
      }
    },
    [getRemoteToken, isGuestMode, refreshGamification, scheduleBackgroundSync, updateGuestState, user]
  );

  const logPomodoro: TaskContextValue['logPomodoro'] = useCallback(
    async data => {
      const start = new Date();
      const end = new Date(start.getTime() + data.durationMinutes * 60 * 1000);

      if (isGuestMode || !user) {
        updateGuestState(prev => {
          const pomodoroEntry: PomodoroSession = {
            id: generateId(),
            taskId: data.taskId,
            startedAt: start.toISOString(),
            endedAt: end.toISOString(),
            durationMinutes: data.durationMinutes,
          };

          const nextTasks = data.taskId
            ? prev.tasks.map(task =>
                task.id === data.taskId
                  ? {
                      ...task,
                      pomodoros: (task.pomodoros ?? 0) + 1,
                      updatedAt: start.toISOString(),
                    }
                  : task
              )
            : prev.tasks;

          return {
            ...prev,
            tasks: nextTasks,
            pomodoros: [pomodoroEntry, ...prev.pomodoros],
          };
        });

        toast.success('Sessão Pomodoro registrada');
        updateGuestState(prev => {
          const pointsEarned = Math.max(1, Math.floor(data.durationMinutes / 5));
          const totalPoints = prev.gamification.totalPoints + pointsEarned;
          return {
            ...prev,
            gamification: {
              ...prev.gamification,
              totalPoints,
              level: calculateLevel(totalPoints),
            },
          };
        });
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await logPomodoroRemote(token, data);
        setState(prev => {
          const pomodoroEntry = response.pomodoro;
          return {
            ...prev,
            tasks: data.taskId
              ? prev.tasks.map(task =>
                  task.id === data.taskId
                    ? {
                        ...task,
                        pomodoros: (task.pomodoros ?? 0) + 1,
                        updatedAt: start.toISOString(),
                      }
                    : task
                )
              : prev.tasks,
            pomodoros: [pomodoroEntry, ...prev.pomodoros],
          };
        });
        toast.success('Sessão Pomodoro registrada');
        await refreshGamification();
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao registrar Pomodoro', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => {
            const pomodoroEntry: PomodoroSession = {
              id: generateId(),
              taskId: data.taskId,
              startedAt: start.toISOString(),
              endedAt: end.toISOString(),
              durationMinutes: data.durationMinutes,
            };
            const nextTasks = data.taskId
              ? prev.tasks.map(task =>
                  task.id === data.taskId
                    ? {
                        ...task,
                        pomodoros: (task.pomodoros ?? 0) + 1,
                        updatedAt: start.toISOString(),
                      }
                    : task
                )
              : prev.tasks;
            return {
              ...prev,
              tasks: nextTasks,
              pomodoros: [pomodoroEntry, ...prev.pomodoros],
            };
          });
          toast.success('Pomodoro registrado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível registrar a sessão Pomodoro');
      }
    },
    [getRemoteToken, isGuestMode, refreshGamification, scheduleBackgroundSync, updateGuestState, user]
  );

  const value = useMemo<TaskContextValue>(
    () => ({
      ...state,
      loading,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskStatus,
      logPomodoro,
    }),
    [state, loading, addTask, updateTask, deleteTask, toggleTaskStatus, logPomodoro]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

function useTasks() {
  const context = useContext(TaskContext);

  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }

  return context;
}

export { TaskProvider, useTasks };
