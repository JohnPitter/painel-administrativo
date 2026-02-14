import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@core/layout/DashboardLayout';

import { TaskProvider } from '../context/TaskContext';
import { TaskFormList } from '../components/TaskFormList';
import { TasksDashboard } from '../components/TasksDashboard';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { TaskGamificationPanel } from '../components/TaskGamificationPanel';
import styles from './TaskPage.module.css';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'list', label: 'Tarefas' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'gamification', label: 'Gamificação' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TaskPage = () => {
  return (
    <TaskProvider>
      <TaskDashboard />
    </TaskProvider>
  );
};

const TaskDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeTab) {
      case 'list':
        return <TaskFormList />;
      case 'pomodoro':
        return <PomodoroTimer />;
      case 'gamification':
        return <TaskGamificationPanel />;
      default:
        return <TasksDashboard />;
    }
  };

  return (
    <DashboardLayout
      title="Gestão de tarefas"
      subtitle="Organize prazos, acompanhe foco e monitore seu progresso."
      actions={
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/dashboard')}
        >
          ← Voltar para aplicativos
        </button>
      }
    >
      <nav className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? styles.activeTab : styles.tabButton}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={styles.content}>{renderContent()}</section>
    </DashboardLayout>
  );
};

export { TaskPage };
