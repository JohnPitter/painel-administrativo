import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { MetricCard } from '@shared/components/MetricCard';
import { useNotes } from '../context/NotesContext';
import styles from './NotesDashboard.module.css';

const NotesDashboard = () => {
  const { notes } = useNotes();

  const { totalNotes, pinnedNotes, recentNotes } = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() - 7);
    let pinned = 0;
    const recent: typeof notes = [];

    notes.forEach(note => {
      if (note.pinned) {
        pinned += 1;
      }
      const updatedAt = new Date(note.updatedAt);
      if (!Number.isNaN(updatedAt.getTime()) && updatedAt >= limit) {
        recent.push(note);
      }
    });

    return {
      totalNotes: notes.length,
      pinnedNotes: pinned,
      recentNotes: recent,
    };
  }, [notes]);

  const { tagDataset, uniqueTags, untaggedCount } = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach(note => {
      if (!note.tags.length) {
        counts.set('Sem tag', (counts.get('Sem tag') ?? 0) + 1);
        return;
      }
      note.tags.forEach(tag => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    const dataset = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    const untagged = counts.get('Sem tag') ?? 0;
    const unique = Math.max(dataset.length - (untagged > 0 ? 1 : 0), 0);
    return { tagDataset: dataset, uniqueTags: unique, untaggedCount: untagged };
  }, [notes]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.metricGrid}>
        <MetricCard
          label="Notas registradas"
          value={String(totalNotes)}
          trend="neutral"
          footnote={`${pinnedNotes} fixadas`}
        />
        <MetricCard
          label="Atualizadas na semana"
          value={String(recentNotes.length)}
          trend={recentNotes.length > 0 ? 'positive' : 'neutral'}
          footnote="Últimos 7 dias"
        />
        <MetricCard
          label="Tags únicas"
          value={String(uniqueTags)}
          trend="neutral"
          footnote="Organize seus tópicos"
        />
        <MetricCard
          label="Notas sem tag"
          value={String(untaggedCount)}
          trend="neutral"
          footnote="Organize com etiquetas"
        />
      </div>

      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h3>Notas atualizadas recentemente</h3>
            <p>Revise rapidamente as notas trabalhadas nos últimos 7 dias.</p>
          </div>
        </header>
        {recentNotes.length === 0 ? (
          <div className={styles.emptyChart}>Nenhuma nota atualizada nos últimos dias.</div>
        ) : (
          <ul className={styles.recentList}>
            {recentNotes.slice(0, 5).map(note => (
              <li key={note.id}>
                <strong>{note.title}</strong>
                <span>{formatDateTime(note.updatedAt)}</span>
                {note.content && <p>{note.content.slice(0, 120)}{note.content.length > 120 ? '…' : ''}</p>}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h3>Notas por tag</h3>
            <p>Distribuição das notas por etiqueta ou sem categorização.</p>
          </div>
        </header>
        <div className={styles.chart}>
          {tagDataset.length === 0 ? (
            <div className={styles.emptyChart}>Nenhuma nota cadastrada.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tagDataset}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 39, 118, 0.1)" />
                <XAxis dataKey="tag" interval={0} angle={-15} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={value => `${value} notas`} />
                <Bar dataKey="count" fill="#002776" name="Notas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
    </section>
  );
};

export { NotesDashboard };

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Data inválida';
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};
