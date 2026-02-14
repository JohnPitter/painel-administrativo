import { useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { formatCurrency } from '@shared/utils/format';
import { generateId } from '@shared/utils/id';

import { useFinance } from '../context/FinanceContext';
import type { Income } from '../types/finance';
import {
  formatDateDisplay,
  formatPeriodLabel,
  getAvailableYears,
  getCurrentMonth,
  getCurrentYear,
  matchesPeriod,
  MONTH_OPTIONS,
  sortByDateAndDescription,
} from '../utils/period';
import {
  formatRecurrenceProgress,
  generateRecurringDates,
  RECURRENCE_OPTIONS,
  RECURRENCE_VALUES,
} from '../utils/recurrence';
import styles from './FinanceForm.module.css';

const recurrenceSchema = z.object({
  frequency: z.enum(RECURRENCE_VALUES),
  occurrences: z.coerce
    .number({
      required_error: 'Informe o número de ocorrências',
      invalid_type_error: 'Informe valores numéricos',
    })
    .int('Informe um número inteiro')
    .min(1, 'Use pelo menos 1 ocorrência')
    .max(24, 'Limite de 24 lançamentos por recorrência'),
});

const incomeSchema = z.object({
  source: z.string().min(1, 'Informe a origem da receita'),
  description: z.string().min(1, 'Descreva a receita'),
  category: z.string().min(1, 'Informe a categoria'),
  amount: z.coerce.number().positive('Informe um valor positivo'),
  date: z.string().min(1, 'Informe a data'),
  excludeFromTotals: z.boolean().default(false),
  recurrence: recurrenceSchema,
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

const IncomeForm = () => {
  const { incomes, addIncome, updateIncome, deleteIncome, categories } = useFinance();
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [editingId, setEditingId] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => getAvailableYears(incomes.map(income => income.date)),
    [incomes]
  );

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter(income =>
      matchesPeriod(income.date, selectedYear, selectedMonth)
    );
    return sortByDateAndDescription(filtered);
  }, [incomes, selectedYear, selectedMonth]);

  const periodLabel = formatPeriodLabel(selectedMonth, selectedYear);
  const incomeTotals = useMemo(() => {
    return filteredIncomes.reduce(
      (acc, income) => {
        if (income.excludeFromTotals) {
          return {
            ...acc,
            excluded: acc.excluded + income.amount,
            excludedCount: acc.excludedCount + 1,
          };
        }
        return {
          ...acc,
          included: acc.included + income.amount,
        };
      },
      { included: 0, excluded: 0, excludedCount: 0 }
    );
  }, [filteredIncomes]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      excludeFromTotals: false,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    },
  });

  const selectedFrequency = watch('recurrence.frequency');

  const resetForm = () => {
    reset({
      source: '',
      description: '',
      category: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      excludeFromTotals: false,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const onSubmit = async (data: IncomeFormValues) => {
    const { recurrence, ...income } = data;

    if (editingId) {
      const currentIncome = incomes.find(item => item.id === editingId);
      await updateIncome(editingId, {
        ...income,
        recurrenceId: currentIncome?.recurrenceId ?? null,
        recurrenceIndex: currentIncome?.recurrenceIndex ?? null,
        recurrenceTotal: currentIncome?.recurrenceTotal ?? null,
      });
    } else {
      const schedule = generateRecurringDates(
        income.date,
        recurrence.frequency,
        recurrence.occurrences
      );

      if (schedule.length === 1) {
        await addIncome(income);
      } else {
        const recurrenceId = generateId();
        const total = schedule.length;

        for (const [index, scheduledDate] of schedule.entries()) {
          await addIncome(
            {
              ...income,
              date: scheduledDate,
              recurrenceId,
              recurrenceIndex: index + 1,
              recurrenceTotal: total,
            },
            { silent: true }
          );
        }
        toast.success(`Recorrência registrada com ${schedule.length} receitas`);
      }
    }

    resetForm();
    setEditingId(null);
  };

  const handleEdit = (income: Income) => {
    setEditingId(income.id);
    reset({
      source: income.source,
      description: income.description,
      category: income.category,
      amount: income.amount,
      date: income.date,
      excludeFromTotals: income.excludeFromTotals ?? false,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const handleDelete = async (id: string) => {
    await deleteIncome(id);
    if (editingId === id) {
      setEditingId(null);
      resetForm();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  return (
    <section id="receitas" className={styles.wrapper}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Receitas</h2>
            <p>Registre entradas para acompanhar o fluxo de caixa mensal.</p>
          </div>
          <span className={styles.periodChip}>{periodLabel}</span>
        </div>
        <div className={styles.summaryStrip}>
          <div className={styles.summaryCard}>
            <span>Receitas no período</span>
            <strong>{formatCurrency(incomeTotals.included)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Registros</span>
            <strong>{filteredIncomes.length}</strong>
          </div>
          <div className={clsx(styles.summaryCard, styles.summaryCardMuted)}>
            <span>Fora do total</span>
            <strong>{formatCurrency(incomeTotals.excluded)}</strong>
          </div>
        </div>

      <div className={styles.filters}>
        <div className={styles.filter}>
          <label htmlFor="income-year">Ano</label>
          <select
            id="income-year"
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
          <label htmlFor="income-month">Mês</label>
          <select
            id="income-month"
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

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="income-source">Origem</label>
            <input
              id="income-source"
              placeholder="Salário, freelance, rendimento..."
              {...register('source')}
            />
            {errors.source && <span className={styles.error}>{errors.source.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="income-description">Descrição</label>
            <input
              id="income-description"
              placeholder="Detalhes adicionais"
              {...register('description')}
            />
            {errors.description && (
              <span className={styles.error}>{errors.description.message}</span>
            )}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="income-category">Categoria</label>
            <select id="income-category" {...register('category')}>
              <option value="">Selecione</option>
              {categories.incomes.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
            <span className={styles.helperText}>Gerencie categorias em "Configurações".</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="income-amount">Valor</label>
            <input
              id="income-amount"
              type="number"
              step="0.01"
              min="0"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <span className={styles.error}>{errors.amount.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="income-date">Data</label>
            <input id="income-date" type="date" {...register('date')} />
            {errors.date && <span className={styles.error}>{errors.date.message}</span>}
          </div>
        </div>

        <div className={styles.recurrenceBlock}>
          <div className={styles.recurrenceHeader}>
            <strong>Programe recebimentos recorrentes</strong>
            <span>Cadastre salários, dividendos e outras entradas que se repetem automaticamente.</span>
          </div>

          {editingId ? (
            <p className={styles.recurrenceInfo}>
              Edite a receita individual. Para ajustar recorrência, crie um novo lançamento com o
              intervalo desejado.
            </p>
          ) : (
            <>
              <div className={styles.recurrenceOptions}>
                {RECURRENCE_OPTIONS.map(option => (
                  <label
                    key={option.value}
                    className={clsx(
                      styles.recurrenceOption,
                      selectedFrequency === option.value && styles.recurrenceOptionActive
                    )}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      {...register('recurrence.frequency')}
                      checked={selectedFrequency === option.value}
                    />
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </label>
                ))}
              </div>

              {selectedFrequency !== 'none' && (
                <div className={styles.recurrenceInline}>
                  <label htmlFor="income-recurrence-occurrences">Quantidade de lançamentos</label>
                  <input
                    id="income-recurrence-occurrences"
                    type="number"
                    min={1}
                    max={24}
                    {...register('recurrence.occurrences', { valueAsNumber: true })}
                  />
                  <span className={styles.helperText}>
                    Inclui o recebimento atual. Ajuste conforme o número de repetições.
                  </span>
                  {errors.recurrence?.occurrences && (
                    <span className={styles.error}>
                      {errors.recurrence.occurrences.message}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('excludeFromTotals')} />
          <div>
            <strong>Não somar esta receita ao total do período</strong>
            <p className={styles.checkboxDescription}>
              Indicada para valores que você quer registrar mas não contabilizar, como reembolsos ou
              lançamentos duplicados.
            </p>
          </div>
        </label>

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Salvar alterações' : 'Registrar receita'}
          </button>
          {editingId && (
            <button type="button" className={styles.secondaryButton} onClick={handleCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>
      </div>
      <div className={styles.listPanel}>
      {filteredIncomes.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhuma receita registrada em {periodLabel}. Ajuste os filtros ou cadastre um novo
          registro.
        </div>
      ) : (
        <>
        <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th className={styles.descriptionHeader}>Origem / descrição</th>
              <th>Categoria</th>
              <th className={styles.valueHeader}>Valor</th>
              <th className={styles.metaHeader}>Parcela</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncomes.map(income => (
              <tr key={income.id}>
                <td className={styles.descriptionCell}>
                  <strong>{income.source}</strong>
                  {income.description ? <small>{income.description}</small> : null}
                  {income.excludeFromTotals && (
                    <span className={styles.excludedBadge}>Fora do total</span>
                  )}
                </td>
                <td>
                  <span className={clsx(styles.chip, styles.chipCategory)}>{income.category}</span>
                </td>
                <td className={styles.valueCell}>{formatCurrency(income.amount)}</td>
                <td className={styles.metaCell}>
                  {formatRecurrenceProgress(income.recurrenceIndex, income.recurrenceTotal) ?? '—'}
                </td>
                <td className={styles.dateCell}>{formatDateDisplay(income.date)}</td>
                <td className={styles.actionCell}>
                  <div className={styles.tableActions}>
                    <button type="button" onClick={() => handleEdit(income)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void handleDelete(income.id)}>
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className={styles.tableFooter}>
          <span>
            Somando no período: <strong>{formatCurrency(incomeTotals.included)}</strong>
          </span>
          <span>
            Ignorados: <strong>{formatCurrency(incomeTotals.excluded)}</strong>
          </span>
        </div>
        </>
      )}
      </div>
    </section>
  );
};

export { IncomeForm };
