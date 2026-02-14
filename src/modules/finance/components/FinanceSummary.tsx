import { useMemo, useState } from 'react';

import { MetricCard } from '@shared/components/MetricCard';
import { formatCurrency } from '@shared/utils/format';

import { useFinance } from '../context/FinanceContext';
import {
  formatPeriodLabel,
  getAvailableYears,
  getCurrentMonth,
  getCurrentYear,
  matchesPeriod,
  MONTH_OPTIONS,
} from '../utils/period';
import styles from './FinanceSummary.module.css';

const FinanceSummary = () => {
  const { expenses, incomes, investments } = useFinance();
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const yearOptions = useMemo(() => {
    const dates = [...expenses, ...incomes, ...investments].map(entry => entry.date);
    return getAvailableYears(dates);
  }, [expenses, incomes, investments]);

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => matchesPeriod(expense.date, selectedYear, selectedMonth)),
    [expenses, selectedYear, selectedMonth]
  );

  const filteredIncomes = useMemo(
    () => incomes.filter(income => matchesPeriod(income.date, selectedYear, selectedMonth)),
    [incomes, selectedYear, selectedMonth]
  );

  const filteredInvestments = useMemo(
    () =>
      investments.filter(investment =>
        matchesPeriod(investment.date, selectedYear, selectedMonth)
      ),
    [investments, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => {
    const computeTotals = (items: { amount: number; excludeFromTotals?: boolean }[]) =>
      items.reduce(
        (acc, item) => {
          if (item.excludeFromTotals) {
            return {
              ...acc,
              excludedAmount: acc.excludedAmount + item.amount,
              excludedCount: acc.excludedCount + 1,
            };
          }
          return {
            ...acc,
            includedAmount: acc.includedAmount + item.amount,
          };
        },
        { includedAmount: 0, excludedAmount: 0, excludedCount: 0 }
      );

    const incomeTotals = computeTotals(filteredIncomes);
    const expenseTotals = computeTotals(filteredExpenses);
    const investmentTotals = computeTotals(filteredInvestments);

    return {
      totalIncomes: incomeTotals.includedAmount,
      totalExpenses: expenseTotals.includedAmount,
      totalInvestments: investmentTotals.includedAmount,
      netBalance: incomeTotals.includedAmount - expenseTotals.includedAmount,
      excluded: {
        incomes: incomeTotals.excludedAmount,
        expenses: expenseTotals.excludedAmount,
      },
      excludedCounts: {
        incomes: incomeTotals.excludedCount,
        expenses: expenseTotals.excludedCount,
      },
    };
  }, [filteredExpenses, filteredIncomes, filteredInvestments]);

  const periodLabel = formatPeriodLabel(selectedMonth, selectedYear);

  return (
    <section className={styles.container}>
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <div className={styles.filter}>
            <label htmlFor="summary-year">Ano</label>
            <select
              id="summary-year"
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
            <label htmlFor="summary-month">Mês</label>
            <select
              id="summary-month"
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
        <span className={styles.periodBadge}>Período: {periodLabel}</span>
      </div>

      <div className={styles.wrapper}>
        <MetricCard
          label="Receitas"
          value={formatCurrency(totals.totalIncomes)}
          trend="positive"
          icon={<span>R$</span>}
          footnote={`${filteredIncomes.length} entradas registradas${
            totals.excludedCounts.incomes ? ` · ${totals.excludedCounts.incomes} fora do total` : ''
          }`}
        />
        <MetricCard
          label="Gastos"
          value={formatCurrency(totals.totalExpenses)}
          trend="negative"
          icon={<span>-</span>}
          footnote={`${filteredExpenses.length} saídas registradas${
            totals.excludedCounts.expenses ? ` · ${totals.excludedCounts.expenses} fora do total` : ''
          }`}
        />
        <MetricCard
          label="Investimentos"
          value={formatCurrency(totals.totalInvestments)}
          trend="neutral"
          icon={<span>I</span>}
          footnote={`${filteredInvestments.length} aplicações`}
        />
        <MetricCard
          label="Saldo projetado"
          value={formatCurrency(totals.netBalance)}
          trend={totals.netBalance >= 0 ? 'positive' : 'negative'}
          icon={<span>S</span>}
          footnote="Diferença entre receitas e gastos"
        />
      </div>

      <div className={styles.excludedTotals}>
        <strong>Não contabilizados no período</strong>
        <div className={styles.excludedValues}>
          <span>
            Receitas: <strong>{formatCurrency(totals.excluded.incomes)}</strong>
          </span>
          <span>
            Gastos: <strong>{formatCurrency(totals.excluded.expenses)}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};

export { FinanceSummary };
