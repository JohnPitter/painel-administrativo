export const RECURRENCE_VALUES = [
  'none',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_VALUES)[number];

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  occurrences: number;
}

const FREQUENCY_INTERVAL_IN_MONTHS: Record<Exclude<RecurrenceFrequency, 'none'>, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export const RECURRENCE_OPTIONS: Array<{
  value: RecurrenceFrequency;
  label: string;
  description: string;
}> = [
  {
    value: 'none',
    label: 'Sem recorrência',
    description: 'Lançamento único para o mês selecionado.',
  },
  {
    value: 'monthly',
    label: 'Mensal',
    description: 'Repete a cada mês mantendo o dia escolhido.',
  },
  {
    value: 'bimonthly',
    label: 'Bimestral',
    description: 'Ideal para contas que chegam a cada dois meses.',
  },
  {
    value: 'quarterly',
    label: 'Trimestral',
    description: 'Acompanhe custos sazonais a cada trimestre.',
  },
  {
    value: 'semiannual',
    label: 'Semestral',
    description: 'Para taxas e investimentos semestrais.',
  },
  {
    value: 'annual',
    label: 'Anual',
    description: 'Organize lançamentos que acontecem uma vez por ano.',
  },
];

const padNumber = (value: number) => value.toString().padStart(2, '0');

const addMonthsPreservingDay = (isoDate: string, monthsToAdd: number) => {
  const [yearString, monthString, dayString] = isoDate.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return isoDate;
  }

  const totalMonths = month - 1 + monthsToAdd;
  const nextYear = year + Math.floor(totalMonths / 12);
  const nextMonthIndex = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfTargetMonth);

  return `${nextYear}-${padNumber(nextMonthIndex + 1)}-${padNumber(safeDay)}`;
};

export const generateRecurringDates = (
  date: string,
  frequency: RecurrenceFrequency,
  occurrences: number
): string[] => {
  const sanitizedOccurrences = Math.max(1, Math.min(occurrences, 24));

  if (frequency === 'none' || sanitizedOccurrences === 1) {
    return [date];
  }

  const intervalInMonths = FREQUENCY_INTERVAL_IN_MONTHS[frequency];
  const schedule = [date];

  for (let index = 1; index < sanitizedOccurrences; index += 1) {
    const monthsToAdd = intervalInMonths * index;
    schedule.push(addMonthsPreservingDay(date, monthsToAdd));
  }

  return schedule;
};

export const formatRecurrenceProgress = (
  index?: number | null,
  total?: number | null
): string | null => {
  if (typeof index !== 'number' || typeof total !== 'number' || total <= 1 || index < 1) {
    return null;
  }
  return `Parcela ${index}/${total}`;
};
