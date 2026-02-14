const {
  express,
  firestore,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  RELATIONSHIP_STAGES,
  RELATIONSHIP_PRIORITIES,
  RELATIONSHIP_CHANNELS,
} = require('../shared/base');

module.exports = () => {

  const relationshipsRouter = express.Router();

  relationshipsRouter.use(async (req, res, next) => {
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
      console.error('[functions][relationships] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getContactsCollection = uid =>
    firestore.collection('users').doc(uid).collection('relationships');

  const sanitizeStage = stage => (RELATIONSHIP_STAGES.includes(stage) ? stage : 'Contato inicial');
  const sanitizePriority = priority =>
    RELATIONSHIP_PRIORITIES.includes(priority) ? priority : 'Média';

  relationshipsRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getContactsCollection(uid).orderBy('createdAt', 'desc').get();
      const contacts = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() ?? {}),
      }));
      res.json({ contacts });
    } catch (error) {
      console.error('[functions][relationships] list', error);
      res.status(500).json({ message: 'Erro ao carregar contatos.' });
    }
  });

  relationshipsRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const {
        name,
        company,
        email,
        phone,
        stage,
        priority,
        nextAction,
        tags,
        interactions,
      } = req.body ?? {};
      const sanitizedName = sanitizeString(name);
      if (!sanitizedName) {
        res.status(400).json({ message: 'Informe o nome do contato.' });
        return;
      }
      const payload = {
        name: sanitizedName,
        company: sanitizeString(company) || null,
        email: sanitizeString(email) || null,
        phone: sanitizeString(phone) || null,
        stage: sanitizeStage(stage),
        priority: sanitizePriority(priority),
        nextAction: sanitizeString(nextAction) || null,
        tags: Array.isArray(tags) ? tags.map(tag => sanitizeString(tag)).filter(Boolean) : [],
        interactions: Array.isArray(interactions)
          ? interactions.filter(interaction => interaction && typeof interaction === 'object')
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastInteraction: null,
      };
      const ref = await getContactsCollection(uid).add(payload);
      res.status(201).json({ contact: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][relationships] create', error);
      res.status(400).json({ message: error.message || 'Erro ao criar contato.' });
    }
  });

  relationshipsRouter.patch('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do contato.' });
        return;
      }
      const ref = getContactsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Contato não encontrado.' });
        return;
      }
      const updates = {};
      if (req.body?.stage !== undefined) {
        updates.stage = sanitizeStage(req.body.stage);
      }
      if (req.body?.priority !== undefined) {
        updates.priority = sanitizePriority(req.body.priority);
      }
      if (req.body?.nextAction !== undefined) {
        updates.nextAction = sanitizeString(req.body.nextAction) || null;
      }
      if (req.body?.tags !== undefined) {
        updates.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
      }
      updates.updatedAt = new Date().toISOString();
      await ref.update(updates);
      res.json({ id, ...updates });
    } catch (error) {
      console.error('[functions][relationships] update contact', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar contato.' });
    }
  });

  relationshipsRouter.post('/:id/interactions', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      const { channel, summary, nextStep, nextAction } = req.body ?? {};
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do contato.' });
        return;
      }
      const ref = getContactsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Contato não encontrado.' });
        return;
      }
      const normalizedChannel = RELATIONSHIP_CHANNELS.includes(channel)
        ? channel
        : RELATIONSHIP_CHANNELS[0];
      const interaction = {
        id: firestore.collection('_').doc().id,
        date: new Date().toISOString(),
        channel: normalizedChannel,
        summary: sanitizeString(summary),
        nextStep: sanitizeString(nextStep) || null,
      };
      const contact = snapshot.data() ?? {};
      const updatedInteractions = [interaction, ...(contact.interactions ?? [])];
      await ref.update({
        interactions: updatedInteractions,
        lastInteraction: interaction.date,
        nextAction: sanitizeString(nextAction) || contact.nextAction || null,
        updatedAt: new Date().toISOString(),
      });
      res.json({ contact: { id, ...contact, interactions: updatedInteractions } });
    } catch (error) {
      console.error('[functions][relationships] add interaction', error);
      res.status(400).json({ message: error.message || 'Erro ao registrar interação.' });
    }
  });

  relationshipsRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID do contato.' });
        return;
      }
      const ref = getContactsCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Contato não encontrado.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][relationships] delete contact', error);
      res.status(500).json({ message: 'Erro ao remover contato.' });
    }
  });

  return relationshipsRouter;
};
