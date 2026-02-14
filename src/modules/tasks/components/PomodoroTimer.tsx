import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTasks } from '../context/TaskContext';
import styles from './PomodoroTimer.module.css';

const DURATIONS = [15, 25, 45];

const PomodoroTimer = () => {
  const { tasks, logPomodoro } = useTasks();
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [duration, setDuration] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(duration * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSecondsLeft(duration * 60);
  }, [duration]);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextConstructor) {
        console.warn('API de áudio não disponível para o alerta de pomodoro');
        return null;
      }

      try {
        audioContextRef.current = new AudioContextConstructor();
      } catch (error) {
        console.error('Erro ao iniciar contexto de áudio do pomodoro', error);
        return null;
      }
    }

    const context = audioContextRef.current;

    if (!context) {
      return null;
    }

    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (error) {
        console.error('Erro ao retomar contexto de áudio do pomodoro', error);
        return null;
      }
    }

    return context;
  }, []);

  const playCompletionSound = useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) {
      return;
    }

    try {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(988, now + 0.35);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 1.25);
    } catch (error) {
      console.error('Erro ao reproduzir alerta sonoro do pomodoro', error);
    }
  }, [ensureAudioContext]);

  const handleComplete = useCallback(async () => {
    setIsRunning(false);
    void playCompletionSound();
    await logPomodoro({
      taskId: selectedTask || undefined,
      durationMinutes: duration,
    });
    setSecondsLeft(duration * 60);
  }, [duration, logPomodoro, playCompletionSound, selectedTask]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          void handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [handleComplete, isRunning]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, []);

  const handleStart = useCallback(async () => {
    if (isRunning) {
      return;
    }
    await ensureAudioContext();
    setSecondsLeft(duration * 60);
    setIsRunning(true);
  }, [duration, ensureAudioContext, isRunning]);

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(duration * 60);
  };

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (secondsLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [secondsLeft]);

  return (
    <section className={styles.wrapper}>
      <header>
        <h2>Pomodoro focado</h2>
        <p>Escolha um foco, defina a duração e registre sessões automaticamente.</p>
      </header>

      <div className={styles.cards}>
        <div className={styles.timerCard}>
          <div className={styles.display}>{formattedTime}</div>
          <div className={styles.controls}>
            <button type="button" onClick={() => void handleStart()} disabled={isRunning}>
              Iniciar
            </button>
            <button type="button" onClick={handlePause} disabled={!isRunning}>
              Pausar
            </button>
            <button type="button" onClick={handleReset}>
              Reiniciar
            </button>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <label>Duração</label>
          <div className={styles.durationGroup}>
            {DURATIONS.map(option => (
              <button
                key={option}
                type="button"
                className={option === duration ? styles.durationActive : undefined}
                onClick={() => {
                  setDuration(option);
                  setSecondsLeft(option * 60);
                }}
                disabled={isRunning}
              >
                {option} min
              </button>
            ))}
          </div>

          <label htmlFor="pomodoro-task">Tarefa vinculada</label>
          <select
            id="pomodoro-task"
            value={selectedTask}
            onChange={event => setSelectedTask(event.target.value)}
            disabled={isRunning}
          >
            <option value="">Sem tarefa</option>
            {tasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          <p className={styles.hint}>
            Ao concluir a contagem, a sessão é registrada e soma pontos na gamificação.
          </p>
        </div>
      </div>
    </section>
  );
};

export { PomodoroTimer };
