import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useNotes } from '../context/NotesContext';
import type { Note } from '../types/notes';
import styles from './NoteFormList.module.css';

const noteSchema = z.object({
  title: z.string().min(1, 'Informe o título'),
  content: z.string().optional(),
  tags: z.string().optional(),
  pinned: z.boolean().default(false),
});

type NoteFormValues = z.infer<typeof noteSchema>;

const NoteFormList = () => {
  const { notes, addNote, updateNote, deleteNote, togglePinned } = useNotes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState<'all' | string>('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: '',
      content: '',
      tags: '',
      pinned: false,
    },
  });

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(note => {
      note.tags.forEach(tag => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      if (showPinnedOnly && !note.pinned) {
        return false;
      }
      if (searchTerm) {
        const normalized = searchTerm.toLowerCase();
        const matchesSearch =
          note.title.toLowerCase().includes(normalized) ||
          note.content.toLowerCase().includes(normalized);
        if (!matchesSearch) {
          return false;
        }
      }
      if (tagFilter !== 'all' && !note.tags.includes(tagFilter)) {
        return false;
      }
      return true;
    });
  }, [notes, searchTerm, showPinnedOnly, tagFilter]);

  const onSubmit = async (formValues: NoteFormValues) => {
    const payload = mapFormToPayload(formValues);

    if (editingId) {
      await updateNote(editingId, payload);
      setEditingId(null);
    } else {
      await addNote(payload);
    }

    resetForm(reset);
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    reset({
      title: note.title,
      content: note.content,
      tags: note.tags.join(', '),
      pinned: note.pinned,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(reset);
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const totalPinned = notes.filter(note => note.pinned).length;
  const uniqueTags = tagOptions.length;

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h2>Notas e ideias</h2>
          <p>Guarde inspirações, planos rápidos e referências importantes.</p>
        </div>
        <div className={styles.summaryChips}>
          <span>{notes.length} notas</span>
          <span>{totalPinned} fixadas</span>
          <span>{uniqueTags} tags únicas</span>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="note-title">Título</label>
            <input
              id="note-title"
              placeholder="Ideia, compromisso ou referência"
              {...register('title')}
            />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={clsx(styles.field, styles.inlineField)}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" {...register('pinned')} />
              <span>Fixar nota</span>
            </label>
          </div>

          <div className={styles.field}>
            <label htmlFor="note-tags">Tags</label>
            <input
              id="note-tags"
              placeholder="Separe por vírgulas (ex.: projeto, ideias)"
              {...register('tags')}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="note-content">Conteúdo</label>
          <textarea
            id="note-content"
            rows={4}
            placeholder="Anote detalhes importantes, links ou checklists."
            {...register('content')}
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Salvar alterações' : 'Adicionar nota'}
          </button>
          {editingId && (
            <button type="button" className={styles.secondaryButton} onClick={handleCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <section className={styles.filters}>
        <div className={styles.searchField}>
          <label htmlFor="note-search">Busca</label>
          <input
            id="note-search"
            placeholder="Procure por título ou conteúdo"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="note-tag-filter">Tag</label>
          <div className={styles.selectWrapper}>
            <select
              id="note-tag-filter"
              value={tagFilter}
              onChange={event => setTagFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {tagOptions.map(tag => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={styles.togglePinned}>
          <input
            type="checkbox"
            checked={showPinnedOnly}
            onChange={event => setShowPinnedOnly(event.target.checked)}
          />
          Mostrar apenas fixadas
        </label>
      </section>

      {filteredNotes.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma nota para os filtros selecionados.</div>
      ) : (
        <div className={styles.noteGrid}>
          {filteredNotes.map(note => (
            <article
              key={note.id}
              className={clsx(styles.noteCard, note.pinned && styles.noteCardPinned)}
            >
              <header className={styles.noteCardHeader}>
                <div>
                  <h3>{note.title}</h3>
                </div>
                <div className={styles.noteActions}>
                  <button type="button" onClick={() => void togglePinned(note.id)}>
                    {note.pinned ? 'Desafixar' : 'Fixar'}
                  </button>
                  <button type="button" onClick={() => handleEdit(note)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => void handleDelete(note.id)}>
                    Remover
                  </button>
                </div>
              </header>
              {note.content && <p className={styles.noteContent}>{note.content}</p>}
              {note.tags.length > 0 && (
                <div className={styles.tagList}>
                  {note.tags.map(tag => (
                    <span key={tag} className={styles.tagBadge}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <footer className={styles.noteFooter}>
                <span>Criada em {formatDate(note.createdAt)}</span>
                {note.updatedAt !== note.createdAt && (
                  <span>Atualizada em {formatDate(note.updatedAt)}</span>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const mapFormToPayload = (values: NoteFormValues) => {
  const tags = parseTags(values.tags ?? '');
  return {
    title: values.title,
    content: values.content ?? '',
    tags,
    pinned: values.pinned ?? false,
  };
};

const parseTags = (raw: string) =>
  raw
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

const resetForm = (resetFn: ReturnType<typeof useForm<NoteFormValues>>['reset']) => {
  resetFn({
    title: '',
    content: '',
    tags: '',
    pinned: false,
  });
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export { NoteFormList };
