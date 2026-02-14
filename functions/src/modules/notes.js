const {
  express,
  firestore,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  NOTE_DEFAULT_PAYLOAD,
} = require('../shared/base');

module.exports = () => {
  const notesRouter = express.Router();

  notesRouter.use(async (req, res, next) => {
    try {
      const uid = await authenticateRequest(req);
      const profile = await getUserProfile(uid);
      if (!isSubscriptionActive(profile)) {
        res.status(403).json({
          message: 'Sua assinatura está suspensa. Renove para voltar a sincronizar dados com a nuvem.',
        });
        return;
      }
      req.auth = { uid };
      next();
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        res.status(401).json({ message: 'Autenticação necessária.' });
        return;
      }
      console.error('[functions][notes] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getNotesCollection = uid => firestore.collection('users').doc(uid).collection('notes');

  const normalizeNote = docSnap => {
    const data = docSnap.data() ?? {};
    const createdAt = data.createdAt ?? new Date().toISOString();
    const updatedAt = data.updatedAt ?? createdAt;
    return {
      id: docSnap.id,
      title: sanitizeString(data.title) || NOTE_DEFAULT_PAYLOAD.title,
      content: sanitizeString(data.content) || NOTE_DEFAULT_PAYLOAD.content,
      tags: Array.isArray(data.tags) ? data.tags : NOTE_DEFAULT_PAYLOAD.tags,
      pinned: Boolean(data.pinned),
      createdAt,
      updatedAt,
    };
  };

  notesRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getNotesCollection(uid).orderBy('updatedAt', 'desc').get();
      const notes = snapshot.docs.map(normalizeNote);
      res.json({ notes });
    } catch (error) {
      console.error('[functions][notes] list', error);
      res.status(500).json({ message: 'Erro ao carregar notas.' });
    }
  });

  notesRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { title, content, tags, pinned } = req.body ?? {};
      const now = new Date().toISOString();
      const payload = {
        title: sanitizeString(title) || NOTE_DEFAULT_PAYLOAD.title,
        content: sanitizeString(content) || NOTE_DEFAULT_PAYLOAD.content,
        tags: Array.isArray(tags) ? tags : NOTE_DEFAULT_PAYLOAD.tags,
        pinned: Boolean(pinned),
        createdAt: now,
        updatedAt: now,
      };
      const ref = await getNotesCollection(uid).add(payload);
      res.status(201).json({ note: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][notes] create', error);
      res.status(400).json({ message: error.message || 'Erro ao criar nota.' });
    }
  });

  notesRouter.patch('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da nota.' });
        return;
      }
      const ref = getNotesCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Nota não encontrada.' });
        return;
      }
      const updates = { updatedAt: new Date().toISOString() };
      if (req.body?.title !== undefined) {
        updates.title = sanitizeString(req.body.title) || NOTE_DEFAULT_PAYLOAD.title;
      }
      if (req.body?.content !== undefined) {
        updates.content = sanitizeString(req.body.content) || NOTE_DEFAULT_PAYLOAD.content;
      }
      if (req.body?.tags !== undefined) {
        updates.tags = Array.isArray(req.body.tags) ? req.body.tags : NOTE_DEFAULT_PAYLOAD.tags;
      }
      if (req.body?.pinned !== undefined) {
        updates.pinned = Boolean(req.body.pinned);
      }
      await ref.update(updates);
      res.json({ id, ...updates });
    } catch (error) {
      console.error('[functions][notes] update', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar nota.' });
    }
  });

  notesRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da nota.' });
        return;
      }
      const ref = getNotesCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Nota não encontrada.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][notes] delete', error);
      res.status(500).json({ message: 'Erro ao remover nota.' });
    }
  });

  return notesRouter;
};
