const {
  express,
  firestore,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
} = require('../shared/base');

module.exports = () => {

  const automationsRouter = express.Router();

  automationsRouter.use(async (req, res, next) => {
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
      console.error('[functions][automations] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getAutomationsCollection = uid =>
    firestore.collection('users').doc(uid).collection('automations');

  const sanitizePayload = payload => {
    const name = sanitizeString(payload?.name);
    if (!name) {
      throw new Error('Informe o nome da automação.');
    }
    return {
      name,
      active: typeof payload.active === 'boolean' ? payload.active : true,
      source: sanitizeString(payload.source) || 'Manual',
      event: sanitizeString(payload.event) || 'Execução manual',
      condition: sanitizeString(payload.condition) || 'Sempre',
      conditionValue: sanitizeString(payload.conditionValue) || null,
      action: sanitizeString(payload.action) || 'Criar tarefa',
      actionPayload: sanitizeString(payload.actionPayload) || '',
      runCount: Number(payload.runCount) || 0,
      lastRun: payload.lastRun || null,
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  automationsRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getAutomationsCollection(uid).orderBy('createdAt', 'desc').get();
      const automations = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() ?? {}),
      }));
      res.json({ automations });
    } catch (error) {
      console.error('[functions][automations] list', error);
      res.status(500).json({ message: 'Erro ao carregar automações.' });
    }
  });

  automationsRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const payload = sanitizePayload(req.body ?? {});
      const ref = await getAutomationsCollection(uid).add(payload);
      res.status(201).json({ automation: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][automations] create', error);
      res.status(400).json({ message: error.message || 'Erro ao criar automação.' });
    }
  });

  automationsRouter.patch('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da automação.' });
        return;
      }
      const ref = getAutomationsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Automação não encontrada.' });
        return;
      }
      const updates = {};
      const payload = req.body ?? {};
      if (payload.name !== undefined) {
        updates.name = sanitizeString(payload.name) || 'Automação';
      }
      if (payload.active !== undefined) {
        updates.active = Boolean(payload.active);
      }
      if (payload.source !== undefined) {
        updates.source = sanitizeString(payload.source) || 'Manual';
      }
      if (payload.event !== undefined) {
        updates.event = sanitizeString(payload.event) || 'Execução manual';
      }
      if (payload.condition !== undefined) {
        updates.condition = sanitizeString(payload.condition) || 'Sempre';
      }
      if (payload.conditionValue !== undefined) {
        updates.conditionValue = sanitizeString(payload.conditionValue) || null;
      }
      if (payload.action !== undefined) {
        updates.action = sanitizeString(payload.action) || 'Criar tarefa';
      }
      if (payload.actionPayload !== undefined) {
        updates.actionPayload = sanitizeString(payload.actionPayload) || '';
      }
      if (payload.runCount !== undefined) {
        updates.runCount = Number(payload.runCount) || 0;
      }
      if (payload.lastRun !== undefined) {
        updates.lastRun = payload.lastRun || null;
      }
      await ref.update(updates);
      res.json({ id, ...updates });
    } catch (error) {
      console.error('[functions][automations] update', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar automação.' });
    }
  });

  automationsRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da automação.' });
        return;
      }
      const ref = getAutomationsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Automação não encontrada.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][automations] delete', error);
      res.status(500).json({ message: 'Erro ao remover automação.' });
    }
  });

  return automationsRouter;
};
