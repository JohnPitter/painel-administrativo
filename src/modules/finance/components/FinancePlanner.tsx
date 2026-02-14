import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import { formatCurrency } from '@shared/utils/format';

import { useFinance } from '../context/FinanceContext';
import { getPlanner, savePlanner } from '../services/financeService';
import type { PlannerAllocations, PlannerGoal, PlannerSavePayload } from '../types/planner';
import {
  formatPeriodLabel,
  getAvailableYears,
  getCurrentMonth,
  getCurrentYear,
  matchesPeriod,
  MONTH_OPTIONS,
} from '../utils/period';
import styles from './FinancePlanner.module.css';

type AllocationState = PlannerAllocations;

const createGoalId = () => Math.random().toString(36).slice(2, 9);

type CategoryGroup = 'essentials' | 'lifestyle' | 'savings' | 'other';

const PRESET_KEYWORDS: Record<CategoryGroup, string[]> = {
  essentials: ['moradia', 'aluguel', 'condo', 'conta', 'energia', 'agua', 'aliment', 'mercado', 'transporte', 'saude'],
  lifestyle: ['lazer', 'assin', 'stream', 'educa', 'curso', 'viagem'],
  savings: ['invest', 'poup', 'reserva', 'fundo', 'aposent'],
  other: [],
};
const MAJOR_GROUPS: Array<Exclude<CategoryGroup, 'other'>> = ['essentials', 'lifestyle', 'savings'];
const STORAGE_PREFIX = 'finance_planner_state';
const DEFAULT_GOALS: PlannerGoal[] = [
  { id: createGoalId(), label: 'Reserva de emergência', amount: 3000, monthlyReserve: 250 },
];

const PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  distribution: Partial<Record<Exclude<CategoryGroup, 'other'>, number>>;
}> = [
  {
    id: 'balanced',
    label: 'Regra 50 • 30 • 20',
    description: '50% essenciais, 30% estilo de vida, 20% poupança',
    distribution: { essentials: 50, lifestyle: 30, savings: 20 },
  },
  {
    id: 'essentialsHeavy',
    label: 'Essenciais 70%',
    description: 'Prioriza compromissos fixos e reduz lazer',
    distribution: { essentials: 70, lifestyle: 20, savings: 10 },
  },
  {
    id: 'aggressiveSavings',
    label: 'Poupança agressiva',
    description: 'Foco em objetivos futuros (40% poupança)',
    distribution: { essentials: 40, lifestyle: 20, savings: 40 },
  },
];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const detectCategoryGroup = (category: string): CategoryGroup => {
  const normalized = normalize(category);
  const match = (group: CategoryGroup) =>
    PRESET_KEYWORDS[group].some(keyword => normalized.includes(keyword));
  if (match('essentials')) {
    return 'essentials';
  }
  if (match('lifestyle')) {
    return 'lifestyle';
  }
  if (match('savings')) {
    return 'savings';
  }
  return 'other';
};

const createInitialAllocations = (categories: string[]): AllocationState => {
  if (categories.length === 0) {
    return {};
  }

  const equalShare = Number((100 / categories.length).toFixed(2));
  const lastShare = 100 - equalShare * (categories.length - 1);

  return categories.reduce<AllocationState>((accumulator, category, index) => {
    accumulator[category] = index === categories.length - 1 ? lastShare : equalShare;
    return accumulator;
  }, {});
};

const getStorageKey = (year: number, month: number) =>
  `${STORAGE_PREFIX}_${year}-${String(month).padStart(2, '0')}`;

const FinancePlanner = () => {
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const { incomes, expenses, categories } = useFinance();

  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const yearOptions = useMemo(() => {
    const dates = [...incomes, ...expenses].map(entry => entry.date);
    return getAvailableYears(dates);
  }, [incomes, expenses]);

  const filteredIncomes = useMemo(
    () => incomes.filter(income => matchesPeriod(income.date, selectedYear, selectedMonth)),
    [incomes, selectedYear, selectedMonth]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => matchesPeriod(expense.date, selectedYear, selectedMonth)),
    [expenses, selectedYear, selectedMonth]
  );

  const totalIncome = useMemo(
    () => filteredIncomes.reduce((accumulator, income) => accumulator + income.amount, 0),
    [filteredIncomes]
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((accumulator, expense) => accumulator + expense.amount, 0),
    [filteredExpenses]
  );

  const initialAllocations = useMemo(
    () => createInitialAllocations(categories.expenses),
    [categories.expenses]
  );

  const [planningIncome, setPlanningIncome] = useState(() => Number(totalIncome.toFixed(2)));
  const [allocations, setAllocations] = useState<AllocationState>(initialAllocations);
  const [goals, setGoals] = useState<PlannerGoal[]>(DEFAULT_GOALS);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [goalForm, setGoalForm] = useState({ label: '', amount: 0, monthlyReserve: 0 });
  const remoteSaveTimeout = useRef<number | null>(null);

  useEffect(() => {
    setPlanningIncome(Number(totalIncome.toFixed(2)));
  }, [totalIncome]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const key = getStorageKey(selectedYear, selectedMonth);
    const applyLocalSnapshot = () => {
      try {
        const storedRaw = window.localStorage.getItem(key);
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw) as Partial<{
            allocations: AllocationState;
            goals: PlannerGoal[];
          }> | null;
          if (parsed?.allocations) {
            setAllocations(
              normalizeAllocations({
                ...initialAllocations,
                ...parsed.allocations,
              })
            );
          } else {
            setAllocations(initialAllocations);
          }
          if (parsed?.goals && Array.isArray(parsed.goals)) {
            setGoals(parsed.goals);
          } else {
            setGoals(DEFAULT_GOALS);
          }
        } else {
          setAllocations(initialAllocations);
          setGoals(DEFAULT_GOALS);
        }
      } catch (error) {
        console.warn('[planner] Falha ao ler dados locais', error);
        setAllocations(initialAllocations);
        setGoals(DEFAULT_GOALS);
      }
      setHasLoadedStorage(true);
    };

    setHasLoadedStorage(false);

    if (isGuestMode || !user) {
      applyLocalSnapshot();
      return;
    }

    let active = true;

    const fetchRemotePlanner = async () => {
      try {
        const token = await user.getIdToken();
        const response = await getPlanner(token, {
          year: selectedYear,
          month: selectedMonth,
        });
        if (!active) {
          return;
        }
        const nextAllocations = response?.allocations
          ? normalizeAllocations({
              ...initialAllocations,
              ...response.allocations,
            })
          : initialAllocations;
        const nextGoals =
          response?.goals && response.goals.length > 0 ? response.goals : DEFAULT_GOALS;
        setAllocations(nextAllocations);
        setGoals(nextGoals);
        try {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              allocations: nextAllocations,
              goals: nextGoals,
            })
          );
        } catch (error) {
          console.warn('[planner] Falha ao salvar dados locais', error);
        }
        setHasLoadedStorage(true);
      } catch (error) {
        console.error('[planner] Falha ao carregar dados do usuário', error);
        if (active) {
          applyLocalSnapshot();
        }
      }
    };

    void fetchRemotePlanner();

    return () => {
      active = false;
    };
  }, [initialAllocations, isGuestMode, selectedMonth, selectedYear, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLoadedStorage) {
      return;
    }
    const key = getStorageKey(selectedYear, selectedMonth);
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          allocations,
          goals,
        })
      );
    } catch (error) {
      console.warn('[planner] Falha ao salvar dados locais', error);
    }

    if (isGuestMode || !user) {
      return;
    }

    const payload: PlannerSavePayload = {
      year: selectedYear,
      month: selectedMonth,
      allocations,
      goals,
    };

    if (remoteSaveTimeout.current && typeof window !== 'undefined') {
      window.clearTimeout(remoteSaveTimeout.current);
    }

    remoteSaveTimeout.current =
      typeof window === 'undefined'
        ? null
        : window.setTimeout(async () => {
            try {
              const token = await user.getIdToken();
              await savePlanner(token, payload);
            } catch (error) {
              console.error('[planner] Falha ao salvar dados do usuário', error);
            }
          }, 800);
  }, [
    allocations,
    goals,
    hasLoadedStorage,
    isGuestMode,
    selectedMonth,
    selectedYear,
    user,
  ]);

  useEffect(() => {
    return () => {
      if (remoteSaveTimeout.current && typeof window !== 'undefined') {
        window.clearTimeout(remoteSaveTimeout.current);
      }
    };
  }, []);

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((sum, value) => sum + value, 0),
    [allocations]
  );

  const plannedExpenses = useMemo(
    () =>
      Object.entries(allocations).reduce(
        (sum, [, percentage]) => sum + (planningIncome * percentage) / 100,
        0
      ),
    [allocations, planningIncome]
  );

  const periodLabel = formatPeriodLabel(selectedMonth, selectedYear);

  const expensesByCategory = useMemo(() => {
    return filteredExpenses.reduce<Record<string, number>>((accumulator, expense) => {
      accumulator[expense.category] = (accumulator[expense.category] ?? 0) + expense.amount;
      return accumulator;
    }, {});
  }, [filteredExpenses]);

  const categoryComparisons = useMemo(() => {
    return categories.expenses.map(category => {
      const percentage = allocations[category] ?? 0;
      const plannedValue = (planningIncome * percentage) / 100;
      const actualValue = expensesByCategory[category] ?? 0;
      const diff = actualValue - plannedValue;
      return { category, percentage, plannedValue, actualValue, diff };
    });
  }, [allocations, categories.expenses, planningIncome, expensesByCategory]);

  const totalMonthlyGoals = useMemo(
    () => goals.reduce((sum, goal) => sum + Math.max(0, goal.monthlyReserve), 0),
    [goals]
  );

  const adjustAllocation = (category: string, value: number) => {
    setAllocations(prev => ({
      ...prev,
      [category]: Math.max(0, Math.min(100, value)),
    }));
  };

  const resetAllocations = () => {
    setAllocations(initialAllocations);
  };

  const handleGoalFormChange = (field: keyof typeof goalForm, value: string | number) => {
    setGoalForm(prev => ({
      ...prev,
      [field]: field === 'label' ? String(value) : Number(value) || 0,
    }));
  };

  const handleAddGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!goalForm.label.trim() || goalForm.amount <= 0 || goalForm.monthlyReserve <= 0) {
      return;
    }
    setGoals(prev => [
      ...prev,
      {
        id: createGoalId(),
        label: goalForm.label.trim(),
        amount: goalForm.amount,
        monthlyReserve: goalForm.monthlyReserve,
      },
    ]);
    setGoalForm({ label: '', amount: 0, monthlyReserve: 0 });
  };

  const handleRemoveGoal = (id: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== id));
  };

  const normalizeAllocations = (next: AllocationState) => {
    const total = Object.values(next).reduce((sum, value) => sum + value, 0);
    if (total === 100 || categories.expenses.length === 0) {
      return next;
    }
    const diff = 100 - total;
    const fallbackCategory = categories.expenses.find(name => next[name] !== undefined);
    if (fallbackCategory) {
      next[fallbackCategory] = Number((next[fallbackCategory] + diff).toFixed(2));
    }
    return next;
  };

  const handlePresetSelection = (preset: (typeof PRESETS)[number]) => {
    if (categories.expenses.length === 0) {
      return;
    }
    const grouped: Record<CategoryGroup, string[]> = {
      essentials: [],
      lifestyle: [],
      savings: [],
      other: [],
    };
    categories.expenses.forEach(category => {
      const group = detectCategoryGroup(category);
      grouped[group].push(category);
    });

    const next: AllocationState = {};
    const assignShare = (group: CategoryGroup, percentage: number) => {
      const targets = grouped[group];
      if (targets.length === 0 || percentage <= 0) {
        return;
      }
      const share = Number((percentage / targets.length).toFixed(2));
      targets.forEach(category => {
        next[category] = share;
      });
    };

    MAJOR_GROUPS.forEach(group => {
      assignShare(group, preset.distribution[group] ?? 0);
    });

    const assigned = Object.keys(next);
    const remainingCategories = categories.expenses.filter(category => !assigned.includes(category));
    const remainingShare = Math.max(
      0,
      100 -
        Object.values(next).reduce((sum, value) => sum + value, 0)
    );
    if (remainingCategories.length > 0) {
      const share = Number((remainingShare / remainingCategories.length).toFixed(2));
      remainingCategories.forEach(category => {
        next[category] = share;
      });
    }

    setAllocations(normalizeAllocations({ ...next }));
  };

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h2>Planner financeiro</h2>
          <p>
            Defina metas, distribua percentuais por categoria e visualize o quanto precisa
            guardar a cada mês para atingir seus objetivos.
          </p>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <div className={styles.filter}>
              <label htmlFor="planner-year">Ano</label>
              <select
                id="planner-year"
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
            <div className={styles.filter}>
              <label htmlFor="planner-month">Mês</label>
              <select
                id="planner-month"
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
          <span className={styles.periodBadge}>Exibindo {periodLabel}</span>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>Receitas registradas</span>
            <strong>{formatCurrency(totalIncome)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Gastos registrados</span>
            <strong>{formatCurrency(totalExpenses)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Saldo atual</span>
            <strong>{formatCurrency(totalIncome - totalExpenses)}</strong>
          </div>
        </div>

      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h3>Simulação de metas</h3>
          <p>Registre objetivos simultâneos para calcular o esforço mensal planejado.</p>

          <form className={styles.goalForm} onSubmit={handleAddGoal}>
            <div className={styles.goalFormFields}>
              <label>
                <span>Descrição da meta</span>
                <input
                  type="text"
                  placeholder="Ex.: Reserva de emergência"
                  value={goalForm.label}
                  onChange={event => handleGoalFormChange('label', event.target.value)}
                />
              </label>
              <label>
                <span>Valor total (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex.: 10.000"
                  value={goalForm.amount}
                  onChange={event => handleGoalFormChange('amount', Number(event.target.value) || 0)}
                />
              </label>
              <label>
                <span>Reserva mensal (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex.: 1.000"
                  value={goalForm.monthlyReserve}
                  onChange={event =>
                    handleGoalFormChange('monthlyReserve', Number(event.target.value) || 0)
                  }
                />
              </label>
            </div>
            <button type="submit" className={styles.addGoalButton}>
              Adicionar meta
            </button>
          </form>

          {goals.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhuma meta registrada. Adicione objetivos para calcular reservas mensais.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Meta</th>
                    <th>Valor</th>
                    <th>Reserva mensal</th>
                    <th>Previsão de conclusão</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map(goal => {
                    const monthsNeeded =
                      goal.monthlyReserve > 0 ? Math.ceil(goal.amount / goal.monthlyReserve) : null;
                    return (
                      <tr key={goal.id}>
                        <td>{goal.label}</td>
                        <td>{formatCurrency(goal.amount)}</td>
                        <td>{formatCurrency(goal.monthlyReserve)}</td>
                        <td>{monthsNeeded ? `${monthsNeeded} meses` : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.removeGoalButton}
                            onClick={() => handleRemoveGoal(goal.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Distribuição planejada por categoria</h3>
              <p>
                Ajuste os percentuais do orçamento mensal para cada categoria de gasto. A soma
                ideal deve chegar a 100%.
              </p>
            </div>
            <button
              type="button"
              className={styles.resetButton}
              onClick={resetAllocations}
            >
              Redefinir percentuais
            </button>
          </div>

          {categories.expenses.length === 0 ? (
            <div className={styles.emptyState}>
              Cadastre categorias em &ldquo;Configurações&rdquo; para montar o planejamento.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Percentual</th>
                    <th>Valor planejado</th>
                    <th>Gasto atual</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryComparisons.map(entry => {
                    const diff = entry.diff;
                    const diffClass =
                      diff === 0
                        ? undefined
                        : diff > 0
                        ? styles.diffPositive
                        : styles.diffNegative;
                    return (
                      <tr key={entry.category}>
                        <td>{entry.category}</td>
                        <td>
                          <div className={styles.inputWithSuffix}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={entry.percentage}
                              onChange={event =>
                                adjustAllocation(entry.category, Number(event.target.value) || 0)
                              }
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td>{formatCurrency(entry.plannedValue)}</td>
                        <td>{formatCurrency(entry.actualValue)}</td>
                        <td className={diffClass}>
                          {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className={styles.tableFooter}>
            <span>
              Total distribuído:{' '}
              <strong className={totalAllocated > 100 ? styles.negative : ''}>
                {totalAllocated.toFixed(2)}%
              </strong>
            </span>
          </footer>
        </article>
      </section>

      <section className={styles.card}>
        <h3>Sugestões inteligentes</h3>
        <p>Aplicar um modelo ajuda a reajustar rapidamente os percentuais do orçamento.</p>
        <div className={styles.presetGrid}>
          {PRESETS.map(preset => (
            <button
              type="button"
              key={preset.id}
              className={styles.presetButton}
              onClick={() => handlePresetSelection(preset)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
};

export { FinancePlanner };
