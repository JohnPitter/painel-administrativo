import { useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { formatCurrency } from '@shared/utils/format';
import { generateId } from '@shared/utils/id';

import { useFinance } from '../context/FinanceContext';
import type { Expense } from '../types/finance';
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

const expenseSchema = z.object({
  description: z.string().min(1, 'Descreva o gasto'),
  amount: z.coerce.number().positive('Informe um valor positivo'),
  category: z.string().min(1, 'Selecione uma categoria'),
  paymentMethod: z.enum(['dinheiro', 'debito', 'credito', 'pix', 'boleto', 'outro']),
  date: z.string().min(1, 'Informe a data'),
  excludeFromTotals: z.boolean().default(false),
  recurrence: recurrenceSchema,
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const PAYMENT_METHOD_LABELS: Record<ExpenseFormValues['paymentMethod'], string> = {
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  boleto: 'Boleto',
  outro: 'Outro',
};

const ExpenseForm = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, categories } = useFinance();
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [editingId, setEditingId] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => getAvailableYears(expenses.map(expense => expense.date)),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter(expense =>
      matchesPeriod(expense.date, selectedYear, selectedMonth)
    );
    return sortByDateAndDescription(filtered);
  }, [expenses, selectedYear, selectedMonth]);

  const periodLabel = formatPeriodLabel(selectedMonth, selectedYear);
  const expenseTotals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        if (expense.excludeFromTotals) {
          return {
            ...acc,
            excluded: acc.excluded + expense.amount,
            excludedCount: acc.excludedCount + 1,
          };
        }
        return {
          ...acc,
          included: acc.included + expense.amount,
        };
      },
      { included: 0, excluded: 0, excludedCount: 0 }
    );
  }, [filteredExpenses]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      paymentMethod: 'credito',
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
      description: '',
      amount: 0,
      category: '',
      paymentMethod: 'credito',
      date: new Date().toISOString().split('T')[0],
      excludeFromTotals: false,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const onSubmit = async (data: ExpenseFormValues) => {
    const { recurrence, ...expense } = data;

    if (editingId) {
      const currentExpense = expenses.find(item => item.id === editingId);
      await updateExpense(editingId, {
        ...expense,
        recurrenceId: currentExpense?.recurrenceId ?? null,
        recurrenceIndex: currentExpense?.recurrenceIndex ?? null,
        recurrenceTotal: currentExpense?.recurrenceTotal ?? null,
      });
    } else {
      const schedule = generateRecurringDates(
        expense.date,
        recurrence.frequency,
        recurrence.occurrences
      );

      if (schedule.length === 1) {
        await addExpense(expense);
      } else {
        const recurrenceId = generateId();
        const total = schedule.length;

        for (const [index, scheduledDate] of schedule.entries()) {
          await addExpense(
            {
              ...expense,
              date: scheduledDate,
              recurrenceId,
              recurrenceIndex: index + 1,
              recurrenceTotal: total,
            },
            { silent: true }
          );
        }
        toast.success(`Recorrência registrada com ${schedule.length} lançamentos de gastos`);
      }
    }

    resetForm();
    setEditingId(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    reset({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      date: expense.date,
      excludeFromTotals: expense.excludeFromTotals ?? false,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
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
    <section id="despesas" className={styles.wrapper}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Controle de gastos</h2>
            <p>Registre despesas e acompanhe a distribuição por categoria.</p>
          </div>
          <span className={styles.periodChip}>{periodLabel}</span>
        </div>
        <div className={styles.summaryStrip}>
          <div className={styles.summaryCard}>
            <span>Gastos no período</span>
            <strong>{formatCurrency(expenseTotals.included)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Registros</span>
            <strong>{filteredExpenses.length}</strong>
          </div>
          <div className={clsx(styles.summaryCard, styles.summaryCardMuted)}>
            <span>Fora do total</span>
            <strong>{formatCurrency(expenseTotals.excluded)}</strong>
          </div>
        </div>
      <div className={styles.filters}>
        <div className={styles.filter}>
          <label htmlFor="expense-year">Ano</label>
          <select
            id="expense-year"
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
          <label htmlFor="expense-month">Mês</label>
          <select
            id="expense-month"
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
            <label htmlFor="expense-description">Descrição</label>
            <input
              id="expense-description"
              placeholder="Aluguel, mercado, transporte..."
              {...register('description')}
            />
            {errors.description && (
              <span className={styles.error}>{errors.description.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-amount">Valor</label>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <span className={styles.error}>{errors.amount.message}</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="expense-category">Categoria</label>
            <select id="expense-category" {...register('category')}>
              <option value="">Selecione</option>
              {categories.expenses.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
            <span className={styles.helperText}>Gerencie categorias em "Configurações".</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-payment">Forma de pagamento</label>
            <select id="expense-payment" {...register('paymentMethod')}>
              <option value="credito">Cartão de crédito</option>
              <option value="debito">Cartão de débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="outro">Outro</option>
            </select>
            {errors.paymentMethod && (
              <span className={styles.error}>{errors.paymentMethod.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-date">Data</label>
            <input id="expense-date" type="date" {...register('date')} />
            {errors.date && <span className={styles.error}>{errors.date.message}</span>}
          </div>
        </div>

        <div className={styles.recurrenceBlock}>
          <div className={styles.recurrenceHeader}>
            <strong>Automatize a recorrência</strong>
            <span>Gere lançamentos futuros automaticamente sem repetir o cadastro todo mês.</span>
          </div>

          {editingId ? (
            <p className={styles.recurrenceInfo}>
              Para alterar recorrências, finalize a edição e crie um novo lançamento com o intervalo
              desejado.
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
                  <label htmlFor="expense-recurrence-occurrences">Quantidade de lançamentos</label>
                  <input
                    id="expense-recurrence-occurrences"
                    type="number"
                    min={1}
                    max={24}
                    {...register('recurrence.occurrences', { valueAsNumber: true })}
                  />
                  <span className={styles.helperText}>
                    Inclui o lançamento atual. Ajuste conforme a duração desejada.
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
            <strong>Não somar este gasto ao total do período</strong>
            <p className={styles.checkboxDescription}>
              Use para reembolsos ou lançamentos apenas informativos. Eles aparecerão na lista, mas
              não afetam gráficos e totais.
            </p>
          </div>
        </label>

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Salvar alterações' : 'Registrar gasto'}
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
      {filteredExpenses.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhum gasto registrado em {periodLabel}. Ajuste os filtros ou cadastre um novo registro.
        </div>
      ) : (
        <>
        <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th className={styles.descriptionHeader}>Descrição</th>
              <th className={styles.valueHeader}>Valor</th>
              <th>Categoria</th>
              <th>Forma</th>
              <th className={styles.metaHeader}>Parcela</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map(expense => (
              <tr key={expense.id}>
                <td className={styles.descriptionCell}>
                  <strong>{expense.description}</strong>
                  {expense.excludeFromTotals && (
                    <span className={styles.excludedBadge}>Fora do total</span>
                  )}
                </td>
                <td className={styles.valueCell}>{formatCurrency(expense.amount)}</td>
                <td>
                  <span className={clsx(styles.chip, styles.chipCategory)}>{expense.category}</span>
                </td>
                <td>
                  <span className={clsx(styles.chip, styles.chipMethod)}>
                    {PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                  </span>
                </td>
                <td className={styles.metaCell}>
                  {formatRecurrenceProgress(expense.recurrenceIndex, expense.recurrenceTotal) ??
                    '—'}
                </td>
                <td className={styles.dateCell}>{formatDateDisplay(expense.date)}</td>
                <td className={styles.actionCell}>
                  <div className={styles.tableActions}>
                    <button type="button" onClick={() => handleEdit(expense)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void handleDelete(expense.id)}>
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
            Somando no período: <strong>{formatCurrency(expenseTotals.included)}</strong>
          </span>
          <span>
            Ignorados: <strong>{formatCurrency(expenseTotals.excluded)}</strong>
          </span>
        </div>
        </>
      )}
      </div>
    </section>
  );
};

export { ExpenseForm };
