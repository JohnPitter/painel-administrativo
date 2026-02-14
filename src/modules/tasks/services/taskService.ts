import { apiRequest } from '@shared/services/apiClient';

import type { PomodoroSession, Task, TaskGamification } from '../types/tasks';

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const listTasks = async (token: string) =>
  apiRequest<{ tasks: Task[] }>('/tasks', {
    method: 'GET',
    headers: authHeaders(token),
  });

const createTask = async (
  token: string,
  payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
) =>
  apiRequest<{ task: Task }>('/tasks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateTask = async (
  token: string,
  id: string,
  payload: Partial<Omit<Task, 'id'>>
) =>
  apiRequest<{ id: string } & Partial<Task>>(`/tasks/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

const updateTaskStatus = async (token: string, id: string, status: Task['status']) =>
  apiRequest<{ id: string; status: Task['status']; updatedAt: string }>(`/tasks/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });

const deleteTask = (token: string, id: string) =>
  apiRequest<void>(`/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const listPomodoros = (token: string) =>
  apiRequest<{ pomodoros: PomodoroSession[] }>('/tasks/pomodoros', {
    method: 'GET',
    headers: authHeaders(token),
  });

const logPomodoro = (
  token: string,
  payload: { taskId?: string; durationMinutes: number }
) =>
  apiRequest<{ pomodoro: PomodoroSession }>(
    '/tasks/pomodoros',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );

const getGamification = (token: string) =>
  apiRequest<{ gamification: TaskGamification }>('/tasks/gamification', {
    method: 'GET',
    headers: authHeaders(token),
  });

export {
  createTask,
  deleteTask,
  getGamification,
  listPomodoros,
  listTasks,
  logPomodoro,
  updateTask,
  updateTaskStatus,
};
