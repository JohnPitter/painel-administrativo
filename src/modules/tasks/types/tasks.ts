export type TaskStatus = 'open' | 'in_progress' | 'completed';
export type TaskPriority = 'do_first' | 'schedule' | 'delegate' | 'eliminate';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  pomodoros?: number;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface TaskGamification {
  totalPoints: number;
  level: number;
  streak: number;
  lastCompletedAt: string | null;
}

export interface TaskState {
  tasks: Task[];
  pomodoros: PomodoroSession[];
  gamification: TaskGamification;
}

export interface TaskContextValue extends TaskState {
  loading: boolean;
  addTask: (
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'pomodoros'> & {
      status?: TaskStatus;
      pomodoros?: number;
    }
  ) => Promise<void>;
  updateTask: (id: string, data: Partial<Omit<Task, 'id'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  logPomodoro: (data: { taskId?: string; durationMinutes: number }) => Promise<void>;
}
