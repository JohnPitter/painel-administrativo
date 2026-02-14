const {
  express,
  firestore,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  ensureDate,
  ensureTimeValue,
  sanitizeString,
  TIME_CLOCK_SHIFT_TYPES,
} = require('../shared/base');

module.exports = () => {

  const timeclockRouter = express.Router();

  timeclockRouter.use(async (req, res, next) => {
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
      console.error('[functions][timeclock] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getTimeclockCollection = uid =>
    firestore.collection('users').doc(uid).collection('timeclock');

  const normalizeShiftType = value => (TIME_CLOCK_SHIFT_TYPES.includes(value) ? value : 'padrao');

  const normalizeEntry = docSnap => {
    const data = docSnap.data() ?? {};
    const date = sanitizeString(data.date);
    if (!date) {
      return null;
    }
    return {
      id: docSnap.id,
      date,
      firstCheckIn: sanitizeString(data.firstCheckIn),
      firstCheckOut: sanitizeString(data.firstCheckOut),
      secondCheckIn: sanitizeString(data.secondCheckIn),
      secondCheckOut: sanitizeString(data.secondCheckOut),
      shiftType: normalizeShiftType(data.shiftType),
      notes: sanitizeString(data.notes),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  };

  const sortEntries = entries =>
    entries.sort((a, b) => {
      if (a.date === b.date) {
        return (a.firstCheckIn || '').localeCompare(b.firstCheckIn || '');
      }
      return b.date.localeCompare(a.date);
    });

  const buildEntryPayload = body => {
    const shiftType = normalizeShiftType(body.shiftType);
    const payload = {
      date: ensureDate(body.date, 'data'),
      firstCheckIn: ensureTimeValue(body.firstCheckIn, 'entrada 1'),
      firstCheckOut: ensureTimeValue(body.firstCheckOut, 'saída 1'),
      secondCheckIn: ensureTimeValue(body.secondCheckIn, 'entrada 2', { optional: true }),
      secondCheckOut: ensureTimeValue(body.secondCheckOut, 'saída 2', { optional: true }),
      shiftType,
      notes: sanitizeString(body.notes),
    };
    const now = new Date().toISOString();
    return {
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
  };

  const buildUpdatePayload = body => {
    const updates = {};
    if (body.date !== undefined) {
      updates.date = ensureDate(body.date, 'data');
    }
    if (body.firstCheckIn !== undefined) {
      updates.firstCheckIn = ensureTimeValue(body.firstCheckIn, 'entrada 1');
    }
    if (body.firstCheckOut !== undefined) {
      updates.firstCheckOut = ensureTimeValue(body.firstCheckOut, 'saída 1');
    }
    if (body.secondCheckIn !== undefined) {
      updates.secondCheckIn = ensureTimeValue(body.secondCheckIn, 'entrada 2', { optional: true });
    }
    if (body.secondCheckOut !== undefined) {
      updates.secondCheckOut = ensureTimeValue(body.secondCheckOut, 'saída 2', { optional: true });
    }
    if (body.shiftType !== undefined) {
      updates.shiftType = normalizeShiftType(body.shiftType);
    }
    if (body.notes !== undefined) {
      updates.notes = sanitizeString(body.notes);
    }
    if (Object.keys(updates).length === 0) {
      throw new Error('Informe ao menos um campo para atualizar.');
    }
    updates.updatedAt = new Date().toISOString();
    return updates;
  };

  timeclockRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getTimeclockCollection(uid).orderBy('date', 'desc').get();
      const entries = sortEntries(
        snapshot.docs
          .map(normalizeEntry)
          .filter(Boolean)
      );
      res.json({ entries });
    } catch (error) {
      console.error('[functions][timeclock] list', error);
      res.status(500).json({ message: 'Erro ao carregar registros de ponto.' });
    }
  });

  timeclockRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const payload = buildEntryPayload(req.body ?? {});
      const ref = await getTimeclockCollection(uid).add(payload);
      res.status(201).json({ entry: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][timeclock] create', error);
      res.status(400).json({ message: error.message || 'Erro ao registrar ponto.' });
    }
  });

  timeclockRouter.patch('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do registro.' });
        return;
      }
      const ref = getTimeclockCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Registro não encontrado.' });
        return;
      }
      const updates = buildUpdatePayload(req.body ?? {});
      await ref.update(updates);
      const updatedSnapshot = await ref.get();
      const entry = normalizeEntry(updatedSnapshot);
      if (!entry) {
        res.status(500).json({ message: 'Registro atualizado com dados inválidos.' });
        return;
      }
      res.json({ entry });
    } catch (error) {
      console.error('[functions][timeclock] update', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar registro.' });
    }
  });

  timeclockRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do registro.' });
        return;
      }
      const ref = getTimeclockCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Registro não encontrado.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][timeclock] delete', error);
      res.status(500).json({ message: 'Erro ao remover registro.' });
    }
  });

  return timeclockRouter;
};
