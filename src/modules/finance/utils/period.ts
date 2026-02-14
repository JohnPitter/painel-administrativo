const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

const getCurrentYear = () => new Date().getFullYear();
const getCurrentMonth = () => new Date().getMonth() + 1;

const safeDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const matchesPeriod = (value: string, year: number, month: number) => {
  const parsed = safeDate(value);
  if (!parsed) {
    return false;
  }
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month;
};

const getAvailableYears = (dates: string[]) => {
  const years = new Set<number>();
  dates.forEach(dateString => {
    const parsed = safeDate(dateString);
    if (parsed) {
      years.add(parsed.getFullYear());
    }
  });
  years.add(getCurrentYear());
  return Array.from(years).sort((a, b) => a - b);
};

const formatPeriodLabel = (month: number, year: number) => {
  const monthLabel = MONTH_OPTIONS.find(option => option.value === month)?.label ?? `${month}`;
  return `${monthLabel}/${year}`;
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatDateDisplay = (value: string) => {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const normalizeDescription = (value: string | undefined) =>
  (value ?? '').toString().trim().toLowerCase();

const sortByDateAndDescription = <T extends { date: string; description?: string }>(
  records: T[]
) => {
  return [...records].sort((a, b) => {
    const dateA = safeDate(a.date)?.getTime() ?? 0;
    const dateB = safeDate(b.date)?.getTime() ?? 0;

    if (dateA !== dateB) {
      return dateB - dateA;
    }
    return normalizeDescription(a.description).localeCompare(normalizeDescription(b.description), 'pt-BR', {
      sensitivity: 'base',
    });
  });
};

export {
  MONTH_OPTIONS,
  formatPeriodLabel,
  getAvailableYears,
  getCurrentMonth,
  getCurrentYear,
  matchesPeriod,
  safeDate,
  formatDateDisplay,
  sortByDateAndDescription,
  toMonthKey,
};
