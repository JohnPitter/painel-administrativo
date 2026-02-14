const {
  express,
  firestore,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  CALENDAR_TAGS,
} = require('../shared/base');

module.exports = () => {

  const calendarRouter = express.Router();

  calendarRouter.use(async (req, res, next) => {
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
      console.error('[functions][calendar] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getEventsCollection = uid =>
    firestore.collection('users').doc(uid).collection('calendarEvents');

  const normalizeEvent = docSnap => {
    const data = docSnap.data() ?? {};
    const date = sanitizeString(data.date);
    const time = sanitizeString(data.time);
    const title = sanitizeString(data.title) || 'Evento';
    if (!date || !time) {
      return null;
    }
    const tag = sanitizeString(data.tag);
    const normalizedTag = CALENDAR_TAGS.includes(tag) ? tag : 'Reunião';
    return {
      id: docSnap.id,
      date,
      time,
      title,
      description: sanitizeString(data.description) || '',
      tag: normalizedTag,
    };
  };

  calendarRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getEventsCollection(uid)
        .orderBy('date', 'asc')
        .orderBy('time', 'asc')
        .get();
      const events = snapshot.docs
        .map(normalizeEvent)
        .filter(Boolean)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      res.json({ events });
    } catch (error) {
      console.error('[functions][calendar] list', error);
      res.status(500).json({ message: 'Erro ao carregar eventos.' });
    }
  });

  calendarRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { date, time, title, description, tag } = req.body ?? {};
      const sanitizedDate = sanitizeString(date);
      const sanitizedTime = sanitizeString(time);
      if (!sanitizedDate || !sanitizedTime) {
        res.status(400).json({ message: 'Informe data e horário do evento.' });
        return;
      }
      const sanitizedTitle = sanitizeString(title) || 'Evento';
      const sanitizedDescription = sanitizeString(description) || '';
      const normalizedTag = CALENDAR_TAGS.includes(sanitizeString(tag)) ? sanitizeString(tag) : 'Reunião';
      const payload = {
        date: sanitizedDate,
        time: sanitizedTime,
        title: sanitizedTitle,
        description: sanitizedDescription,
        tag: normalizedTag,
      };
      const ref = await getEventsCollection(uid).add(payload);
      res.status(201).json({ event: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][calendar] create', error);
      res.status(400).json({ message: error.message || 'Erro ao criar evento.' });
    }
  });

  calendarRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do evento.' });
        return;
      }
      const ref = getEventsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Evento não encontrado.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][calendar] delete', error);
      res.status(500).json({ message: 'Erro ao remover evento.' });
    }
  });

  return calendarRouter;
};
