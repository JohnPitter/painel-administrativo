import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@core/layout/DashboardLayout';

import { NotesProvider } from '../context/NotesContext';
import { NotesDashboard } from '../components/NotesDashboard';
import { NoteFormList } from '../components/NoteFormList';
import styles from './NotesPage.module.css';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'notes', label: 'Notas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const NotesPage = () => {
  return (
    <NotesProvider>
      <NotesWorkspace />
    </NotesProvider>
  );
};

const NotesWorkspace = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'notes':
        return <NoteFormList />;
      default:
        return <NotesDashboard />;
    }
  };

  return (
    <DashboardLayout
      title="Notas pessoais"
      subtitle="Capture ideias, listas e referências importantes em um só lugar."
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

export { NotesPage };
