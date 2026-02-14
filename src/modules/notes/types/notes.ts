export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotesState {
  notes: Note[];
}

export interface NotesContextValue extends NotesState {
  addNote: (
    data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'pinned'> & { pinned?: boolean }
  ) => Promise<void>;
  updateNote: (id: string, data: Partial<Omit<Note, 'id'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePinned: (id: string) => Promise<void>;
}
