import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { DashboardLayout } from '@core/layout/DashboardLayout';
import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import type { ApiError } from '@shared/services/apiClient';
import {
  addInteractionRemote,
  createContact,
  listContacts,
  updateContact as updateContactRemote,
  type RelationshipContact,
  type RelationshipContactInput,
  type RelationshipInteraction,
  type RelationshipInteractionInput,
  type RelationshipPriority,
  type RelationshipStage,
} from '@modules/relationships/services/relationshipService';

import styles from './RelationshipPage.module.css';

const STORAGE_KEY = 'admin_panel_relationship_contacts';

const stageOptions: RelationshipStage[] = ['Contato inicial', 'Oportunidade', 'Negociação', 'Fidelizado'];
const priorityOptions: RelationshipPriority[] = ['Alta', 'Média', 'Baixa'];
const channelOptions: RelationshipInteraction['channel'][] = [
  'Ligação',
  'Reunião',
  'E-mail',
  'Mensagem',
  'Anotação',
];

const normalizeContact = (contact: RelationshipContact): RelationshipContact => ({
  ...contact,
  tags: contact.tags ?? [],
  interactions: contact.interactions ?? [],
});

const LOCAL_MODE_ERROR = 'LOCAL_MODE_ONLY';
const buildRemoteCacheKey = (uid: string) => `${STORAGE_KEY}_remote_${uid}`;

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

const RelationshipPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuestMode = useLocalMode();
  const [contacts, setContacts] = useState<RelationshipContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<RelationshipStage | 'Todos'>('Todos');
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const persistGuestContacts = useCallback((next: RelationshipContact[]) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Falha ao salvar relacionamentos', error);
    }
  }, []);

  const updateGuestContacts = useCallback(
    (updater: (prev: RelationshipContact[]) => RelationshipContact[]) => {
      setContacts(prev => {
        const next = updater(prev).map(normalizeContact);
        persistGuestContacts(next);
        return next;
      });
    },
    [persistGuestContacts]
  );

  const loadGuestContacts = useCallback(() => {
    if (typeof window === 'undefined') {
      setContacts([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setContacts([]);
      } else {
        const parsed = JSON.parse(stored) as RelationshipContact[];
        setContacts(parsed.map(normalizeContact));
      }
    } catch (error) {
      console.error('Falha ao carregar relacionamentos salvos', error);
      setContacts([]);
    }
  }, []);

  const persistRemoteContacts = useCallback(
    (next: RelationshipContact[]) => {
      if (typeof window === 'undefined' || !user) {
        return;
      }
      try {
        window.localStorage.setItem(buildRemoteCacheKey(user.uid), JSON.stringify(next));
      } catch (error) {
        console.warn('Falha ao salvar cache remoto de relacionamentos', error);
      }
    },
    [user]
  );

  const loadRemoteContacts = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(buildRemoteCacheKey(user.uid));
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as RelationshipContact[];
      return parsed.map(normalizeContact);
    } catch (error) {
      console.warn('Falha ao carregar cache remoto de relacionamentos', error);
      return null;
    }
  }, [user]);

  const getRemoteToken = useCallback(async () => {
    if (isGuestMode || !user) {
      throw new Error(LOCAL_MODE_ERROR);
    }
    return user.getIdToken();
  }, [isGuestMode, user]);

  const fetchRemoteContacts = useCallback(async () => {
    const token = await getRemoteToken();
    const response = await listContacts(token);
    const normalized = (response.contacts ?? []).map(normalizeContact);
    setContacts(normalized);
    persistRemoteContacts(normalized);
  }, [getRemoteToken, persistRemoteContacts]);

  const scheduleBackgroundSync = useCallback(() => {
    if (typeof window === 'undefined' || isGuestMode || !user) {
      return;
    }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      fetchRemoteContacts().catch(error =>
        console.error('Falha ao sincronizar relacionamentos em segundo plano', error)
      );
    }, 2000);
  }, [fetchRemoteContacts, isGuestMode, user]);

  useEffect(() => {
    if (isGuestMode || !user) {
      setLoading(true);
      loadGuestContacts();
      setLoading(false);
      return;
    }

    setLoading(true);
    const cached = loadRemoteContacts();
    if (cached) {
      setContacts(cached);
      setLoading(false);
    }

    fetchRemoteContacts()
      .then(() => setLoading(false))
      .catch(error => {
        if ((error as Error)?.message === LOCAL_MODE_ERROR || isAccessDeniedError(error)) {
          loadGuestContacts();
          setLoading(false);
          toast.error('Sua assinatura está suspensa. Os contatos ficarão apenas neste dispositivo.');
          return;
        }
        console.error('Erro ao carregar relacionamentos do servidor', error);
        setLoading(false);
      });
  }, [fetchRemoteContacts, isGuestMode, loadGuestContacts, loadRemoteContacts, user]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const [newContact, setNewContact] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    stage: 'Contato inicial' as RelationshipStage,
    priority: 'Média' as RelationshipPriority,
    tags: '',
    nextAction: '',
    note: '',
  });

  const [interactionForm, setInteractionForm] = useState({
    channel: 'Ligação' as RelationshipInteraction['channel'],
    summary: '',
    nextStep: '',
    nextAction: '',
  });
  const [interactionError, setInteractionError] = useState<string | null>(null);

  useEffect(() => {
    if (contacts.length === 0) {
      setSelectedContactId(null);
      return;
    }
    if (!selectedContactId || !contacts.find(contact => contact.id === selectedContactId)) {
      setSelectedContactId(contacts[0].id);
    }
  }, [contacts, selectedContactId]);

  const selectedContact = contacts.find(contact => contact.id === selectedContactId) ?? null;

  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      const matchesSearch =
        contact.name.toLowerCase().includes(search.toLowerCase()) ||
        (contact.company?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (contact.tags.join(' ').toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStage = stageFilter === 'Todos' || contact.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [contacts, search, stageFilter]);

  const stats = useMemo(() => {
    const pipeline = stageOptions.map(stage => ({
      stage,
      total: contacts.filter(contact => contact.stage === stage).length,
    }));
    const highPriority = contacts.filter(contact => contact.priority === 'Alta').length;
    const withNextAction = contacts.filter(contact => contact.nextAction).length;
    const upcomingFollowUps = contacts
      .filter(contact => contact.nextAction)
      .sort((a, b) => new Date(a.nextAction ?? 0).getTime() - new Date(b.nextAction ?? 0).getTime())
      .slice(0, 3);

    return { pipeline, highPriority, withNextAction, upcomingFollowUps };
  }, [contacts]);

  const createId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const handleCreateContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newContact.name.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const tags = newContact.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    const initialInteraction: RelationshipInteraction[] = newContact.note
      ? [
          {
            id: createId(),
            date: now,
            channel: 'Anotação',
            summary: newContact.note,
            nextStep: newContact.nextAction ? `Revisar em ${newContact.nextAction}` : undefined,
          },
        ]
      : [];

    const contactInput: RelationshipContactInput = {
      name: newContact.name.trim(),
      company: newContact.company.trim() || undefined,
      email: newContact.email.trim() || undefined,
      phone: newContact.phone.trim() || undefined,
      stage: newContact.stage,
      priority: newContact.priority,
      lastInteraction: newContact.note ? now : undefined,
      nextAction: newContact.nextAction || undefined,
      tags,
      interactions: initialInteraction,
      createdAt: now,
    };

    const fallbackContact: RelationshipContact = normalizeContact({
      id: createId(),
      ...contactInput,
    } as RelationshipContact);

    if (isGuestMode || !user) {
      updateGuestContacts(prev => [fallbackContact, ...prev]);
      setSelectedContactId(fallbackContact.id);
      toast.success('Contato criado');
    } else {
      try {
        const token = await getRemoteToken();
        const response = await createContact(token, contactInput);
        setContacts(prev => {
          const next = [normalizeContact(response.contact), ...prev];
          persistRemoteContacts(next);
          return next;
        });
        setSelectedContactId(response.contact.id);
        toast.success('Contato criado');
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Falha ao criar relacionamento', error);
        if (isAccessDeniedError(error)) {
          updateGuestContacts(prev => [fallbackContact, ...prev]);
          setSelectedContactId(fallbackContact.id);
          toast.success('Contato registrado localmente. Renove para sincronizar.');
        } else {
          toast.error('Não foi possível criar o contato');
        }
      }
    }

    setNewContact({
      name: '',
      company: '',
      email: '',
      phone: '',
      stage: 'Contato inicial',
      priority: 'Média',
      tags: '',
      nextAction: '',
      note: '',
    });
  };

  const updateContact = useCallback(
    async (contactId: string, partial: Partial<RelationshipContact>) => {
      if (isGuestMode || !user) {
        updateGuestContacts(prev =>
          prev.map(contact => (contact.id === contactId ? normalizeContact({ ...contact, ...partial }) : contact))
        );
        return;
      }

      try {
        const token = await getRemoteToken();
        await updateContactRemote(token, contactId, partial);
        setContacts(prev => {
          const next = prev.map(contact =>
            contact.id === contactId ? normalizeContact({ ...contact, ...partial }) : contact
          );
          persistRemoteContacts(next);
          return next;
        });
        scheduleBackgroundSync();
      } catch (error) {
        console.error('Falha ao atualizar relacionamento', error);
        if (isAccessDeniedError(error)) {
          updateGuestContacts(prev =>
            prev.map(contact => (contact.id === contactId ? normalizeContact({ ...contact, ...partial }) : contact))
          );
          toast.success('Contato atualizado localmente. Renove para sincronizar.');
        } else {
          toast.error('Não foi possível atualizar o contato');
        }
      }
    },
    [
      getRemoteToken,
      isGuestMode,
      persistRemoteContacts,
      scheduleBackgroundSync,
      updateGuestContacts,
      user,
    ]
  );

  const handleAddInteraction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedContact) {
      return;
    }

    if (!interactionForm.summary.trim()) {
      setInteractionError('Descreva o que aconteceu nesse contato.');
      return;
    }
    setInteractionError(null);

    const interactionPayload: RelationshipInteractionInput = {
      channel: interactionForm.channel,
      summary: interactionForm.summary.trim(),
      nextStep: interactionForm.nextStep.trim() || undefined,
      nextAction: interactionForm.nextAction || undefined,
    };

    if (isGuestMode || !user) {
      const interaction: RelationshipInteraction = {
        id: createId(),
        date: new Date().toISOString(),
        channel: interactionPayload.channel,
        summary: interactionPayload.summary,
        nextStep: interactionPayload.nextStep,
      };
      updateGuestContacts(prev =>
        prev.map(contact =>
          contact.id === selectedContact.id
            ? {
                ...contact,
                interactions: [interaction, ...contact.interactions],
                lastInteraction: interaction.date,
                nextAction: interactionForm.nextAction || contact.nextAction,
              }
            : contact
        )
      );
      toast.success('Interação registrada');
    } else {
      try {
        const token = await getRemoteToken();
        const response = await addInteractionRemote(token, selectedContact.id, interactionPayload);
        setContacts(prev => {
          const next = prev.map(contact =>
            contact.id === selectedContact.id ? normalizeContact(response.contact) : contact
          );
          persistRemoteContacts(next);
          return next;
        });
        scheduleBackgroundSync();
        toast.success('Interação registrada');
      } catch (error) {
        console.error('Falha ao registrar interação', error);
        if (isAccessDeniedError(error)) {
          const interaction: RelationshipInteraction = {
            id: createId(),
            date: new Date().toISOString(),
            channel: interactionPayload.channel,
            summary: interactionPayload.summary,
            nextStep: interactionPayload.nextStep,
          };
          updateGuestContacts(prev =>
            prev.map(contact =>
              contact.id === selectedContact.id
                ? {
                    ...contact,
                    interactions: [interaction, ...contact.interactions],
                    lastInteraction: interaction.date,
                    nextAction: interactionForm.nextAction || contact.nextAction,
                  }
                : contact
            )
          );
          toast.success('Interação registrada localmente. Renove para sincronizar.');
        } else {
          toast.error('Não foi possível registrar a interação');
        }
      }
    }

    setInteractionForm({
      channel: 'Ligação',
      summary: '',
      nextStep: '',
      nextAction: '',
    });
  };

  const handleStageChange = (contactId: string, stage: RelationshipStage) => {
    void updateContact(contactId, { stage });
  };

  const handlePriorityChange = (contactId: string, priority: RelationshipPriority) => {
    void updateContact(contactId, { priority });
  };

  if (loading && contacts.length === 0) {
    return (
      <DashboardLayout
        title="Relacionamentos"
        subtitle="Organize contatos importantes e acompanhe o histórico de interações."
        actions={
          <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
            ← Voltar para aplicativos
          </button>
        }
      >
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p>Sincronizando contatos...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Relacionamentos estratégicos"
      subtitle="Acompanhe contatos importantes, planeje próximos passos e mantenha follow-ups em dia."
      actions={
        <button type="button" className={styles.backButton} onClick={() => navigate('/dashboard')}>
          ← Voltar para aplicativos
        </button>
      }
    >
      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Total de contatos</span>
          <strong>{contacts.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Prioridade alta</span>
          <strong>{stats.highPriority}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Com próximo passo</span>
          <strong>{stats.withNextAction}</strong>
        </article>
        {stats.pipeline.map(item => (
          <article key={item.stage} className={styles.pipelineCard}>
            <span>{item.stage}</span>
            <strong>{item.total}</strong>
          </article>
        ))}
      </section>

      <section className={styles.panelsGrid}>
        <article className={styles.panel}>
          <header>
            <div>
              <h2>Novo contato</h2>
              <p>Cadastre rapidamente e defina o próximo passo.</p>
            </div>
          </header>
          <form className={styles.form} onSubmit={handleCreateContact}>
            <div className={styles.formRow}>
              <label>
                Nome
                <input
                  type="text"
                  value={newContact.name}
                  onChange={event => setNewContact(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="Nome completo"
                  required
                />
              </label>
              <label>
                Empresa
                <input
                  type="text"
                  value={newContact.company}
                  onChange={event => setNewContact(prev => ({ ...prev, company: event.target.value }))}
                  placeholder="Empresa ou contexto"
                />
              </label>
            </div>
            <div className={styles.formRow}>
              <label>
                E-mail
                <input
                  type="email"
                  value={newContact.email}
                  onChange={event => setNewContact(prev => ({ ...prev, email: event.target.value }))}
                  placeholder="contato@email.com"
                />
              </label>
              <label>
                Telefone
                <input
                  type="text"
                  value={newContact.phone}
                  onChange={event => setNewContact(prev => ({ ...prev, phone: event.target.value }))}
                  placeholder="(11) 99999-0000"
                />
              </label>
            </div>
            <div className={styles.formRow}>
              <label>
                Estágio
                <select
                  value={newContact.stage}
                  onChange={event =>
                    setNewContact(prev => ({ ...prev, stage: event.target.value as RelationshipStage }))
                  }
                >
                  {stageOptions.map(stage => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade
                <select
                  value={newContact.priority}
                  onChange={event =>
                    setNewContact(prev => ({ ...prev, priority: event.target.value as RelationshipPriority }))
                  }
                >
                  {priorityOptions.map(priority => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.formRow}>
              <label>
                Tags
                <input
                  type="text"
                  value={newContact.tags}
                  onChange={event => setNewContact(prev => ({ ...prev, tags: event.target.value }))}
                  placeholder="investidor, parceiro, vip"
                />
              </label>
              <label>
                Próximo passo (data)
                <input
                  type="date"
                  value={newContact.nextAction}
                  onChange={event => setNewContact(prev => ({ ...prev, nextAction: event.target.value }))}
                />
              </label>
            </div>
            <label>
              Observações iniciais
              <textarea
                value={newContact.note}
                onChange={event => setNewContact(prev => ({ ...prev, note: event.target.value }))}
                placeholder="Contexto, expectativas e próximos passos combinados"
                rows={3}
              />
            </label>
            <button type="submit" className={styles.primaryButton}>
              Salvar contato
            </button>
          </form>
        </article>

        <article className={styles.panel}>
          <header>
            <div>
              <h2>Próximos follow-ups</h2>
              <p>Priorize quem precisa de atenção nos próximos dias.</p>
            </div>
          </header>

          <ul className={styles.followUpList}>
            {stats.upcomingFollowUps.length === 0 && <li>Nenhum follow-up agendado.</li>}
            {stats.upcomingFollowUps.map(contact => (
              <li key={contact.id}>
                <div>
                  <strong>{contact.name}</strong>
                  <span>{contact.company}</span>
                </div>
                <div className={styles.followUpMeta}>
                  <span>{contact.nextAction ? formatDate(contact.nextAction) : 'Sem data'}</span>
                  <button type="button" onClick={() => setSelectedContactId(contact.id)}>
                    Ver detalhes
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.crmGrid}>
        <div className={styles.listPanel}>
          <header className={styles.listHeader}>
            <div>
              <h2>Contatos ativos</h2>
              <p>Pesquise e filtre para encontrar rapidamente.</p>
            </div>
            <div className={styles.filters}>
              <input
                type="text"
                placeholder="Buscar por nome, empresa ou tag"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select
                value={stageFilter}
                onChange={event => setStageFilter(event.target.value as RelationshipStage | 'Todos')}
              >
                <option value="Todos">Todos os estágios</option>
                {stageOptions.map(stage => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <ul className={styles.contactList}>
            {filteredContacts.length === 0 && <li className={styles.emptyState}>Nenhum contato encontrado.</li>}
            {filteredContacts.map(contact => (
              <li
                key={contact.id}
                className={contact.id === selectedContactId ? styles.contactActive : undefined}
                onClick={() => setSelectedContactId(contact.id)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.contactPrimary}>
                  <strong>{contact.name}</strong>
                  {contact.company && <span>{contact.company}</span>}
                </div>
                <div className={styles.contactBadges}>
                  <span className={styles.stageBadge}>{contact.stage}</span>
                  <span className={`${styles.priorityBadge} ${getPriorityClass(contact.priority)}`}>
                    {contact.priority}
                  </span>
                </div>
                {contact.tags.length > 0 && (
                  <div className={styles.tagRow}>
                    {contact.tags.map(tag => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <small>
                  Última interação:{' '}
                  {contact.lastInteraction ? formatDate(contact.lastInteraction, true) : 'Sem histórico'}
                </small>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.detailPanel}>
          {!selectedContact && (
            <div className={styles.emptyState}>
              <p>Selecione um contato para visualizar detalhes e registrar próximas ações.</p>
            </div>
          )}

          {selectedContact && (
            <>
              <header className={styles.detailHeader}>
                <div>
                  <h2>{selectedContact.name}</h2>
                  <p>{selectedContact.company ?? selectedContact.email ?? 'Sem informações adicionais'}</p>
                </div>
                <div className={styles.detailControls}>
                  <label>
                    Estágio
                    <select
                      value={selectedContact.stage}
                      onChange={event => handleStageChange(selectedContact.id, event.target.value as RelationshipStage)}
                    >
                      {stageOptions.map(stage => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioridade
                    <select
                      value={selectedContact.priority}
                      onChange={event =>
                        handlePriorityChange(selectedContact.id, event.target.value as RelationshipPriority)
                      }
                    >
                      {priorityOptions.map(priority => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </header>

              <section className={styles.contactInfo}>
                {(selectedContact.email || selectedContact.phone) && (
                  <ul>
                    {selectedContact.email && (
                      <li>
                        <span>E-mail</span>
                        <strong>{selectedContact.email}</strong>
                      </li>
                    )}
                    {selectedContact.phone && (
                      <li>
                        <span>Telefone</span>
                        <strong>{selectedContact.phone}</strong>
                      </li>
                    )}
                    {selectedContact.nextAction && (
                      <li>
                        <span>Próximo follow-up</span>
                        <strong>{formatDate(selectedContact.nextAction)}</strong>
                      </li>
                    )}
                  </ul>
                )}
              </section>

              <section className={styles.interactionForm}>
                <h3>Registrar nova interação</h3>
                <form onSubmit={handleAddInteraction}>
                  <div className={styles.formRow}>
                    <label>
                      Canal
                      <select
                        value={interactionForm.channel}
                        onChange={event =>
                          setInteractionForm(prev => ({
                            ...prev,
                            channel: event.target.value as RelationshipInteraction['channel'],
                          }))
                        }
                      >
                        {channelOptions.map(channel => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Próximo follow-up
                      <input
                        type="date"
                        value={interactionForm.nextAction}
                        onChange={event =>
                          setInteractionForm(prev => ({ ...prev, nextAction: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  {interactionError && <div className={styles.formError}>{interactionError}</div>}
                  <label>
                    Resumo
                    <textarea
                      value={interactionForm.summary}
                      onChange={event => setInteractionForm(prev => ({ ...prev, summary: event.target.value }))}
                      rows={3}
                      placeholder="Resumo do contato e pontos importantes"
                      required
                    />
                  </label>
                  <label>
                    Próximos passos
                    <input
                      type="text"
                      value={interactionForm.nextStep}
                      onChange={event => setInteractionForm(prev => ({ ...prev, nextStep: event.target.value }))}
                      placeholder="Ex: enviar proposta até sexta"
                    />
                  </label>
                  <button type="submit" className={styles.primaryButton}>
                    Registrar interação
                  </button>
                </form>
              </section>

              <section className={styles.timeline}>
                <h3>Histórico</h3>
                {selectedContact.interactions.length === 0 && (
                  <div className={styles.emptyState}>Sem interações registradas.</div>
                )}
                <ul>
                  {selectedContact.interactions.map(interaction => (
                    <li key={interaction.id}>
                      <div>
                        <span>{interaction.channel}</span>
                        <strong>{interaction.summary}</strong>
                        {interaction.nextStep && <p>Próximo passo: {interaction.nextStep}</p>}
                      </div>
                      <time>{formatDate(interaction.date, true)}</time>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
};

const getPriorityClass = (priority: RelationshipPriority) => {
  switch (priority) {
    case 'Alta':
      return styles.priorityHigh;
    case 'Média':
      return styles.priorityMedium;
    default:
      return styles.priorityLow;
  }
};

const formatDate = (date: string, withTime = false) => {
  const parsed = new Date(date);
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  });
};

export { RelationshipPage };
