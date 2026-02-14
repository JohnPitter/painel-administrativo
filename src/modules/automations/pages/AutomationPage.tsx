import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { DashboardLayout } from '@core/layout/DashboardLayout';
import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import type { ApiError } from '@shared/services/apiClient';
import {
  createAutomation,
  deleteAutomation as deleteAutomationRemote,
  listAutomations,
  updateAutomation,
  type AutomationRuleInput,
  type AutomationRuleResponse,
} from '@modules/automations/services/automationService';

import styles from './AutomationPage.module.css';

type AutomationEventSource =
  | 'Financeiro'
  | 'Tarefas'
  | 'Calendário'
  | 'Relacionamentos'
  | 'Foco'
  | 'Manual';

type AutomationConditionComparator = 'Maior que' | 'Menor que' | 'Igual a' | 'Contém' | 'Sempre';
type AutomationActionType = 'Criar tarefa' | 'Adicionar nota' | 'Enviar alerta' | 'Registrar follow-up';

const EVENT_SOURCES: AutomationEventSource[] = [
  'Financeiro',
  'Tarefas',
  'Calendário',
  'Relacionamentos',
  'Foco',
  'Manual',
];
const CONDITION_COMPARATORS: AutomationConditionComparator[] = [
  'Sempre',
  'Maior que',
  'Menor que',
  'Igual a',
  'Contém',
];
const ACTION_TYPES: AutomationActionType[] = [
  'Criar tarefa',
  'Adicionar nota',
  'Enviar alerta',
  'Registrar follow-up',
];

interface AutomationRule {
  id: string;
  name: string;
  active: boolean;
  source: AutomationEventSource;
  event: string;
  condition: AutomationConditionComparator;
  conditionValue?: string;
  action: AutomationActionType;
  actionPayload?: string;
  lastRun?: string;
  runCount: number;
  createdAt: string;
}

const STORAGE_KEY = 'admin_panel_automations';
const REMOTE_CACHE_PREFIX = 'admin_panel_automations_remote';
const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';

const defaultEventsBySource: Record<AutomationEventSource, string[]> = {
  Financeiro: ['Nova despesa', 'Receita registrada', 'Investimento abaixo do planejado'],
  Tarefas: ['Tarefa atrasada', 'Pomodoro concluído', 'Meta semanal atingida'],
  Calendário: ['Evento hoje', 'Compromisso cancelado', 'Semana com mais de 5 eventos'],
  Relacionamentos: ['Follow-up pendente', 'Contato em negociação', 'Contato sem interação há 30 dias'],
  Foco: ['Sequência de 4 pomodoros', 'Interrupção registrada', 'Sessão Deep Work concluída'],
  Manual: ['Execução agendada', 'Execução manual'],
};

const isEventSource = (value: string): value is AutomationEventSource =>
  EVENT_SOURCES.includes(value as AutomationEventSource);
const isComparator = (value: string): value is AutomationConditionComparator =>
  CONDITION_COMPARATORS.includes(value as AutomationConditionComparator);
const isActionType = (value: string): value is AutomationActionType =>
  ACTION_TYPES.includes(value as AutomationActionType);

const normalizeAutomation = (rule: AutomationRule): AutomationRule => ({
  ...rule,
  createdAt: rule.createdAt ?? new Date().toISOString(),
});
const sortAutomations = (rules: AutomationRule[]) =>
  [...rules].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
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

const mapRemoteAutomation = (rule: AutomationRuleResponse): AutomationRule => {
  const source = isEventSource(rule.source) ? rule.source : 'Manual';
  const condition = isComparator(rule.condition) ? rule.condition : 'Sempre';
  const action = isActionType(rule.action) ? rule.action : 'Criar tarefa';

  return normalizeAutomation({
    id: rule.id,
    name: rule.name,
    active: typeof rule.active === 'boolean' ? rule.active : true,
    source,
    event: rule.event ?? defaultEventsBySource[source][0],
    condition,
    conditionValue: condition === 'Sempre' ? undefined : rule.conditionValue,
    action,
    actionPayload: rule.actionPayload ?? undefined,
    lastRun: rule.lastRun,
    runCount: typeof rule.runCount === 'number' ? rule.runCount : 0,
    createdAt: rule.createdAt ?? rule.lastRun ?? new Date().toISOString(),
  });
};

const AutomationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const persistGuestAutomations = useCallback((next: AutomationRule[]) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Falha ao salvar automações', error);
    }
  }, []);

  const updateGuestAutomations = useCallback(
    (updater: (prev: AutomationRule[]) => AutomationRule[]) => {
      setAutomations(prev => {
        const next = sortAutomations(updater(prev).map(normalizeAutomation));
        persistGuestAutomations(next);
        return next;
      });
    },
    [persistGuestAutomations]
  );

  const loadGuestAutomations = useCallback(() => {
    if (typeof window === 'undefined') {
      setAutomations([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setAutomations([]);
      } else {
        const parsed = JSON.parse(stored) as AutomationRule[];
        setAutomations(sortAutomations(parsed.map(normalizeAutomation)));
      }
    } catch (error) {
      console.error('Falha ao carregar automações salvas', error);
      setAutomations([]);
    }
  }, []);

  const persistRemoteAutomations = useCallback(
    (next: AutomationRule[]) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Falha ao salvar cache remoto de automações', error);
      }
    },
    [user]
  );

  const loadRemoteAutomations = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(buildRemoteCacheKey(user.uid));
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as AutomationRule[] | null;
      if (!parsed) {
        return null;
      }
      return sortAutomations(parsed.map(normalizeAutomation));
    } catch (error) {
      console.warn('Falha ao carregar cache remoto de automações', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteAutomations = useCallback(async () => {
    const token = await getRemoteToken();
    const response = await listAutomations(token);
    const normalized = sortAutomations((response.automations ?? []).map(mapRemoteAutomation));
    setAutomations(normalized);
    persistRemoteAutomations(normalized);
  }, [getRemoteToken, persistRemoteAutomations]);

  const scheduleBackgroundSync = useCallback(() => {
    if (typeof window === 'undefined' || isGuestMode || !user) {
      return;
    }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      fetchRemoteAutomations().catch(error =>
        console.error('Falha ao sincronizar automações em segundo plano', error)
      );
    }, 2000);
  }, [fetchRemoteAutomations, isGuestMode, user]);

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
      loadGuestAutomations();
      setLoading(false);
      return;
    }

    setLoading(true);
    const cached = loadRemoteAutomations();
    if (cached) {
      setAutomations(cached);
      setLoading(false);
    }

    fetchRemoteAutomations()
      .then(() => setLoading(false))
      .catch(error => {
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestAutomations();
          setLoading(false);
          toast.error('Sua assinatura está suspensa. As automações funcionarão apenas localmente.');
          return;
        }
        console.error('Erro ao carregar automações do servidor', error);
        setLoading(false);
      });
  }, [fetchRemoteAutomations, isGuestMode, loadGuestAutomations, loadRemoteAutomations, user]);

  const [form, setForm] = useState({
    name: '',
    source: 'Financeiro' as AutomationEventSource,
    event: defaultEventsBySource['Financeiro'][0],
    condition: 'Sempre' as AutomationConditionComparator,
    conditionValue: '',
    action: 'Criar tarefa' as AutomationActionType,
    actionPayload: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateAutomation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Dê um nome para a automação.');
      return;
    }
    if (form.condition !== 'Sempre' && !form.conditionValue.trim()) {
      setFormError('Informe o valor usado na condição.');
      return;
    }
    if (form.actionPayload.trim().length === 0) {
      setFormError('Descreva o que deve acontecer na ação.');
      return;
    }
    setFormError(null);
    const now = new Date().toISOString();
    const payload: AutomationRuleInput = {
      name: form.name.trim(),
      active: true,
      source: form.source,
      event: form.event,
      condition: form.condition,
      conditionValue: form.condition === 'Sempre' ? undefined : form.conditionValue.trim(),
      action: form.action,
      actionPayload: form.actionPayload.trim(),
      runCount: 0,
      createdAt: now,
    };
    const fallbackRule: AutomationRule = normalizeAutomation({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      ...payload,
    } as AutomationRule);

    if (isGuestMode || !user) {
      updateGuestAutomations(prev => [fallbackRule, ...prev]);
      toast.success('Automação criada');
    } else {
      try {
        const token = await getRemoteToken();
        const response = await createAutomation(token, payload);
        setAutomations(prev => {
          const next = sortAutomations([mapRemoteAutomation(response.automation), ...prev]);
          persistRemoteAutomations(next);
          return next;
        });
        toast.success('Automação criada');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Falha ao criar automação', error);
        if (isAccessDeniedError(error)) {
          updateGuestAutomations(prev => [fallbackRule, ...prev]);
          toast.success('Automação registrada localmente. Renove para sincronizar.');
        } else {
          toast.error('Não foi possível criar a automação');
        }
      }
    }

    setForm(prev => ({
      ...prev,
      name: '',
      event: defaultEventsBySource[prev.source][0],
      condition: 'Sempre',
      conditionValue: '',
      actionPayload: '',
    }));
  };

  const toggleAutomation = async (automationId: string) => {
    const target = automations.find(rule => rule.id === automationId);
    if (!target) {
      return;
    }

    if (isGuestMode || !user) {
      updateGuestAutomations(prev =>
        prev.map(rule => (rule.id === automationId ? { ...rule, active: !rule.active } : rule))
      );
      return;
    }

    try {
      const token = await getRemoteToken();
      await updateAutomation(token, automationId, { active: !target.active });
      setAutomations(prev => {
        const next = prev.map(rule =>
          rule.id === automationId ? { ...rule, active: !target.active } : rule
        );
        persistRemoteAutomations(next);
        return next;
      });
      scheduleBackgroundSync();
    } catch (error) {
      console.error('Falha ao atualizar automação', error);
      if (isAccessDeniedError(error)) {
        updateGuestAutomations(prev =>
          prev.map(rule => (rule.id === automationId ? { ...rule, active: !target.active } : rule))
        );
        toast.success('Automação atualizada localmente. Renove para sincronizar.');
      } else {
        toast.error('Não foi possível atualizar a automação');
      }
    }
  };

  const simulateRun = async (automationId: string) => {
    const target = automations.find(rule => rule.id === automationId);
    if (!target) {
      return;
    }
    const updates = {
      lastRun: new Date().toISOString(),
      runCount: target.runCount + 1,
    };

    if (isGuestMode || !user) {
      updateGuestAutomations(prev =>
        prev.map(rule => (rule.id === automationId ? { ...rule, ...updates } : rule))
      );
      return;
    }

    try {
      const token = await getRemoteToken();
      await updateAutomation(token, automationId, updates);
      setAutomations(prev => {
        const next = prev.map(rule => (rule.id === automationId ? { ...rule, ...updates } : rule));
        persistRemoteAutomations(next);
        return next;
      });
      scheduleBackgroundSync();
    } catch (error) {
      console.error('Falha ao simular automação', error);
      if (isAccessDeniedError(error)) {
        updateGuestAutomations(prev =>
          prev.map(rule =>
            rule.id === automationId ? { ...rule, lastRun: updates.lastRun, runCount: updates.runCount } : rule
          )
        );
        toast.success('Execução registrada localmente. Renove para sincronizar.');
      } else {
        toast.error('Não foi possível registrar a execução');
      }
    }
  };

  const deleteAutomation = async (automationId: string) => {
    if (isGuestMode || !user) {
      updateGuestAutomations(prev => prev.filter(rule => rule.id !== automationId));
      return;
    }

    try {
      const token = await getRemoteToken();
      await deleteAutomationRemote(token, automationId);
      setAutomations(prev => {
        const next = prev.filter(rule => rule.id !== automationId);
        persistRemoteAutomations(next);
        return next;
      });
      scheduleBackgroundSync();
    } catch (error) {
      console.error('Falha ao remover automação', error);
      if (isAccessDeniedError(error)) {
        updateGuestAutomations(prev => prev.filter(rule => rule.id !== automationId));
        toast.success('Automação removida localmente. Renove para sincronizar.');
      } else {
        toast.error('Não foi possível remover a automação');
      }
    }
  };

  const metrics = useMemo(() => {
    const active = automations.filter(rule => rule.active).length;
    const totalRuns = automations.reduce((acc, rule) => acc + rule.runCount, 0);
    const lastRun = automations
      .filter(rule => rule.lastRun)
      .map(rule => new Date(rule.lastRun ?? 0).getTime())
      .sort((a, b) => b - a)[0];

    return {
      total: automations.length,
      active,
      inactive: automations.length - active,
      totalRuns,
      lastRun: lastRun ? new Date(lastRun).toLocaleString('pt-BR') : 'Nunca executado',
    };
  }, [automations]);

  const availableEvents = defaultEventsBySource[form.source];

  if (loading && automations.length === 0) {
    return (
      <DashboardLayout
        title="Central de automações"
        subtitle="Conecte seus módulos com regras simples e gatilhos inteligentes."
        actions={
          <button className={styles.backButton} type="button" onClick={() => navigate('/dashboard')}>
            ← Voltar para aplicativos
          </button>
        }
      >
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p>Sincronizando suas automações...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Central de automações"
      subtitle="Conecte seus módulos com regras simples e mantenha alertas inteligentes funcionando para você."
      actions={
        <button className={styles.backButton} type="button" onClick={() => navigate('/dashboard')}>
          ← Voltar para aplicativos
        </button>
      }
    >
      <section className={styles.metricsGrid}>
        <article>
          <span>Automações criadas</span>
          <strong>{metrics.total}</strong>
        </article>
        <article>
          <span>Ativas agora</span>
          <strong>{metrics.active}</strong>
        </article>
        <article>
          <span>Execuções totais</span>
          <strong>{metrics.totalRuns}</strong>
        </article>
        <article>
          <span>Última execução</span>
          <strong>{metrics.lastRun}</strong>
        </article>
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <header>
            <div>
              <h2>Criar nova regra</h2>
              <p>Combine um gatilho com uma ação automática.</p>
            </div>
          </header>
          <form className={styles.form} onSubmit={handleCreateAutomation}>
            <label>
              Nome da automação
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Ex: Alertar gastos acima de R$ 500"
                required
              />
            </label>

            <div className={styles.formRow}>
              <label>
                Origem do evento
                <select
                  value={form.source}
                  onChange={event =>
                    setForm(prev => ({
                      ...prev,
                      source: event.target.value as AutomationEventSource,
                      event: defaultEventsBySource[event.target.value as AutomationEventSource][0],
                    }))
                  }
                >
                  {Object.keys(defaultEventsBySource).map(source => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evento
                <select
                  value={form.event}
                  onChange={event => setForm(prev => ({ ...prev, event: event.target.value }))}
                >
                  {availableEvents.map(event => (
                    <option key={event} value={event}>
                      {event}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.formRow}>
              <label>
                Condição
                <select
                  value={form.condition}
                  onChange={event =>
                    setForm(prev => ({
                      ...prev,
                      condition: event.target.value as AutomationConditionComparator,
                    }))
                  }
                >
                  <option value="Sempre">Sempre</option>
                  <option value="Maior que">Maior que</option>
                  <option value="Menor que">Menor que</option>
                  <option value="Igual a">Igual a</option>
                  <option value="Contém">Contém</option>
                </select>
              </label>
              {form.condition !== 'Sempre' && (
                <label>
                  Valor da condição
                  <input
                    type="text"
                    value={form.conditionValue}
                    onChange={event => setForm(prev => ({ ...prev, conditionValue: event.target.value }))}
                    placeholder="Ex: 500"
                  />
                </label>
              )}
            </div>

            <div className={styles.formRow}>
              <label>
                Ação
                <select
                  value={form.action}
                  onChange={event =>
                    setForm(prev => ({ ...prev, action: event.target.value as AutomationActionType }))
                  }
                >
                  {ACTION_TYPES.map(action => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Detalhes da ação
                <input
                  type="text"
                  value={form.actionPayload}
                  onChange={event => setForm(prev => ({ ...prev, actionPayload: event.target.value }))}
                  placeholder="Ex: Criar tarefa no quadro pessoal"
                />
              </label>
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}

            <button type="submit" className={styles.primaryButton}>
              Salvar automação
            </button>
          </form>
        </article>

        <article className={styles.panel}>
          <header>
            <div>
              <h2>Playbooks sugeridos</h2>
              <p>Atalhos para começar rápido.</p>
            </div>
          </header>
          <ul className={styles.presets}>
            {presetIdeas.map(preset => (
              <li key={preset.name}>
                <div>
                  <strong>{preset.name}</strong>
                  <p>{preset.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      name: preset.name,
                      source: preset.source,
                      event: preset.event,
                      condition: preset.condition,
                      conditionValue: preset.conditionValue ?? '',
                      action: preset.action,
                      actionPayload: preset.actionPayload,
                    })
                  }
                >
                  Usar modelo
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.automationTable}>
        <header>
          <div>
            <h2>Automações configuradas</h2>
            <p>Gerencie o status e simule execuções para testar.</p>
          </div>
        </header>

        {automations.length === 0 ? (
          <div className={styles.emptyState}>Nenhuma automação criada ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Evento</th>
                <th>Condição</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Última execução</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {automations.map(rule => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.name}</strong>
                    <span>{rule.source}</span>
                  </td>
                  <td>
                    <span>{rule.event}</span>
                  </td>
                  <td>
                    {rule.condition === 'Sempre' ? (
                      <span>Sempre</span>
                    ) : (
                      <>
                        <span>{rule.condition}</span>
                        <small>{rule.conditionValue}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <span>{rule.action}</span>
                    <small>{rule.actionPayload}</small>
                  </td>
                  <td>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={() => {
                          void toggleAutomation(rule.id);
                        }}
                      />
                      <span />
                    </label>
                  </td>
                  <td>
                    {rule.lastRun ? (
                      <>
                        <span>{new Date(rule.lastRun).toLocaleDateString('pt-BR')}</span>
                        <small>{rule.runCount} execuções</small>
                      </>
                    ) : (
                      <span>Nunca</span>
                    )}
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() => {
                        void simulateRun(rule.id);
                      }}
                    >
                      Simular
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteAutomation(rule.id);
                      }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </DashboardLayout>
  );
};

const presetIdeas: Array<{
  name: string;
  description: string;
  source: AutomationEventSource;
  event: string;
  condition: AutomationConditionComparator;
  conditionValue?: string;
  action: AutomationActionType;
  actionPayload: string;
}> = [
  {
    name: 'Alertar gasto acima de R$ 500',
    description: 'Cria tarefa de revisão quando uma despesa for maior que R$ 500.',
    source: 'Financeiro',
    event: 'Nova despesa',
    condition: 'Maior que',
    conditionValue: '500',
    action: 'Criar tarefa',
    actionPayload: 'Criar tarefa no quadro pessoal para revisar gasto',
  },
  {
    name: 'Follow-up automático',
    description: 'Adiciona nota quando um relacionamento fica 30 dias sem contato.',
    source: 'Relacionamentos',
    event: 'Contato sem interação há 30 dias',
    condition: 'Sempre',
    action: 'Adicionar nota',
    actionPayload: 'Registrar nota e preparar roteiro do follow-up',
  },
  {
    name: 'Recompensa de foco',
    description: 'Envia alerta quando completar 4 pomodoros seguidos.',
    source: 'Foco',
    event: 'Sequência de 4 pomodoros',
    condition: 'Sempre',
    action: 'Enviar alerta',
    actionPayload: 'Enviar alerta de recompensa e recompor energia',
  },
];

export { AutomationPage };
const buildRemoteCacheKey = (uid: string) => `${REMOTE_CACHE_PREFIX}_${uid}`;
