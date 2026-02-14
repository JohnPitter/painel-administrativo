import { useMemo } from 'react';

import { useTasks } from '../context/TaskContext';
import styles from './TaskGamificationPanel.module.css';

const levelThreshold = (level: number) => (level - 1) * 100;

const TaskGamificationPanel = () => {
  const { gamification, tasks, pomodoros } = useTasks();

  const completedPercent = useMemo(() => {
    const total = tasks.length || 1;
    const completed = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completed / total) * 100);
  }, [tasks]);

  const pomodoroMinutes = useMemo(
    () => pomodoros.reduce((acc, session) => acc + session.durationMinutes, 0),
    [pomodoros]
  );

  const nextLevelPoints = levelThreshold(gamification.level + 1);
  const currentLevelPoints = levelThreshold(gamification.level);
  const progress = Math.min(
    100,
    Math.round(
      ((gamification.totalPoints - currentLevelPoints) /
        Math.max(1, nextLevelPoints - currentLevelPoints)) *
        100
    )
  );

  return (
    <section className={styles.wrapper}>
      <header>
        <h2>Painel de gamificação</h2>
        <p>Ganhe pontos concluindo tarefas e registrando sessões Pomodoro.</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Nível atual</span>
          <strong className={styles.value}>{gamification.level}</strong>
          <div className={styles.progressBar}>
            <div className={styles.progress} style={{ width: `${progress}%` }} />
          </div>
          <small>{progress}% do próximo nível</small>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>Pontuação total</span>
          <strong className={styles.value}>{gamification.totalPoints}</strong>
          <small>{pomodoroMinutes} minutos em Pomodoro</small>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>Streak de conclusão</span>
          <strong className={styles.value}>{gamification.streak} dias</strong>
          <small>
            {gamification.lastCompletedAt
              ? `Última tarefa: ${new Date(gamification.lastCompletedAt).toLocaleDateString('pt-BR')}`
              : 'Aguardando primeira conclusão'}
          </small>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>Conclusão mensal</span>
          <strong className={styles.value}>{completedPercent}%</strong>
          <small>Percentual das tarefas concluídas neste período</small>
        </div>
      </div>

      <aside className={styles.tips}>
        <h3>Dicas para subir de nível</h3>
        <ul>
          <li>Conclua tarefas dentro do prazo para manter sua sequência ativa.</li>
          <li>Use Pomodoro para focar: cada 25 minutos conclui +2 pontos.</li>
          <li>Defina prioridades altas para visualizar o que merece atenção.</li>
        </ul>
      </aside>
    </section>
  );
};

export { TaskGamificationPanel };
