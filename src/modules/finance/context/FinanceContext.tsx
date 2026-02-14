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

import type {
  CategoriesState,
  CategoryGroup,
  Expense,
  FinanceContextValue,
  FinanceState,
  Income,
  Investment,
} from '../types/finance';
import {
  addCategoryRemote,
  createRecord,
  deleteRecord,
  getCategories,
  listRecords,
  removeCategoryRemote,
  updateRecord,
} from '../services/financeService';

const LOCAL_STORAGE_KEY = 'guest_finance_state';
const buildRemoteCacheKey = (uid: string) => `finance_remote_cache_${uid}`;

const initialState: FinanceState = {
  expenses: [],
  incomes: [],
  investments: [],
  categories: {
    expenses: ['Moradia', 'Alimentação', 'Transporte', 'Educação'],
    incomes: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
    investments: ['Renda fixa', 'Renda variável', 'Poupança', 'Fundo'],
  },
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

const mapExcludeFlag = <T extends { excludeFromTotals?: boolean }>(record: T) => ({
  ...record,
  excludeFromTotals: Boolean(record.excludeFromTotals),
});

const mapGuestState = (raw: Partial<FinanceState> | null | undefined): FinanceState => ({
  expenses: (raw?.expenses ?? []).map(mapExcludeFlag),
  incomes: (raw?.incomes ?? []).map(mapExcludeFlag),
  investments: (raw?.investments ?? []).map(mapExcludeFlag),
  categories: {
    expenses: raw?.categories?.expenses ?? initialState.categories.expenses,
    incomes: raw?.categories?.incomes ?? initialState.categories.incomes,
    investments: raw?.categories?.investments ?? initialState.categories.investments,
  },
});

const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

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

const sortByDateDesc = <T extends { date?: string }>(a: T, b: T) =>
  (b.date ?? '').localeCompare(a.date ?? '');

const mergeRecords = <T extends { id: string; date?: string }>(current: T[], updates: T[]) => {
  if (!updates.length) {
    return current;
  }
  const map = new Map(current.map(item => [item.id, item]));
  updates.forEach(item => map.set(item.id, item));
  return Array.from(map.values()).sort(sortByDateDesc);
};

const removeRecord = <T extends { id: string }>(current: T[], id: string) =>
  current.filter(item => item.id !== id);

const sumIncluded = <T extends { amount: number; excludeFromTotals?: boolean }>(items: T[]) =>
  items.reduce((acc, item) => (item.excludeFromTotals ? acc : acc + item.amount), 0);

function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const shouldUseLocalData = useLocalMode();
  const isGuestMode = shouldUseLocalData;
  const [state, setState] = useState<FinanceState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const persistGuestState = useCallback((next: FinanceState) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Erro ao salvar dados financeiros locais', error);
    }
  }, []);
  const persistRemoteCache = useCallback(
    (next: FinanceState) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Não foi possível armazenar cache remoto de finanças', error);
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
      const parsed = JSON.parse(stored) as Partial<FinanceState> | null;
      if (!parsed) {
        return null;
      }
      return mapGuestState(parsed);
    } catch (error) {
      console.warn('Não foi possível ler cache remoto de finanças', error);
      return null;
    }
  }, [user]);

  const loadGuestState = useCallback(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        setState(initialState);
        setIsLoading(false);
        return;
      }
      const parsed = JSON.parse(stored) as Partial<FinanceState> | null;
      const next = mapGuestState(parsed);
      setState(next);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros locais', error);
      setState(initialState);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteState = useCallback(async (): Promise<FinanceState> => {
    const token = await getRemoteToken();
    const [expensesResponse, incomesResponse, investmentsResponse, categoriesResponse] =
      await Promise.all([
        listRecords<Expense>(token, 'expenses'),
        listRecords<Income>(token, 'incomes'),
        listRecords<Investment>(token, 'investments'),
        getCategories(token),
      ]);
    const snapshot: FinanceState = {
      expenses: expensesResponse.items.map(mapExcludeFlag),
      incomes: incomesResponse.items.map(mapExcludeFlag),
      investments: investmentsResponse.items.map(item =>
        mapExcludeFlag({
          ...item,
          expectedReturn: item.expectedReturn ?? undefined,
        })
      ),
      categories: categoriesResponse ?? initialState.categories,
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
        console.error('Falha ao sincronizar dados em segundo plano', error);
      } finally {
        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    }, 2000);
  }, [fetchRemoteState, isGuestMode, user]);

  useEffect(() => {
    if (isGuestMode || !user) {
      setIsLoading(true);
      loadGuestState();
      return;
    }

    let active = true;
    setIsLoading(true);
    const cached = loadRemoteCache();
    if (cached) {
      setState(cached);
      setIsLoading(false);
    }
    fetchRemoteState()
      .then(snapshot => {
        if (active) {
          setState(snapshot);
          setIsLoading(false);
        }
      })
      .catch(error => {
        if (!active) {
          return;
        }
        if ((error as Error)?.message === LOCAL_MODE_ERROR) {
          loadGuestState();
          return;
        }
        if (isAccessDeniedError(error)) {
          toast.error('Sua assinatura está suspensa. Os dados serão mantidos localmente.');
          loadGuestState();
          return;
        }
        console.error('Erro ao carregar dados financeiros do servidor', error);
        toast.error('Não foi possível carregar seus dados financeiros agora.');
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchRemoteState, isGuestMode, loadGuestState, loadRemoteCache, user]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const updateGuestState = useCallback(
    (updater: (prev: FinanceState) => FinanceState) => {
      setState(prev => {
        const next = updater(prev);
        persistGuestState(next);
        return next;
      });
    },
    [persistGuestState]
  );

  const addExpense = useCallback<FinanceContextValue['addExpense']>(
    async (expense, options) => {
      const notifySuccess = () => {
        if (!options?.silent) {
          toast.success('Gasto registrado com sucesso');
        }
      };

      const registerLocally = () => {
        updateGuestState(prev => ({
          ...prev,
          expenses: [
            mapExcludeFlag({
              ...expense,
              id: generateId(),
            }),
            ...prev.expenses,
          ],
        }));
      };

      if (isGuestMode || !user) {
        registerLocally();
        notifySuccess();
        return;
      }
      try {
        const token = await getRemoteToken();
        const created = await createRecord<Expense>(token, 'expenses', expense);
        setState(prev => ({
          ...prev,
          expenses: mergeRecords(prev.expenses, created),
        }));
        notifySuccess();
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao registrar despesa', error);
        if (isAccessDeniedError(error)) {
          registerLocally();
          toast.success('Gasto registrado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao registrar gasto');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const addIncome = useCallback<FinanceContextValue['addIncome']>(
    async (income, options) => {
      const notifySuccess = () => {
        if (!options?.silent) {
          toast.success('Receita registrada com sucesso');
        }
      };

      const registerLocally = () => {
        updateGuestState(prev => ({
          ...prev,
          incomes: [
            mapExcludeFlag({
              ...income,
              id: generateId(),
            }),
            ...prev.incomes,
          ],
        }));
      };

      if (isGuestMode || !user) {
        registerLocally();
        notifySuccess();
        return;
      }
      try {
        const token = await getRemoteToken();
        const created = await createRecord<Income>(token, 'incomes', income);
        setState(prev => ({
          ...prev,
          incomes: mergeRecords(prev.incomes, created),
        }));
        notifySuccess();
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao registrar receita', error);
        if (isAccessDeniedError(error)) {
          registerLocally();
          toast.success('Receita registrada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao registrar receita');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const addInvestment = useCallback<FinanceContextValue['addInvestment']>(
    async (investment, options) => {
      const record: Omit<Investment, 'id'> = {
        ...investment,
        expectedReturn: investment.expectedReturn ?? undefined,
      };

      const notifySuccess = () => {
        if (!options?.silent) {
          toast.success('Investimento registrado com sucesso');
        }
      };

      const registerLocally = () => {
        updateGuestState(prev => ({
          ...prev,
          investments: [
            mapExcludeFlag({
              ...record,
              id: generateId(),
            }),
            ...prev.investments,
          ],
        }));
      };

      if (isGuestMode || !user) {
        registerLocally();
        notifySuccess();
        return;
      }
      try {
        const token = await getRemoteToken();
        const created = await createRecord<Investment>(token, 'investments', {
          ...record,
          expectedReturn: record.expectedReturn ?? undefined,
        });
        setState(prev => ({
          ...prev,
          investments: mergeRecords(
            prev.investments,
            created.map(normalizeInvestment)
          ),
        }));
        notifySuccess();
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao registrar investimento', error);
        if (isAccessDeniedError(error)) {
          registerLocally();
          toast.success('Investimento registrado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao registrar investimento');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const updateExpense = useCallback<FinanceContextValue['updateExpense']>(
    async (id, expense) => {
      const updateLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          expenses: prev.expenses.map(item => (item.id === id ? { ...expense, id } : item)),
        }));
      };

      if (isGuestMode || !user) {
        updateLocal();
        toast.success('Gasto atualizado');
        return;
      }

      try {
        const token = await getRemoteToken();
        const updated = await updateRecord<Expense>(token, 'expenses', id, expense);
        setState(prev => ({
          ...prev,
          expenses: mergeRecords(prev.expenses, [{ ...updated, id }]),
        }));
        toast.success('Gasto atualizado');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar despesa', error);
        if (isAccessDeniedError(error)) {
          updateLocal();
          toast.success('Gasto atualizado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao atualizar gasto');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const updateIncome = useCallback<FinanceContextValue['updateIncome']>(
    async (id, income) => {
      const updateLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          incomes: prev.incomes.map(item => (item.id === id ? { ...income, id } : item)),
        }));
      };

      if (isGuestMode || !user) {
        updateLocal();
        toast.success('Receita atualizada');
        return;
      }

      try {
        const token = await getRemoteToken();
        const updated = await updateRecord<Income>(token, 'incomes', id, income);
        setState(prev => ({
          ...prev,
          incomes: mergeRecords(prev.incomes, [{ ...updated, id }]),
        }));
        toast.success('Receita atualizada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar receita', error);
        if (isAccessDeniedError(error)) {
          updateLocal();
          toast.success('Receita atualizada localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao atualizar receita');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const updateInvestment = useCallback<FinanceContextValue['updateInvestment']>(
    async (id, investment) => {
      const payload = {
        ...investment,
        expectedReturn: investment.expectedReturn ?? undefined,
      };

      const updateLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          investments: prev.investments.map(item => (item.id === id ? { ...payload, id } : item)),
        }));
      };

      if (isGuestMode || !user) {
        updateLocal();
        toast.success('Investimento atualizado');
        return;
      }

      try {
        const token = await getRemoteToken();
        const updated = await updateRecord<Investment>(token, 'investments', id, {
          ...payload,
          expectedReturn: payload.expectedReturn ?? undefined,
        });
        setState(prev => ({
          ...prev,
          investments: mergeRecords(prev.investments, [normalizeInvestment(updated)]),
        }));
        toast.success('Investimento atualizado');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao atualizar investimento', error);
        if (isAccessDeniedError(error)) {
          updateLocal();
          toast.success('Investimento atualizado localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao atualizar investimento');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const deleteExpense = useCallback<FinanceContextValue['deleteExpense']>(
    async id => {
      const removeLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          expenses: prev.expenses.filter(item => item.id !== id),
        }));
      };

      if (isGuestMode || !user) {
        removeLocal();
        toast.success('Gasto removido');
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteRecord(token, 'expenses', id);
        setState(prev => ({
          ...prev,
          expenses: removeRecord(prev.expenses, id),
        }));
        toast.success('Gasto removido');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover despesa', error);
        if (isAccessDeniedError(error)) {
          removeLocal();
          toast.success('Gasto removido localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao remover gasto');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const deleteIncome = useCallback<FinanceContextValue['deleteIncome']>(
    async id => {
      const removeLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          incomes: prev.incomes.filter(item => item.id !== id),
        }));
      };

      if (isGuestMode || !user) {
        removeLocal();
        toast.success('Receita removida');
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteRecord(token, 'incomes', id);
        setState(prev => ({
          ...prev,
          incomes: removeRecord(prev.incomes, id),
        }));
        toast.success('Receita removida');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover receita', error);
        if (isAccessDeniedError(error)) {
          removeLocal();
          toast.success('Receita removida localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao remover receita');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const deleteInvestment = useCallback<FinanceContextValue['deleteInvestment']>(
    async id => {
      const removeLocal = () => {
        updateGuestState(prev => ({
          ...prev,
          investments: prev.investments.filter(item => item.id !== id),
        }));
      };

      if (isGuestMode || !user) {
        removeLocal();
        toast.success('Investimento removido');
        return;
      }

      try {
        const token = await getRemoteToken();
        await deleteRecord(token, 'investments', id);
        setState(prev => ({
          ...prev,
          investments: removeRecord(prev.investments, id),
        }));
        toast.success('Investimento removido');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover investimento', error);
        if (isAccessDeniedError(error)) {
          removeLocal();
          toast.success('Investimento removido localmente. Renove para sincronizar.');
          return;
        }
        toast.error('Erro ao remover investimento');
      }
    },
    [getRemoteToken, isGuestMode, scheduleBackgroundSync, updateGuestState, user]
  );

  const addCategory = useCallback<FinanceContextValue['addCategory']>(
    async (group, category) => {
      const normalized = category.trim();
      if (!normalized) {
        toast.error('Informe um nome válido');
        return;
      }

      const addLocalCategory = () => {
        let added = false;
        setState(prev => {
          if (prev.categories[group].some(item => item.toLowerCase() === normalized.toLowerCase())) {
            toast.error('Categoria já cadastrada');
            return prev;
          }
          added = true;
          const next: FinanceState = {
            ...prev,
            categories: {
              ...prev.categories,
              [group]: [normalized, ...prev.categories[group]],
            },
          };
          persistGuestState(next);
          return next;
        });
        if (added) {
          toast.success('Categoria adicionada');
        }
        return added;
      };

      if (isGuestMode || !user) {
        addLocalCategory();
        return;
      }

      try {
        const token = await getRemoteToken();
        await addCategoryRemote(token, group, normalized);
        setState(prev => {
          if (prev.categories[group].some(item => item.toLowerCase() === normalized.toLowerCase())) {
            return prev;
          }
          return {
            ...prev,
            categories: {
              ...prev.categories,
              [group]: [normalized, ...prev.categories[group]],
            },
          };
        });
        toast.success('Categoria adicionada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao salvar categoria', error);
        if (isAccessDeniedError(error)) {
          const added = addLocalCategory();
          if (added) {
            toast.success('Categoria salva localmente. Renove para sincronizar.');
          }
          return;
        }
        toast.error('Erro ao cadastrar categoria');
      }
    },
    [getRemoteToken, isGuestMode, persistGuestState, scheduleBackgroundSync, user]
  );

  const removeCategory = useCallback<FinanceContextValue['removeCategory']>(
    async (group, category) => {
      const removeLocalCategory = () => {
        let removed = false;
        setState(prev => {
          if (!prev.categories[group].includes(category)) {
            toast.error('Categoria não encontrada');
            return prev;
          }
          removed = true;
          const next: FinanceState = {
            ...prev,
            categories: {
              ...prev.categories,
              [group]: prev.categories[group].filter(item => item !== category),
            },
          };
          persistGuestState(next);
          return next;
        });
        if (removed) {
          toast.success('Categoria removida');
        }
        return removed;
      };

      if (isGuestMode || !user) {
        removeLocalCategory();
        return;
      }

      try {
        const token = await getRemoteToken();
        await removeCategoryRemote(token, group, category);
        setState(prev => ({
          ...prev,
          categories: {
            ...prev.categories,
            [group]: prev.categories[group].filter(item => item !== category),
          },
        }));
        toast.success('Categoria removida');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Erro ao remover categoria', error);
        if (isAccessDeniedError(error)) {
          const removed = removeLocalCategory();
          if (removed) {
            toast.success('Categoria removida localmente. Renove para sincronizar.');
          }
          return;
        }
        toast.error('Erro ao remover categoria');
      }
    },
    [getRemoteToken, isGuestMode, persistGuestState, scheduleBackgroundSync, user]
  );

  const getBalanceSnapshot = () => {
    const totalExpenses = sumIncluded(state.expenses);

    const totalIncomes = sumIncluded(state.incomes);
    const totalInvestments = sumIncluded(state.investments);

    return {
      totalExpenses,
      totalIncomes,
      totalInvestments,
      netBalance: totalIncomes - totalExpenses,
    };
  };

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      loading: isLoading,
      addCategory,
      addExpense,
      addIncome,
      addInvestment,
      updateExpense,
      updateIncome,
      updateInvestment,
      deleteExpense,
      deleteIncome,
      deleteInvestment,
      getBalanceSnapshot,
      removeCategory,
    }),
    [
      state,
      isLoading,
      addCategory,
      addExpense,
      addIncome,
      addInvestment,
      updateExpense,
      updateIncome,
      updateInvestment,
      deleteExpense,
      deleteIncome,
      deleteInvestment,
      removeCategory,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

function useFinance() {
  const context = useContext(FinanceContext);

  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }

  return context;
}

export { FinanceProvider, useFinance };
const normalizeInvestment = (item: Investment): Investment => ({
  ...item,
  expectedReturn: item.expectedReturn ?? undefined,
});
