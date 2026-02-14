import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@core/layout/DashboardLayout';

import { FinanceProvider, useFinance } from '../context/FinanceContext';
import { ExpenseForm } from '../components/ExpenseForm';
import { FinanceAssistantWidget } from '../components/FinanceAssistantWidget';
import { FinanceCharts } from '../components/FinanceCharts';
import { FinanceSummary } from '../components/FinanceSummary';
import { IncomeForm } from '../components/IncomeForm';
import { InvestmentForm } from '../components/InvestmentForm';
import { InvestmentSimulator } from '../components/InvestmentSimulator';
import { FinanceSettings } from '../components/FinanceSettings';
import { FinancePlanner } from '../components/FinancePlanner';
import styles from './FinancePage.module.css';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'expenses', label: 'Gastos' },
  { id: 'incomes', label: 'Receitas' },
  { id: 'investments', label: 'Investimentos' },
  { id: 'planner', label: 'Planner' },
  { id: 'settings', label: 'Configurações' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const FinancePage = () => {
  return (
    <FinanceProvider>
      <FinanceDashboard />
    </FinanceProvider>
  );
};

const FinanceDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const navigate = useNavigate();
  const { loading } = useFinance();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'expenses':
        return <ExpenseForm />;
      case 'incomes':
        return <IncomeForm />;
      case 'investments':
        return (
          <div className={styles.investmentsArea}>
            <InvestmentForm />
            <InvestmentSimulator />
          </div>
        );
      case 'planner':
        return <FinancePlanner />;
      case 'settings':
        return <FinanceSettings />;
      default:
        return (
          <div className={styles.overview}>
            <FinanceSummary />
            <FinanceCharts />
            <div className={styles.helperCard}>
              <h2>Como usar</h2>
              <p>
                Utilize as abas acima para cadastrar gastos, receitas e investimentos recorrentes.
                Planeje metas financeiras no &ldquo;Planner&rdquo; e acompanhe como cada categoria
                contribui para os objetivos. As informações atualizam os gráficos e o saldo projetado
                automaticamente. Gerencie categorias personalizadas na aba "Configurações".
              </p>
              <ul>
                <li>Cadastre receitas para acompanhar o fluxo de caixa.</li>
                <li>Registre gastos e associe uma categoria para análises.</li>
                <li>Controle investimentos e rendimentos esperados.</li>
                <li>Defina metas e distribuições personalizadas de orçamento.</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      title="Finanças Pessoais"
      subtitle="Monitore fluxos de caixa e investimentos em um só lugar."
      actions={
        <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
          ← Voltar para aplicativos
        </button>
      }
    >
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p>Carregando seus dados financeiros...</p>
          <span>Estamos sincronizando registros e configurações.</span>
        </div>
      ) : (
        <>
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

          <section className={styles.content}>{renderTabContent()}</section>
        </>
      )}
      <FinanceAssistantWidget />
    </DashboardLayout>
  );
};

export { FinancePage };
