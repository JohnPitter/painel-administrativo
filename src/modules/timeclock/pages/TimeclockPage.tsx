import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { DashboardLayout } from '@core/layout/DashboardLayout';
import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import jsPDF from 'jspdf';

import styles from './TimeclockPage.module.css';
import { generateId } from '@shared/utils/id';
import type { ApiError } from '@shared/services/apiClient';
import {
  createEntry as createEntryRemote,
  deleteEntry as deleteEntryRemote,
  listEntries,
  updateEntry as updateEntryRemote,
} from '@modules/timeclock/services/timeclockService';

type ShiftType = 'padrao' | 'homeOffice' | 'viagem';

interface TimeEntry {
  id: string;
  date: string;
  firstCheckIn: string;
  firstCheckOut: string;
  secondCheckIn: string;
  secondCheckOut: string;
  shiftType: ShiftType;
  notes: string;
}

const SHIFT_OPTIONS: Array<{ value: ShiftType; label: string }> = [
  { value: 'padrao', label: 'Turno padrão' },
  { value: 'homeOffice', label: 'Home office' },
  { value: 'viagem', label: 'Viagem/externo' },
];

const formatDateDisplay = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}/${month}/${year}`;
};

const displayTime = (value: string) => (value ? value : '—');

const HOME_OFFICE_BREAK_HOURS = 1;

const getHoursWorked = (entry: TimeEntry) => {
  const firstSegment = diffHours(entry.date, entry.firstCheckIn, entry.firstCheckOut);
  const secondSegment = diffHours(entry.date, entry.secondCheckIn, entry.secondCheckOut);
  let total = firstSegment + secondSegment;
  if (entry.shiftType === 'homeOffice') {
    total = Math.max(0, total - HOME_OFFICE_BREAK_HOURS);
  }
  return total;
};

const formatHours = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}h`;
};

const getTodayIsoDate = () => new Date().toISOString().split('T')[0] ?? '';
const HOME_OFFICE_START = '08:00';
const HOME_OFFICE_END = '17:00';
const STORAGE_KEY = 'timeclock_guest_entries';
const REMOTE_CACHE_PREFIX = 'timeclock_remote_entries';
const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

const sortEntries = (list: TimeEntry[]) =>
  [...list].sort((a, b) => {
    if (a.date === b.date) {
      return (a.firstCheckIn || '').localeCompare(b.firstCheckIn || '');
    }
    return b.date.localeCompare(a.date);
  });

const buildRemoteCacheKey = (uid: string) => `${REMOTE_CACHE_PREFIX}_${uid}`;

const getErrorStatus = (error: unknown) => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as ApiError).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
};

const isAccessDeniedError = (error: unknown) => {
  const status = getErrorStatus(error);
  return status === 401 || status === 403;
};

const defaultFormValues = (shiftType: ShiftType = 'padrao'): Omit<TimeEntry, 'id'> => ({
  date: getTodayIsoDate(),
  firstCheckIn: shiftType === 'homeOffice' ? HOME_OFFICE_START : '09:00',
  firstCheckOut: shiftType === 'homeOffice' ? HOME_OFFICE_END : '12:00',
  secondCheckIn: shiftType === 'homeOffice' ? '' : '13:00',
  secondCheckOut: shiftType === 'homeOffice' ? '' : '18:00',
  shiftType,
  notes: '',
});

const TimeclockPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Omit<TimeEntry, 'id'>>(defaultFormValues());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  const updateEntriesState = useCallback((updater: (prev: TimeEntry[]) => TimeEntry[]) => {
    setEntries(prev => sortEntries(updater(prev)));
  }, []);

  const persistGuestEntries = useCallback((next: TimeEntry[]) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Erro ao salvar pontos locais', error);
    }
  }, []);

  const loadGuestEntries = useCallback(() => {
    if (typeof window === 'undefined') {
      setEntries([]);
      setStorageHydrated(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setEntries([]);
      } else {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map(item => sanitizeEntry(item))
            .filter((entry): entry is TimeEntry => entry !== null);
          setEntries(sortEntries(sanitized));
        } else {
          setEntries([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pontos locais', error);
      setEntries([]);
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  const persistRemoteEntries = useCallback(
    (next: TimeEntry[]) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Falha ao salvar cache remoto do controle de ponto', error);
      }
    },
    [user]
  );

  const loadRemoteEntries = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(buildRemoteCacheKey(user.uid));
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        return null;
      }
      const sanitized = parsed
        .map(item => sanitizeEntry(item))
        .filter((entry): entry is TimeEntry => entry !== null);
      return sortEntries(sanitized);
    } catch (error) {
      console.warn('Falha ao carregar cache remoto do controle de ponto', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteEntries = useCallback(async () => {
    const token = await getRemoteToken();
    const response = await listEntries(token);
    const sanitized = sortEntries(
      (response.entries ?? [])
        .map(entry => sanitizeEntry(entry))
        .filter((entry): entry is TimeEntry => entry !== null)
    );
    setEntries(sanitized);
    persistRemoteEntries(sanitized);
    return sanitized;
  }, [getRemoteToken, persistRemoteEntries]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (isGuestMode || !user) {
        loadGuestEntries();
        setLoading(false);
        return;
      }

      setLoading(true);
      const cached = loadRemoteEntries();
      if (cached && !cancelled) {
        setEntries(cached);
      }

      try {
        await fetchRemoteEntries();
      } catch (error) {
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestEntries();
          toast.error('Sua assinatura está suspensa. Os registros serão mantidos apenas neste dispositivo.');
        } else {
          console.error('Erro ao carregar registros do controle de ponto', error);
          toast.error('Não foi possível sincronizar o controle de ponto.');
        }
      } finally {
        if (!cancelled) {
          setStorageHydrated(true);
          setLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [fetchRemoteEntries, isGuestMode, loadGuestEntries, loadRemoteEntries, user]);

  useEffect(() => {
    if (!isGuestMode || !storageHydrated) {
      return;
    }
    persistGuestEntries(entries);
  }, [entries, isGuestMode, persistGuestEntries, storageHydrated]);

  const weeklySummary = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach(entry => {
      const weekKey = getWeekKey(entry.date);
      totals.set(weekKey, (totals.get(weekKey) ?? 0) + getHoursWorked(entry));
    });
    return Array.from(totals.entries())
      .map(([week, hours]) => ({ week, hours }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [entries]);

  const averageHours = useMemo(() => {
    if (entries.length === 0) {
      return 0;
    }
    const total = entries.reduce((sum, entry) => sum + getHoursWorked(entry), 0);
    return total / entries.length;
  }, [entries]);

  const shiftLabelMap = useMemo(
    () => Object.fromEntries(SHIFT_OPTIONS.map(option => [option.value, option.label] as const)),
    []
  );

  const monthlyEntries = useMemo(
    () =>
      entries
        .filter(entry => entry.date.startsWith(selectedMonth))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, selectedMonth]
  );

  const monthlyTotalHours = useMemo(
    () => monthlyEntries.reduce((sum, entry) => sum + getHoursWorked(entry), 0),
    [monthlyEntries]
  );

  const monthLabel = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      return 'Mês inválido';
    }
    const reference = new Date(year, monthIndex, 1);
    return reference.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const isHomeOffice = formState.shiftType === 'homeOffice';

  const handleChange = <Key extends keyof typeof formState>(field: Key, value: typeof formState[Key]) => {
    setFormState(prev => {
      if (field === 'shiftType') {
        const nextShift = value as ShiftType;
        if (nextShift === 'homeOffice') {
          return {
            ...prev,
            shiftType: nextShift,
            firstCheckIn: HOME_OFFICE_START,
            firstCheckOut: HOME_OFFICE_END,
            secondCheckIn: '',
            secondCheckOut: '',
          };
        }
        if (prev.shiftType === 'homeOffice') {
          const defaults = defaultFormValues(nextShift);
          return {
            ...prev,
            shiftType: nextShift,
            firstCheckIn: defaults.firstCheckIn,
            firstCheckOut: defaults.firstCheckOut,
            secondCheckIn: defaults.secondCheckIn,
            secondCheckOut: defaults.secondCheckOut,
          };
        }
      }
      return { ...prev, [field]: value };
    });
  };

  const resetForm = (dateOverride?: string) => {
    setFormState(prev => ({
      ...defaultFormValues(prev.shiftType),
      date: dateOverride ?? getTodayIsoDate(),
      notes: '',
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const entryId = editingId ?? generateId();
    const payload: TimeEntry = {
      id: entryId,
      ...formState,
    };

    if (formState.shiftType === 'homeOffice') {
      payload.firstCheckIn = HOME_OFFICE_START;
      payload.firstCheckOut = HOME_OFFICE_END;
      payload.secondCheckIn = '';
      payload.secondCheckOut = '';
    }

    const remotePayload = {
      date: payload.date,
      firstCheckIn: payload.firstCheckIn,
      firstCheckOut: payload.firstCheckOut,
      secondCheckIn: payload.secondCheckIn,
      secondCheckOut: payload.secondCheckOut,
      shiftType: payload.shiftType,
      notes: payload.notes,
    };

    if (isGuestMode || !user) {
      if (editingId) {
        updateEntriesState(prev => prev.map(entry => (entry.id === editingId ? payload : entry)));
      } else {
        updateEntriesState(prev => [payload, ...prev]);
      }
    } else {
      try {
        const token = await getRemoteToken();
        if (editingId) {
          await updateEntryRemote(token, entryId, remotePayload);
        } else {
          await createEntryRemote(token, remotePayload);
        }
        await fetchRemoteEntries();
      } catch (error) {
        console.error('Erro ao registrar ponto', error);
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          if (editingId) {
            updateEntriesState(prev => prev.map(entry => (entry.id === editingId ? payload : entry)));
          } else {
            updateEntriesState(prev => [payload, ...prev]);
          }
          toast.success('Registro salvo localmente. Renove para sincronizar com a nuvem.');
        } else {
          toast.error('Não foi possível sincronizar esse registro.');
        }
      }
    }

    setEditingId(null);
    if (formState.date) {
      setSelectedMonth(formState.date.slice(0, 7));
    }
    resetForm(formState.date);
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setFormState({
      date: entry.date,
      firstCheckIn: entry.firstCheckIn,
      firstCheckOut: entry.firstCheckOut,
      secondCheckIn: entry.secondCheckIn,
      secondCheckOut: entry.secondCheckOut,
      shiftType: entry.shiftType,
      notes: entry.notes,
    });
  };

  const handleRemove = async (id: string) => {
    if (isGuestMode || !user) {
      updateEntriesState(prev => prev.filter(entry => entry.id !== id));
    } else {
      try {
        const token = await getRemoteToken();
        await deleteEntryRemote(token, id);
        await fetchRemoteEntries();
      } catch (error) {
        console.error('Erro ao remover ponto', error);
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          updateEntriesState(prev => prev.filter(entry => entry.id !== id));
          toast.success('Registro removido localmente. Renove para sincronizar.');
        } else {
          toast.error('Não foi possível remover o registro.');
        }
      }
    }
    if (editingId === id) {
      setEditingId(null);
      resetForm();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleExportPdf = () => {
    if (monthlyEntries.length === 0) {
      return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 14;
    const marginY = 18;
    const hasHomeOffice = monthlyEntries.some(entry => entry.shiftType === 'homeOffice');
    const columns = [
      { label: 'Data', width: 22 },
      { label: 'Entrada 1', width: 24 },
      { label: 'Saída 1', width: 24 },
      { label: 'Entrada 2', width: 24 },
      { label: 'Saída 2', width: 24 },
      { label: 'Horas', width: 20 },
      { label: 'Tipo', width: 40 },
    ] as const;
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 39, 118);
    doc.text('Relatório de Ponto', marginX, marginY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Período: ${monthLabel}`, marginX, marginY + 8);
    doc.text(`Total de horas no mês: ${formatHours(monthlyTotalHours)}`, marginX, marginY + 14);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, marginX, marginY + 20);

    if (hasHomeOffice) {
      doc.text(
        'Observação: turnos em home office consideram uma pausa automática de 1 hora (08:00 às 17:00).',
        marginX,
        marginY + 26
      );
    }

    let cursorY = hasHomeOffice ? marginY + 34 : marginY + 28;

    const drawTableHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setFillColor(0, 39, 118);
      doc.setTextColor(255, 255, 255);
      let currentX = marginX;
      columns.forEach(column => {
        doc.rect(currentX, cursorY, column.width, 8, 'F');
        doc.text(column.label, currentX + 2, cursorY + 5);
        currentX += column.width;
      });
      cursorY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    };

    const ensureSpace = (height: number) => {
      if (cursorY + height > 280) {
        doc.addPage();
        cursorY = marginY;
        drawTableHeader();
      }
    };

    drawTableHeader();

    monthlyEntries.forEach((entry, index) => {
      const rowHeight = 8;
      ensureSpace(rowHeight);

      if (index % 2 === 0) {
        doc.setFillColor(245, 249, 255);
        doc.rect(marginX, cursorY, tableWidth, rowHeight, 'F');
      }

      let currentX = marginX;
      const rowValues = [
        formatDateDisplay(entry.date),
        displayTime(entry.firstCheckIn),
        displayTime(entry.firstCheckOut),
        displayTime(entry.secondCheckIn),
        displayTime(entry.secondCheckOut),
        formatHours(getHoursWorked(entry)),
        shiftLabelMap[entry.shiftType] ?? entry.shiftType,
      ];

      rowValues.forEach((value, columnIndex) => {
        doc.text(String(value), currentX + 2, cursorY + 5);
        currentX += columns[columnIndex].width;
      });

      cursorY += rowHeight;

      if (entry.notes) {
        const notes = doc.splitTextToSize(`Notas: ${entry.notes}`, tableWidth - 4);
        const notesHeight = notes.length * 5 + 2;
        ensureSpace(notesHeight);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(70, 70, 70);
        doc.text(notes, marginX + 2, cursorY + 5);
        cursorY += notesHeight;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      }
    });

    ensureSpace(16);
    doc.setFillColor(0, 39, 118);
    doc.setTextColor(255, 255, 255);
    doc.rect(marginX, cursorY + 4, tableWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(`Saldo total de horas no mês: ${formatHours(monthlyTotalHours)}`, marginX + 2, cursorY + 10);

    doc.save(`controle-ponto-${selectedMonth}.pdf`);
  };

  if (loading && entries.length === 0) {
    return (
      <DashboardLayout
        title="Controle de tempo"
        subtitle="Registre entradas, saídas e acompanhe seu equilíbrio de horas."
        actions={
          <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
            ← Voltar para aplicativos
          </button>
        }
      >
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p>Sincronizando registros de ponto...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Controle de tempo"
      subtitle="Registre entradas, saídas e acompanhe seu equilíbrio de horas."
      actions={
        <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
          ← Voltar para aplicativos
        </button>
      }
    >
      <section className={styles.wrapper}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <header className={styles.formHeader}>
            <h2>Registrar turno</h2>
            <p>
              Informe os horários de entrada e saída para os dois períodos do dia, garantindo um
              registro completo da jornada.
            </p>
          </header>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Data</span>
              <input
                type="date"
                value={formState.date}
                onChange={event => handleChange('date', event.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Entrada 1</span>
              <input
                type="time"
                value={formState.firstCheckIn}
                onChange={event => handleChange('firstCheckIn', event.target.value)}
                disabled={isHomeOffice}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Saída 1</span>
              <input
                type="time"
                value={formState.firstCheckOut}
                onChange={event => handleChange('firstCheckOut', event.target.value)}
                disabled={isHomeOffice}
                required
              />
            </label>
            {!isHomeOffice && (
              <>
                <label className={styles.field}>
                  <span>Entrada 2</span>
                  <input
                    type="time"
                    value={formState.secondCheckIn}
                    onChange={event => handleChange('secondCheckIn', event.target.value)}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Saída 2</span>
                  <input
                    type="time"
                    value={formState.secondCheckOut}
                    onChange={event => handleChange('secondCheckOut', event.target.value)}
                    required
                  />
                </label>
              </>
            )}
            <label className={styles.field}>
              <span>Tipo de turno</span>
              <select
                value={formState.shiftType}
                onChange={event => handleChange('shiftType', event.target.value as ShiftType)}
              >
                {SHIFT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {isHomeOffice && (
              <p className={styles.homeOfficeHint}>
                Para turnos em home office consideramos automaticamente o período das 08:00 às 17:00 com
                uma pausa de 1 hora. Registre observações adicionais no campo de notas, se necessário.
              </p>
            )}
            <label className={styles.fieldNotes}>
              <span>Notas</span>
              <textarea
                rows={2}
                value={formState.notes}
                onChange={event => handleChange('notes', event.target.value)}
                placeholder="Ajuste de horário, motivo da visita ou lembretes."
              />
            </label>
          </div>
          <footer className={styles.formActions}>
            <button type="submit">{editingId ? 'Salvar alterações' : 'Adicionar turno'}</button>
            {editingId && (
              <button type="button" className={styles.secondaryButton} onClick={handleCancelEdit}>
                Cancelar edição
              </button>
            )}
          </footer>
        </form>

        <section className={styles.summary}>
          <article className={styles.summaryCard}>
            <span>Total de turnos</span>
            <strong>{entries.length}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Média por turno</span>
            <strong>{formatHours(averageHours)}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Horas registradas</span>
            <strong>
              {formatHours(entries.reduce((accumulator, entry) => accumulator + getHoursWorked(entry), 0))}
            </strong>
          </article>
        </section>

        <section className={styles.monthly}>
          <header className={styles.monthlyHeader}>
            <div>
              <h3>Visão mensal</h3>
              <p>Filtre por mês, acompanhe suas horas consolidadas e exporte um relatório em PDF.</p>
            </div>
            <div className={styles.monthlyControls}>
              <label className={styles.monthSelect}>
                <span>Mês</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={event => {
                    if (event.target.value) {
                      setSelectedMonth(event.target.value);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className={styles.exportButton}
                onClick={handleExportPdf}
                disabled={monthlyEntries.length === 0}
              >
                Baixar PDF
              </button>
            </div>
          </header>

          {monthlyEntries.length === 0 ? (
            <div className={styles.emptyState}>Nenhum turno registrado no mês selecionado.</div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Entrada 1</th>
                      <th>Saída 1</th>
                      <th>Entrada 2</th>
                      <th>Saída 2</th>
                      <th>Horas</th>
                      <th>Tipo</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyEntries.map(entry => (
                      <tr key={entry.id}>
                        <td>{formatDateDisplay(entry.date)}</td>
                        <td>{displayTime(entry.firstCheckIn)}</td>
                        <td>{displayTime(entry.firstCheckOut)}</td>
                        <td>{displayTime(entry.secondCheckIn)}</td>
                        <td>{displayTime(entry.secondCheckOut)}</td>
                        <td>{formatHours(getHoursWorked(entry))}</td>
                        <td>{shiftLabelMap[entry.shiftType] ?? entry.shiftType}</td>
                        <td>{entry.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className={styles.monthlyFooter}>
                <span>
                  Mês selecionado: <strong>{monthLabel}</strong>
                </span>
                <span>
                  Total de horas: <strong>{formatHours(monthlyTotalHours)}</strong>
                </span>
              </footer>
            </>
          )}
        </section>

        <section className={styles.weekly}>
          <h3>Resumo semanal</h3>
          {weeklySummary.length === 0 ? (
            <div className={styles.emptyState}>Registre turnos para visualizar a evolução semanal.</div>
          ) : (
            <ul className={styles.weekList}>
              {weeklySummary.map(item => (
                <li key={item.week}>
                  <span>Semana {item.week}</span>
                  <strong>{formatHours(item.hours)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.tableSection}>
          <header>
            <h3>Histórico recente</h3>
            <p>Edite ou remova turnos conforme necessário para manter o controle organizado.</p>
          </header>
          {entries.length === 0 ? (
            <div className={styles.emptyState}>Nenhum turno cadastrado. Comece registrando o primeiro.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Entrada 1</th>
                    <th>Saída 1</th>
                    <th>Entrada 2</th>
                    <th>Saída 2</th>
                    <th>Tipo</th>
                    <th>Total</th>
                    <th>Anotações</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td>{formatDateDisplay(entry.date)}</td>
                      <td>{displayTime(entry.firstCheckIn)}</td>
                      <td>{displayTime(entry.firstCheckOut)}</td>
                      <td>{displayTime(entry.secondCheckIn)}</td>
                      <td>{displayTime(entry.secondCheckOut)}</td>
                      <td>{SHIFT_OPTIONS.find(option => option.value === entry.shiftType)?.label}</td>
                      <td>{formatHours(getHoursWorked(entry))}</td>
                      <td>{entry.notes || '—'}</td>
                      <td className={styles.tableActions}>
                        <button type="button" onClick={() => handleEdit(entry)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleRemove(entry.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </DashboardLayout>
  );
};

const getWeekKey = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Inválida';
  }

  const janFirst = new Date(date.getFullYear(), 0, 1);
  const dayDiff = Math.floor((date.getTime() - janFirst.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor((dayDiff + janFirst.getDay() + 1) / 7) + 1;
  return `${date.getFullYear()}-${String(weekNumber).padStart(2, '0')}`;
};

const diffHours = (isoDate: string, startTime: string, endTime: string) => {
  if (!startTime || !endTime) {
    return 0;
  }
  const start = new Date(`${isoDate}T${startTime}`);
  const end = new Date(`${isoDate}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
};

const sanitizeEntry = (value: unknown): TimeEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const {
    id,
    date,
    firstCheckIn,
    firstCheckOut,
    secondCheckIn,
    secondCheckOut,
    shiftType,
    notes,
  } = value as Partial<TimeEntry>;

  if (typeof id !== 'string' || typeof date !== 'string') {
    return null;
  }

  const safeShift: ShiftType = shiftType === 'homeOffice' || shiftType === 'viagem' ? shiftType : 'padrao';

  return {
    id,
    date,
    firstCheckIn: typeof firstCheckIn === 'string' ? firstCheckIn : '',
    firstCheckOut: typeof firstCheckOut === 'string' ? firstCheckOut : '',
    secondCheckIn: typeof secondCheckIn === 'string' ? secondCheckIn : '',
    secondCheckOut: typeof secondCheckOut === 'string' ? secondCheckOut : '',
    shiftType: safeShift,
    notes: typeof notes === 'string' ? notes : '',
  } satisfies TimeEntry;
};

export { TimeclockPage };
