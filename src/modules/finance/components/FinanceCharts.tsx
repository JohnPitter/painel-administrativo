import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

import { formatCurrency } from '@shared/utils/format';

import { useFinance } from '../context/FinanceContext';
import { matchesPeriod } from '../utils/period';
import styles from './FinanceCharts.module.css';

interface MonthlyTotals {
  monthKey: string;
  label: string;
  incomes: number;
  expenses: number;
  investments: number;
  net: number;
}

interface CategoryBreakdown {
  category: string;
  value: number;
  [key: string]: string | number;
}

const getMonthKey = (dateString: string) => {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const reference = new Date(year, (month ?? 1) - 1, 1);
  return reference.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
};

const buildMonthlyTotals = (records: ReturnType<typeof useFinance>): MonthlyTotals[] => {
  const accumulator = new Map<string, MonthlyTotals>();

  const ensureMonth = (key: string) => {
    if (!accumulator.has(key)) {
      accumulator.set(key, {
        monthKey: key,
        label: formatMonthLabel(key),
        incomes: 0,
        expenses: 0,
        investments: 0,
        net: 0,
      });
    }
    return accumulator.get(key)!;
  };

  records.incomes.forEach(income => {
    if (income.excludeFromTotals) {
      return;
    }
    const key = getMonthKey(income.date);
    if (!key) {
      return;
    }
    const bucket = ensureMonth(key);
    bucket.incomes += income.amount;
  });

  records.expenses.forEach(expense => {
    if (expense.excludeFromTotals) {
      return;
    }
    const key = getMonthKey(expense.date);
    if (!key) {
      return;
    }
    const bucket = ensureMonth(key);
    bucket.expenses += expense.amount;
  });

  records.investments.forEach(investment => {
    const key = getMonthKey(investment.date);
    if (!key) {
      return;
    }
    const bucket = ensureMonth(key);
    bucket.investments += investment.amount;
  });

  accumulator.forEach(bucket => {
    bucket.net = bucket.incomes - bucket.expenses;
  });

  return Array.from(accumulator.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
};

const parseMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return { year, month };
};

const buildCategoryBreakdown = (
  records: ReturnType<typeof useFinance>,
  monthKey: string | null
): CategoryBreakdown[] => {
  if (!monthKey) {
    return [];
  }

  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return [];
  }

  const { year, month } = parsed;
  const accumulator = new Map<string, number>();

  const addValue = (category: string, amount: number) => {
    const key = category || 'Sem categoria';
    accumulator.set(key, (accumulator.get(key) ?? 0) + amount);
  };

  records.expenses.forEach(expense => {
    if (expense.excludeFromTotals) {
      return;
    }
    if (matchesPeriod(expense.date, year, month)) {
      addValue(expense.category, expense.amount);
    }
  });

  const data: CategoryBreakdown[] = Array.from(accumulator.entries())
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  return data;
};

const CATEGORY_COLORS = ['#002776', '#00923f', '#ffd500', '#d93025', '#00b4d8', '#ff9f1c', '#6a4c93'];

const currencyTick = (value: number) => formatCurrency(value).replace('R$', 'R$ ');

const FinanceCharts = () => {
  const finance = useFinance();

  const monthlyData = useMemo(() => buildMonthlyTotals(finance), [finance]);
  const [categoryMonthKey, setCategoryMonthKey] = useState<string | null>(null);

  useEffect(() => {
    if (monthlyData.length === 0) {
      setCategoryMonthKey(null);
      return;
    }

    setCategoryMonthKey(previous => {
      if (previous && monthlyData.some(item => item.monthKey === previous)) {
        return previous;
      }
      return monthlyData[monthlyData.length - 1].monthKey;
    });
  }, [monthlyData]);

  const categoryData = useMemo<CategoryBreakdown[]>(
    () => buildCategoryBreakdown(finance, categoryMonthKey),
    [finance, categoryMonthKey]
  );

  const categoryOptions = useMemo(
    () => monthlyData.map(item => ({ value: item.monthKey, label: item.label })),
    [monthlyData]
  );

  const categoryPeriodLabel =
    categoryOptions.find(option => option.value === categoryMonthKey)?.label ?? '';
  const totalCategoryValue = useMemo(
    () => categoryData.reduce((accumulator, entry) => accumulator + entry.value, 0),
    [categoryData]
  );

  if (monthlyData.length === 0) {
    return (
      <div className={styles.emptyState}>
        Registre receitas, gastos ou investimentos para visualizar a evolução mensal.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <article className={styles.chartCard}>
        <header>
          <h3>Fluxo de caixa mensal</h3>
          <p>Comparativo das entradas, saídas e saldo mês a mês.</p>
        </header>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 39, 118, 0.12)" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={currencyTick} width={100} />
              <Tooltip
                formatter={value => formatCurrency(Number(value))}
                labelFormatter={value => `Mês: ${value}`}
              />
              <Legend />
              <Line
                dataKey="incomes"
                type="monotone"
                stroke="#00923f"
                strokeWidth={2}
                dot={false}
                name="Receitas"
              />
              <Line
                dataKey="expenses"
                type="monotone"
                stroke="#d93025"
                strokeWidth={2}
                dot={false}
                name="Gastos"
              />
              <Line
                dataKey="net"
                type="monotone"
                stroke="#002776"
                strokeWidth={2}
                dot={false}
                name="Saldo"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className={styles.chartCard}>
        <header>
          <h3>Evolução dos investimentos</h3>
          <p>Total aplicado em cada mês.</p>
        </header>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 146, 63, 0.18)" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={currencyTick} width={100} />
              <Tooltip
                formatter={value => formatCurrency(Number(value))}
                labelFormatter={value => `Mês: ${value}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="investments"
                stroke="#002776"
                fill="rgba(0, 39, 118, 0.35)"
                name="Investimentos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className={styles.chartCard}>
        <header className={styles.chartHeader}>
          <div>
            <h3>Gastos por categoria</h3>
            <p>Distribuição das despesas no período selecionado.</p>
          </div>
          <select
            className={styles.chartSelect}
            value={categoryMonthKey ?? ''}
            onChange={event => setCategoryMonthKey(event.target.value)}
          >
            {categoryOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </header>

        <div className={`${styles.chart} ${styles.categoryChartWrapper}`}>
          {categoryData.length === 0 ? (
            <div className={styles.chartEmpty}>
              Sem dados de gastos para o período selecionado.
            </div>
          ) : (
            <div className={styles.categoryBreakdown}>
              <div className={styles.categoryChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={value => formatCurrency(Number(value))} />
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      labelLine={false}
                      label={(props: PieLabelRenderProps) => {
                        const value = Number(props.value ?? 0);
                        const percentage = totalCategoryValue
                          ? ((value / totalCategoryValue) * 100).toFixed(1)
                          : '0.0';
                        return `${percentage}%`;
                      }}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className={styles.categoryList}>
                {categoryData.map((entry, index) => {
                  const percentage = totalCategoryValue
                    ? ((entry.value / totalCategoryValue) * 100).toFixed(1)
                    : '0.0';
                  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  return (
                    <li key={entry.category} className={styles.categoryListItem}>
                      <span className={styles.categoryColor} style={{ backgroundColor: color }} />
                      <div>
                        <strong>{entry.category}</strong>
                        <p>
                          {formatCurrency(entry.value)} · {percentage}%
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {categoryPeriodLabel && categoryData.length > 0 && (
          <footer className={styles.chartFooter}>
            Analisando {categoryData.length} categoria(s) em {categoryPeriodLabel}.
          </footer>
        )}
      </article>
    </div>
  );
};

export { FinanceCharts };
