interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  tag: 'Reunião' | 'Pessoal' | 'Estudo' | 'Saúde';
}

interface CalendarState {
  events: CalendarEvent[];
}

interface CalendarContextValue extends CalendarState {
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
}

export type { CalendarContextValue, CalendarEvent, CalendarState };
