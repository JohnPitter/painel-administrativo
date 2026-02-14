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
import { generateId } from '@shared/utils/id';
import type { ApiError } from '@shared/services/apiClient';

import { createNote, deleteNoteRemote, listNotes, updateNoteRemote } from '../services/notesService';
import type { Note, NotesContextValue, NotesState } from '../types/notes';

const LOCAL_STORAGE_KEY = 'guest_notes_state';
const REMOTE_CACHE_PREFIX = 'notes_remote_state';
const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

const initialState: NotesState = {
  notes: [],
};

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

const sortNotes = (notes: Note[]) =>
  [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

const mapGuestState = (raw: Partial<NotesState> | null | undefined): NotesState => ({
  notes: sortNotes(
    (raw?.notes ?? []).map(note => ({
      ...note,
      content: note.content ?? '',
      tags: Array.isArray(note.tags) ? note.tags : [],
      pinned: note.pinned ?? false,
    }))
  ),
});

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

function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [state, setState] = useState<NotesState>(initialState);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const persistGuestState = useCallback((next: NotesState) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Erro ao salvar notas locais', error);
    }
  }, []);

  const updateGuestState = useCallback(
    (updater: (prev: NotesState) => NotesState) => {
      setState(prev => {
        const next = updater(prev);
        persistGuestState(next);
        return next;
      });
    },
    [persistGuestState]
  );

  const loadGuestState = useCallback(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        setState(initialState);
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(stored) as Partial<NotesState> | null;
      setState(mapGuestState(parsed));
    } catch (error) {
      console.error('Erro ao carregar notas locais', error);
      setState(initialState);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistRemoteCache = useCallback(
    (next: NotesState) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Não foi possível salvar cache remoto das notas', error);
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
      const parsed = JSON.parse(stored) as Partial<NotesState> | null;
      if (!parsed) {
        return null;
      }
      return mapGuestState(parsed);
    } catch (error) {
      console.warn('Não foi possível carregar cache remoto das notas', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteState = useCallback(async (): Promise<NotesState> => {
    const token = await getRemoteToken();
    const response = await listNotes(token);
    const snapshot: NotesState = {
      notes: sortNotes(response.notes ?? []),
    };
    persistRemoteCache(snapshot);
    return snapshot;
  }, [getRemoteToken, persistRemoteCache]);

  const scheduleBackgroundSync = useCallback(() => {
    if (typeof window === 'undefined' || isGuestMode || !user) {
      return;
    }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const snapshot = await fetchRemoteState();
        setState(snapshot);
      } catch (error) {
        console.error('Falha ao sincronizar notas em segundo plano', error);
      } finally {
        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    }, 2000);
  }, [fetchRemoteState, isGuestMode, user]);

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
      loadGuestState();
      return;
    }

    let active = true;
    setLoading(true);
    const cached = loadRemoteCache();
    if (cached) {
      setState(cached);
      setLoading(false);
    }

    fetchRemoteState()
      .then(snapshot => {
        if (!active) {
          return;
        }
        setState(snapshot);
        setLoading(false);
      })
      .catch(error => {
        if (!active) {
          return;
        }
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestState();
          toast.error('Sua assinatura está suspensa. As notas ficarão apenas neste dispositivo.');
          return;
        }
        console.error('Erro ao carregar notas do servidor', error);
        toast.error('Não foi possível carregar suas notas agora.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchRemoteState, isGuestMode, loadGuestState, loadRemoteCache, user]);

  const addNote: NotesContextValue['addNote'] = useCallback(
    async data => {
      const now = new Date().toISOString();
      const payload: Omit<Note, 'id'> = {
        title: data.title,
        content: data.content,
        tags: data.tags,
        pinned: data.pinned ?? false,
        createdAt: now,
        updatedAt: now,
      };

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          notes: sortNotes([
            ...prev.notes,
            {
              ...payload,
              id: generateId(),
            },
          ]),
        }));
        toast.success('Nota criada');
        return;
      }

      try {
        const token = await getRemoteToken();
        const response = await createNote(token, payload);
        setState(prev => ({
          notes: sortNotes([...prev.notes, response.note]),
        }));
        toast.success('Nota criada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao criar nota', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            notes: sortNotes([
              ...prev.notes,
              {
                ...payload,
                id: generateId(),
              },
            ]),
          }));
          toast.success('Nota registrada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível criar a nota');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const updateNote: NotesContextValue['updateNote'] = useCallback(
    async (id, data) => {
      const now = new Date().toISOString();
      const normalized: Partial<Omit<Note, 'id'>> = {
        ...data,
        updatedAt: now,
      };

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          notes: sortNotes(
            prev.notes.map(note =>
              note.id === id
                ? {
                    ...note,
                    ...normalized,
                  }
                : note
            )
          ),
        }));
        toast.success('Nota atualizada');
        return;
      }

      try {
        const token = await getRemoteToken();
        await updateNoteRemote(token, id, normalized);
        setState(prev => ({
          notes: sortNotes(
            prev.notes.map(note =>
              note.id === id
                ? {
                    ...note,
                    ...normalized,
                  }
                : note
            )
          ),
        }));
        toast.success('Nota atualizada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar nota', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            notes: sortNotes(
              prev.notes.map(note =>
                note.id === id
                  ? {
                      ...note,
                      ...normalized,
                    }
                  : note
              )
            ),
          }));
          toast.success('Nota atualizada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível atualizar a nota');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const deleteNote: NotesContextValue['deleteNote'] = useCallback(
    async id => {
      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          notes: prev.notes.filter(note => note.id !== id),
        }));
        toast.success('Nota removida');
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteNoteRemote(token, id);
        setState(prev => ({
          notes: prev.notes.filter(note => note.id !== id),
        }));
        toast.success('Nota removida');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover nota', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            notes: prev.notes.filter(note => note.id !== id),
          }));
          toast.success('Nota removida localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível remover a nota');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const togglePinned: NotesContextValue['togglePinned'] = useCallback(
    async id => {
      const target = state.notes.find(note => note.id === id);
      if (!target) {
        return;
      }

      const nextPinned = !target.pinned;

      if (isGuestMode || !user) {
        updateGuestState(prev => ({
          notes: sortNotes(
            prev.notes.map(note =>
              note.id === id
                ? {
                    ...note,
                    pinned: nextPinned,
                    updatedAt: new Date().toISOString(),
                  }
                : note
            )
          ),
        }));
        toast.success(nextPinned ? 'Nota fixada' : 'Nota desafixada');
        return;
      }

      try {
        const token = await getRemoteToken();
        await updateNoteRemote(token, id, { pinned: nextPinned, updatedAt: new Date().toISOString() });
        setState(prev => ({
          notes: sortNotes(
            prev.notes.map(note =>
              note.id === id
                ? {
                    ...note,
                    pinned: nextPinned,
                  }
                : note
            )
          ),
        }));
        toast.success(nextPinned ? 'Nota fixada' : 'Nota desafixada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar nota', error);
        if (isAccessDeniedError(error)) {
          updateGuestState(prev => ({
            notes: sortNotes(
              prev.notes.map(note =>
                note.id === id
                  ? {
                      ...note,
                      pinned: nextPinned,
                      updatedAt: new Date().toISOString(),
                    }
                  : note
              )
            )
          }));
          toast.success('Nota atualizada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Não foi possível atualizar o status da nota');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, state.notes, updateGuestState, user]
  );

  const value = useMemo<NotesContextValue>(
    () => ({
      ...state,
      loading,
      addNote,
      updateNote,
      deleteNote,
      togglePinned,
    }),
    [state, loading, addNote, deleteNote, togglePinned, updateNote]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes deve ser usado dentro de NotesProvider');
  }
  return context;
}

export { NotesProvider, useNotes };
