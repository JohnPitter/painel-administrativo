import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { formatCurrency } from '@shared/utils/format';
import { generateId } from '@shared/utils/id';

import { useFinance } from '../context/FinanceContext';
import type { Investment } from '../types/finance';
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

const investmentSchema = z.object({
  description: z.string().min(1, 'Descreva o investimento'),
  category: z.string().min(1, 'Informe a categoria'),
  amount: z.coerce.number().positive('Informe um valor positivo'),
  institution: z.string().min(1, 'Informe a instituição'),
  type: z.enum(['renda_fixa', 'renda_variavel', 'fundo', 'poupanca', 'outro']),
  expectedReturn: z.coerce.number().min(0, 'O rendimento esperado deve ser positivo').optional(),
  date: z.string().min(1, 'Informe a data'),
  recurrence: recurrenceSchema,
});

type InvestmentFormValues = z.infer<typeof investmentSchema>;

const INVESTMENT_TYPE_LABELS: Record<InvestmentFormValues['type'], string> = {
  renda_fixa: 'Renda fixa',
  renda_variavel: 'Renda variável',
  fundo: 'Fundo',
  poupanca: 'Poupança',
  outro: 'Outro',
};

const InvestmentForm = () => {
  const { investments, addInvestment, updateInvestment, deleteInvestment, categories } = useFinance();
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonth();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [editingId, setEditingId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState({ size: 100, offset: 0, enabled: false });

  const yearOptions = useMemo(
    () => getAvailableYears(investments.map(investment => investment.date)),
    [investments]
  );

  const filteredInvestments = useMemo(() => {
    const filtered = investments.filter(investment =>
      matchesPeriod(investment.date, selectedYear, selectedMonth)
    );
    return sortByDateAndDescription(filtered);
  }, [investments, selectedYear, selectedMonth]);

  const periodLabel = formatPeriodLabel(selectedMonth, selectedYear);
  const totalInvestmentsAmount = useMemo(
    () => filteredInvestments.reduce((sum, investment) => sum + investment.amount, 0),
    [filteredInvestments]
  );

  const updateScrollMetrics = useCallback(() => {
    const node = tableScrollRef.current;
    if (!node) return;
    const { scrollWidth, clientWidth, scrollLeft } = node;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= 0) {
      setScrollMetrics({ size: 100, offset: 0, enabled: false });
      return;
    }

    const sizePercent = Math.max((clientWidth / scrollWidth) * 100, 12);
    const offsetPercent = (scrollLeft / maxScroll) * (100 - sizePercent);
    setScrollMetrics({ size: sizePercent, offset: offsetPercent, enabled: true });
  }, []);

  const handleScrollbarJump = useCallback(
    (ratio: number) => {
      if (!scrollMetrics.enabled) return;
      const node = tableScrollRef.current;
      if (!node) return;
      const clampedRatio = Math.min(Math.max(ratio, 0), 1);
      node.scrollTo({
        left: (node.scrollWidth - node.clientWidth) * clampedRatio,
        behavior: 'smooth',
      });
    },
    [scrollMetrics.enabled]
  );

  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;

    updateScrollMetrics();

    node.addEventListener('scroll', updateScrollMetrics);

    let resizeObserver: ResizeObserver | null = null;
    const handleResizeFallback = () => updateScrollMetrics();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollMetrics());
      resizeObserver.observe(node);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResizeFallback);
    }

    return () => {
      node.removeEventListener('scroll', updateScrollMetrics);

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResizeFallback);
      }
    };
  }, [updateScrollMetrics]);

  useEffect(() => {
    updateScrollMetrics();
  }, [filteredInvestments, updateScrollMetrics]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      type: 'renda_fixa',
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
      category: '',
      amount: 0,
      institution: '',
      type: 'renda_fixa',
      expectedReturn: undefined,
      date: new Date().toISOString().split('T')[0],
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const onSubmit = async (data: InvestmentFormValues) => {
    const { recurrence, expectedReturn, ...rest } = data;
    const payload = {
      ...rest,
      expectedReturn: expectedReturn ?? undefined,
    };

    if (editingId) {
      const currentInvestment = investments.find(item => item.id === editingId);
      await updateInvestment(editingId, {
        ...payload,
        recurrenceId: currentInvestment?.recurrenceId ?? null,
        recurrenceIndex: currentInvestment?.recurrenceIndex ?? null,
        recurrenceTotal: currentInvestment?.recurrenceTotal ?? null,
      });
    } else {
      const schedule = generateRecurringDates(
        payload.date,
        recurrence.frequency,
        recurrence.occurrences
      );

      if (schedule.length === 1) {
        await addInvestment(payload);
      } else {
        const recurrenceId = generateId();
        const total = schedule.length;

        for (const [index, scheduledDate] of schedule.entries()) {
          await addInvestment(
            {
              ...payload,
              date: scheduledDate,
              recurrenceId,
              recurrenceIndex: index + 1,
              recurrenceTotal: total,
            },
            { silent: true }
          );
        }
        toast.success(`Recorrência registrada com ${schedule.length} aportes`);
      }
    }

    resetForm();
    setEditingId(null);
  };

  const handleEdit = (investment: Investment) => {
    setEditingId(investment.id);
    reset({
      description: investment.description,
      category: investment.category,
      amount: investment.amount,
      institution: investment.institution,
      type: investment.type,
      expectedReturn: investment.expectedReturn ?? undefined,
      date: investment.date,
      recurrence: {
        frequency: 'none',
        occurrences: 6,
      },
    });
  };

  const handleDelete = async (id: string) => {
    await deleteInvestment(id);
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
    <section id="investimentos" className={styles.wrapper}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Investimentos</h2>
            <p>Acompanhe aplicações financeiras e metas de rentabilidade.</p>
          </div>
          <span className={styles.periodChip}>{periodLabel}</span>
        </div>
        <div className={styles.summaryStrip}>
          <div className={styles.summaryCard}>
            <span>Total aplicado</span>
            <strong>{formatCurrency(totalInvestmentsAmount)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Registros</span>
            <strong>{filteredInvestments.length}</strong>
          </div>
        </div>

      <div className={styles.filters}>
        <div className={styles.filter}>
          <label htmlFor="investment-year">Ano</label>
          <select
            id="investment-year"
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
          <label htmlFor="investment-month">Mês</label>
          <select
            id="investment-month"
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
            <label htmlFor="investment-description">Descrição</label>
            <input
              id="investment-description"
              placeholder="Tesouro Selic, Ações, Cripto..."
              {...register('description')}
            />
            {errors.description && (
              <span className={styles.error}>{errors.description.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="investment-category">Categoria</label>
            <select id="investment-category" {...register('category')}>
              <option value="">Selecione</option>
              {categories.investments.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && <span className={styles.error}>{errors.category.message}</span>}
            <span className={styles.helperText}>Gerencie categorias em "Configurações".</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="investment-institution">Instituição</label>
            <input
              id="investment-institution"
              placeholder="Banco, Corretora..."
              {...register('institution')}
            />
            {errors.institution && (
              <span className={styles.error}>{errors.institution.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="investment-type">Tipo</label>
            <select id="investment-type" {...register('type')}>
              <option value="renda_fixa">Renda fixa</option>
              <option value="renda_variavel">Renda variavel</option>
              <option value="fundo">Fundo de investimento</option>
              <option value="poupanca">Poupanca</option>
              <option value="outro">Outro</option>
            </select>
            {errors.type && <span className={styles.error}>{errors.type.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="investment-amount">Valor aplicado</label>
            <input
              id="investment-amount"
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
            <label htmlFor="investment-return">Rendimento esperado (%)</label>
            <input
              id="investment-return"
              type="number"
              step="0.01"
              min="0"
              {...register('expectedReturn')}
            />
            {errors.expectedReturn && (
              <span className={styles.error}>{errors.expectedReturn.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="investment-date">Data</label>
            <input id="investment-date" type="date" {...register('date')} />
            {errors.date && <span className={styles.error}>{errors.date.message}</span>}
          </div>
        </div>

        <div className={styles.recurrenceBlock}>
          <div className={styles.recurrenceHeader}>
            <strong>Planeje aportes recorrentes</strong>
            <span>Automatize investimentos mensais e acompanhe os compromissos de longo prazo.</span>
          </div>

          {editingId ? (
            <p className={styles.recurrenceInfo}>
              Ajuste aportes individuais. Para uma nova recorrência, crie um lançamento dedicado.
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
                  <label htmlFor="investment-recurrence-occurrences">
                    Quantidade de lançamentos
                  </label>
                  <input
                    id="investment-recurrence-occurrences"
                    type="number"
                    min={1}
                    max={24}
                    {...register('recurrence.occurrences', { valueAsNumber: true })}
                  />
                  <span className={styles.helperText}>
                    Inclui este aporte inicial. Defina quantas vezes deseja repetir.
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

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Salvar alterações' : 'Adicionar investimento'}
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
      {filteredInvestments.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhum investimento registrado em {periodLabel}. Ajuste os filtros ou cadastre um novo
          registro.
        </div>
      ) : (
        <>
        <div className={styles.tableWrapperWide}>
          <div className={styles.tableScrollArea} ref={tableScrollRef}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th className={styles.descriptionHeader}>Descrição</th>
                  <th>Instituição</th>
                  <th>Tipo</th>
                  <th className={styles.valueHeader}>Valor</th>
                  <th>Rendimento esp.</th>
                  <th className={styles.metaHeader}>Parcela</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map(investment => (
                  <tr key={investment.id}>
                    <td className={styles.descriptionCell}>
                      <strong>{investment.description}</strong>
                    </td>
                    <td className={styles.detailCell}>{investment.institution}</td>
                    <td>
                      <span className={clsx(styles.chip, styles.chipType)}>
                        {INVESTMENT_TYPE_LABELS[investment.type]}
                      </span>
                    </td>
                    <td className={styles.valueCell}>{formatCurrency(investment.amount)}</td>
                    <td className={styles.metaCell}>
                      {typeof investment.expectedReturn === 'number'
                        ? `${investment.expectedReturn.toFixed(2)}% a.a.`
                        : '—'}
                    </td>
                    <td className={styles.metaCell}>
                      {formatRecurrenceProgress(
                        investment.recurrenceIndex,
                        investment.recurrenceTotal
                      ) ?? '—'}
                    </td>
                    <td className={styles.dateCell}>{formatDateDisplay(investment.date)}</td>
                    <td className={styles.actionCell}>
                      <div className={styles.tableActions}>
                        <button type="button" onClick={() => handleEdit(investment)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => void handleDelete(investment.id)}>
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className={styles.customScrollbar}
            data-disabled={(!scrollMetrics.enabled).toString()}
            aria-hidden="true"
            onMouseDown={event => {
              event.preventDefault();
              const trackRect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - trackRect.left) / trackRect.width;
              handleScrollbarJump(ratio);
            }}
            onTouchStart={event => {
              event.preventDefault();
              const touch = event.touches[0];
              if (!touch) return;
              const trackRect = event.currentTarget.getBoundingClientRect();
              const ratio = (touch.clientX - trackRect.left) / trackRect.width;
              handleScrollbarJump(ratio);
            }}
          >
            <span
              className={styles.customScrollbarThumb}
              style={{
                width: `${scrollMetrics.enabled ? scrollMetrics.size : 100}%`,
                left: `${scrollMetrics.enabled ? scrollMetrics.offset : 0}%`,
              }}
            />
          </div>
        </div>
        <div className={styles.tableFooter}>
          <span>
            Total aplicado: <strong>{formatCurrency(totalInvestmentsAmount)}</strong>
          </span>
        </div>
        </>
      )}
      </div>
    </section>
  );
};

export { InvestmentForm };
