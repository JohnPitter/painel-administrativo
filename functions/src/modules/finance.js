const {
  express,
  firestore,
  admin,
  sanitizeString,
  parseNumber,
  ensureDate,
  generateRecurringDates,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  PAYMENT_METHODS,
  INVESTMENT_TYPES,
  RECURRENCE_VALUES,
  DEFAULT_CATEGORIES,
  CATEGORY_GROUPS,
} = require('../shared/base');

module.exports = () => {

  const financeRouter = express.Router();

  financeRouter.use(async (req, res, next) => {
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
      console.error('[functions][finance] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getCollectionRef = (uid, collection) =>
    firestore.collection('users').doc(uid).collection(collection);
  const getCategoriesDocRef = uid =>
    firestore.collection('users').doc(uid).collection('settings').doc('categories');
  const getPlannerDocRef = (uid, periodKey) =>
    firestore.collection('users').doc(uid).collection('planner').doc(periodKey);

  const mergeCategories = raw => {
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_CATEGORIES;
    }
    return {
      expenses:
        Array.isArray(raw.expenses) && raw.expenses.length > 0
          ? raw.expenses
          : DEFAULT_CATEGORIES.expenses,
      incomes:
        Array.isArray(raw.incomes) && raw.incomes.length > 0
          ? raw.incomes
          : DEFAULT_CATEGORIES.incomes,
      investments:
        Array.isArray(raw.investments) && raw.investments.length > 0
          ? raw.investments
          : DEFAULT_CATEGORIES.investments,
    };
  };

  const buildPlannerKey = (year, month) => {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      throw new Error('Ano inválido para o planner.');
    }
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      throw new Error('Mês inválido para o planner.');
    }
    return `${parsedYear}-${String(parsedMonth).padStart(2, '0')}`;
  };

  const normalizeAllocations = raw => {
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return Object.entries(raw).reduce((accumulator, [category, value]) => {
      if (typeof category !== 'string') {
        return accumulator;
      }
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return accumulator;
      }
      accumulator[category] = Math.max(0, Math.min(100, Number(numericValue.toFixed(2))));
      return accumulator;
    }, {});
  };

  const normalizeGoals = raw => {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map(goal => {
        const id = sanitizeString(goal?.id) || firestore.collection('_').doc().id;
        const label = sanitizeString(goal?.label);
        const amount = Number(goal?.amount) || 0;
        const monthlyReserve = Number(goal?.monthlyReserve) || 0;
        if (!label || amount <= 0 || monthlyReserve <= 0) {
          return null;
        }
        return {
          id,
          label,
          amount: Number(amount.toFixed(2)),
          monthlyReserve: Number(monthlyReserve.toFixed(2)),
        };
      })
      .filter(Boolean);
  };

  const normalizeRecurrence = data => {
    const frequency = RECURRENCE_VALUES.includes(data?.frequency) ? data.frequency : 'none';
    const occurrences = Math.max(1, Math.min(Number(data?.occurrences) || 1, 24));
    return { frequency, occurrences };
  };

  const normalizeExpense = body => {
    const nowIso = new Date().toISOString();
    const description = sanitizeString(body.description);
    if (!description) {
      throw new Error('Descreva o gasto.');
    }
    const category = sanitizeString(body.category);
    if (!category) {
      throw new Error('Informe a categoria.');
    }
    const paymentMethod = sanitizeString(body.paymentMethod);
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new Error('Forma de pagamento inválida.');
    }
    const amount = parseNumber(body.amount, 'amount');
    const date = ensureDate(body.date, 'date');
    const excludeFromTotals = Boolean(body.excludeFromTotals);
    return {
      description,
      category,
      paymentMethod,
      amount,
      date,
      recurrence: normalizeRecurrence(body.recurrence),
      installments: Number(body.installments) || 1,
      notes: sanitizeString(body.notes),
      createdAt: nowIso,
      updatedAt: nowIso,
      excludeFromTotals,
    };
  };

  const normalizeIncome = body => {
    const nowIso = new Date().toISOString();
    const source = sanitizeString(body.source);
    if (!source) {
      throw new Error('Descreva a receita.');
    }
    const description = sanitizeString(body.description);
    if (!description) {
      throw new Error('Adicione uma descrição para a receita.');
    }
    const category = sanitizeString(body.category);
    if (!category) {
      throw new Error('Informe a categoria.');
    }
    const amount = parseNumber(body.amount, 'amount');
    const date = ensureDate(body.date, 'date');
    const excludeFromTotals = Boolean(body.excludeFromTotals);
    return {
      description,
      source,
      category,
      amount,
      date,
      recurrence: normalizeRecurrence(body.recurrence),
      notes: sanitizeString(body.notes),
      createdAt: nowIso,
      updatedAt: nowIso,
      excludeFromTotals,
    };
  };

  const normalizeInvestment = body => {
    const nowIso = new Date().toISOString();
    const description = sanitizeString(body.description ?? body.asset);
    if (!description) {
      throw new Error('Descreva o investimento.');
    }
    const type = sanitizeString(body.type);
    if (!INVESTMENT_TYPES.includes(type)) {
      throw new Error('Tipo de investimento inválido.');
    }
    const amount = parseNumber(body.amount, 'amount');
    const expectedReturn = Number(body.expectedReturn) || null;
    const date = ensureDate(body.date, 'date');
    const institution = sanitizeString(body.institution);
    if (!institution) {
      throw new Error('Informe a instituição.');
    }
    return {
      description,
      institution,
      type,
      amount,
      expectedReturn,
      date,
      recurrence: normalizeRecurrence(body.recurrence),
      notes: sanitizeString(body.notes),
      createdAt: nowIso,
      updatedAt: nowIso,
      excludeFromTotals: Boolean(body.excludeFromTotals),
    };
  };

  const COLLECTION_MAP = {
    expenses: normalizeExpense,
    incomes: normalizeIncome,
    investments: normalizeInvestment,
  };

  const listHandler = collection =>
    async (req, res) => {
      try {
        const { uid } = req.auth;
        const snapshot = await getCollectionRef(uid, collection).orderBy('date', 'desc').get();
        const items = snapshot.docs.map(docSnap => {
          const data = docSnap.data() ?? {};
          return {
            id: docSnap.id,
            ...data,
            excludeFromTotals: Boolean(data.excludeFromTotals),
          };
        });
        const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        res.json({ items, totalAmount });
      } catch (error) {
        console.error(`[functions][finance] list ${collection}`, error);
        res.status(500).json({ message: 'Erro ao carregar registros.' });
      }
    };

  const createHandler = collection =>
    async (req, res) => {
      try {
        const { uid } = req.auth;
        const normalize = COLLECTION_MAP[collection];
        const payload = normalize(req.body);
        const collectionRef = getCollectionRef(uid, collection);
        const createdItems = [];
        const ref = await collectionRef.add(payload);
        createdItems.push({ id: ref.id, ...payload });
        const { recurrence } = payload;
        if (recurrence && recurrence.frequency && recurrence.frequency !== 'none') {
          const schedule = generateRecurringDates(payload.date, recurrence.frequency, recurrence.occurrences);
          if (schedule.length > 1) {
            const batch = firestore.batch();
            schedule.slice(1).forEach(date => {
              const clonedRef = collectionRef.doc();
              const clonePayload = { ...payload, date };
              batch.set(clonedRef, clonePayload);
              createdItems.push({ id: clonedRef.id, ...clonePayload });
            });
            await batch.commit();
          }
        }
        res.status(201).json({ items: createdItems });
      } catch (error) {
        console.error(`[functions][finance] create ${collection}`, error);
        res.status(400).json({ message: error.message || 'Erro ao criar registro.' });
      }
    };

  const updateHandler = collection =>
    async (req, res) => {
      try {
        const { uid } = req.auth;
        const { id } = req.params;
        if (!id) {
          res.status(400).json({ message: 'Informe o ID do registro.' });
          return;
        }
        const normalize = COLLECTION_MAP[collection];
        const payload = normalize(req.body);
        const ref = getCollectionRef(uid, collection).doc(id);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
          res.status(404).json({ message: 'Registro não encontrado.' });
          return;
        }
        const updatedPayload = {
          ...payload,
          amount: payload.amount,
          expectedReturn: payload.expectedReturn ?? null,
          updatedAt: new Date().toISOString(),
        };
        await ref.update(updatedPayload);
        res.json({ id, ...updatedPayload });
      } catch (error) {
        console.error(`[functions][finance] update ${collection}`, error);
        res.status(400).json({ message: error.message || 'Erro ao atualizar registro.' });
      }
    };

  const deleteHandler = collection =>
    async (req, res) => {
      try {
        const { uid } = req.auth;
        const { id } = req.params;
        if (!id) {
          res.status(400).json({ message: 'Informe o ID do registro.' });
          return;
        }
        const ref = getCollectionRef(uid, collection).doc(id);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
          res.status(404).json({ message: 'Registro não encontrado.' });
          return;
        }
        await ref.delete();
        res.status(204).send();
      } catch (error) {
        console.error(`[functions][finance] delete ${collection}`, error);
        res.status(500).json({ message: 'Erro ao remover registro.' });
      }
    };

  Object.keys(COLLECTION_MAP).forEach(collection => {
    financeRouter.get(`/${collection}`, listHandler(collection));
    financeRouter.post(`/${collection}`, createHandler(collection));
    financeRouter.patch(`/${collection}/:id`, updateHandler(collection));
    financeRouter.delete(`/${collection}/:id`, deleteHandler(collection));
  });

  financeRouter.get('/categories', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getCategoriesDocRef(uid).get();
      if (!snapshot.exists) {
        res.json({ categories: DEFAULT_CATEGORIES });
        return;
      }
      const categories = mergeCategories(snapshot.data());
      res.json({ categories });
    } catch (error) {
      console.error('[functions][finance] list categories', error);
      res.status(500).json({ message: 'Erro ao carregar categorias.' });
    }
  });

  financeRouter.post('/categories/:group', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { group } = req.params;
      if (!CATEGORY_GROUPS.includes(group)) {
        res.status(400).json({ message: 'Grupo de categorias inválido.' });
        return;
      }
      const category = sanitizeString(req.body?.category);
      if (!category) {
        res.status(400).json({ message: 'Informe o nome da categoria.' });
        return;
      }
      await getCategoriesDocRef(uid).set(
        {
          [group]: admin.firestore.FieldValue.arrayUnion(category),
        },
        { merge: true }
      );
      res.status(201).json({ category });
    } catch (error) {
      console.error('[functions][finance] add category', error);
      res.status(500).json({ message: 'Erro ao salvar categoria.' });
    }
  });

  financeRouter.delete('/categories/:group', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { group } = req.params;
      const category = sanitizeString(req.query?.category);
      if (!CATEGORY_GROUPS.includes(group) || !category) {
        res.status(400).json({ message: 'Informe um grupo e categoria válidos.' });
        return;
      }
      await getCategoriesDocRef(uid).set(
        {
          [group]: admin.firestore.FieldValue.arrayRemove(category),
        },
        { merge: true }
      );
      res.status(204).send();
    } catch (error) {
      console.error('[functions][finance] remove category', error);
      res.status(500).json({ message: 'Erro ao remover categoria.' });
    }
  });

  financeRouter.get('/planner', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { year, month } = req.query;
      if (!year || !month) {
        res.status(400).json({ message: 'Informe ano e mês para carregar o planner.' });
        return;
      }
      const periodKey = buildPlannerKey(year, month);
      const docRef = getPlannerDocRef(uid, periodKey);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        res.json({ allocations: {}, goals: [], periodKey });
        return;
      }
      const data = snapshot.data() ?? {};
      res.json({
        allocations: normalizeAllocations(data.allocations),
        goals: normalizeGoals(data.goals),
        periodKey,
      });
    } catch (error) {
      console.error('[functions][finance] load planner', error);
      res.status(500).json({ message: 'Erro ao carregar planner.' });
    }
  });

  financeRouter.put('/planner', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { periodKey, allocations, goals } = req.body ?? {};
      if (!periodKey || typeof periodKey !== 'string') {
        res.status(400).json({ message: 'Informe o período do planner.' });
        return;
      }
      const docRef = getPlannerDocRef(uid, periodKey);
      await docRef.set(
        {
          allocations: normalizeAllocations(allocations),
          goals: normalizeGoals(goals),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      res.status(204).send();
    } catch (error) {
      console.error('[functions][finance] save planner', error);
      res.status(500).json({ message: 'Não foi possível salvar o planner.' });
    }
  });

  return financeRouter;
};
