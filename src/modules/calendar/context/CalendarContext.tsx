import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import type { ApiError } from '@shared/services/apiClient';

import { createEvent, deleteEventRemote, listEvents } from '../services/calendarService';
import type { CalendarContextValue, CalendarEvent, CalendarState } from '../types/calendar';

const LOCAL_STORAGE_KEY = 'calendar_events_state';
const REMOTE_CACHE_PREFIX = 'calendar_events_state_remote';
const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

const initialState: CalendarState = {
  events: [],
};

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

const sortEvents = (events: CalendarEvent[]) =>
  [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

const mapStoredEvents = (raw: unknown): CalendarEvent[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const { id, date, time, title, description, tag } = item as Partial<CalendarEvent>;
      if (!id || !date || !time || !title) {
        return null;
      }
      return {
        id,
        date,
        time,
        title,
        description: description ?? '',
        tag: (tag as CalendarEvent['tag']) ?? 'Reunião',
      } satisfies CalendarEvent;
    })
    .filter((event): event is CalendarEvent => Boolean(event));
};

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

const buildRemoteCacheKey = (uid: string) => `${REMOTE_CACHE_PREFIX}_${uid}`;

function CalendarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [state, setState] = useState<CalendarState>(initialState);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const loadGuestEvents = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        setState(initialState);
        return;
      }
      const parsed = JSON.parse(stored) as unknown;
      setState({ events: sortEvents(mapStoredEvents(parsed)) });
    } catch (error) {
      console.error('Erro ao carregar eventos locais', error);
      setState(initialState);
    }
  }, []);

  const persistGuest = useCallback((events: CalendarEvent[]) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Erro ao salvar eventos locais', error);
    }
  }, []);

  const persistRemoteCache = useCallback(
    (events: CalendarEvent[]) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(events));
      } catch (error) {
        console.warn('Não foi possível salvar cache remoto do calendário', error);
      }
    },
    [user]
  );

  const loadRemoteCache = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(buildRemoteCacheKey(user.uid));
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as unknown;
      return sortEvents(mapStoredEvents(parsed));
    } catch (error) {
      console.warn('Não foi possível carregar cache remoto do calendário', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteEvents = useCallback(async () => {
    const token = await getRemoteToken();
    const response = await listEvents(token);
    const events = sortEvents(response.events ?? []);
    persistRemoteCache(events);
    setState({ events });
  }, [getRemoteToken, persistRemoteCache]);

  const scheduleBackgroundSync = useCallback(() => {
    if (typeof window === 'undefined' || isGuestMode || !user) {
      return;
    }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      fetchRemoteEvents().catch(error =>
        console.error('Falha ao sincronizar eventos em segundo plano', error)
      );
    }, 2000);
  }, [fetchRemoteEvents, isGuestMode, user]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isGuestMode || !user) {
      setLoading(true);
      loadGuestEvents();
      setLoading(false);
      return;
    }

    setLoading(true);
    const cached = loadRemoteCache();
    if (cached) {
      setState({ events: cached });
      setLoading(false);
    }

    fetchRemoteEvents()
      .then(() => setLoading(false))
      .catch(error => {
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestEvents();
          setLoading(false);
          return;
        }
        console.error('Erro ao carregar eventos do servidor', error);
        setLoading(false);
      });
  }, [fetchRemoteEvents, isGuestMode, loadGuestEvents, loadRemoteCache, user]);

  const addEvent = useCallback<CalendarContextValue['addEvent']>(
    async data => {
      const nextEvent: CalendarEvent = {
        ...data,
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
      };

      if (isGuestMode || !user) {
        setState(prev => {
          const events = sortEvents([nextEvent, ...prev.events]);
          persistGuest(events);
          return { events };
        });
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await createEvent(token, data);
        setState(prev => {
          const events = sortEvents([response.event, ...prev.events]);
          persistRemoteCache(events);
          return { events };
        });
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao registrar evento no calendário', error);
        if (isAccessDeniedError(error)) {
          setState(prev => {
            const events = sortEvents([nextEvent, ...prev.events]);
            persistGuest(events);
            return { events };
          });
          toast.success('Evento registrado localmente. Renove para sincronizar.');
        }
      }
    },
    [getRemoteToken, isGuestMode, persistGuest, persistRemoteCache, scheduleBackgroundSync, user]
  );

  const removeEvent = useCallback<CalendarContextValue['removeEvent']>(
    async id => {
      if (isGuestMode || !user) {
        setState(prev => {
          const events = prev.events.filter(event => event.id !== id);
          persistGuest(events);
          return { events };
        });
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteEventRemote(token, id);
        setState(prev => {
          const events = prev.events.filter(event => event.id !== id);
          persistRemoteCache(events);
          return { events };
        });
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover evento do calendário', error);
        if (isAccessDeniedError(error)) {
          setState(prev => {
            const events = prev.events.filter(event => event.id !== id);
            persistGuest(events);
            return { events };
          });
          toast.success('Evento removido localmente. Renove para sincronizar.');
        }
      }
    },
    [getRemoteToken, isGuestMode, persistGuest, persistRemoteCache, scheduleBackgroundSync, user]
  );

  const value = useMemo<CalendarContextValue>(
    () => ({
      ...state,
      loading,
      addEvent,
      removeEvent,
    }),
    [state, loading, addEvent, removeEvent]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

export { CalendarProvider, useCalendar };
