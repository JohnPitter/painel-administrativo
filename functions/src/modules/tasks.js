const {
  express,
  firestore,
  admin,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  TASK_DEFAULT_GAMIFICATION,
  TASK_PRIORITIES,
  TASK_STATUSES,
} = require('../shared/base');

module.exports = () => {

  const taskRouter = express.Router();

  taskRouter.use(async (req, res, next) => {
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
      console.error('[functions][tasks] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  const getTasksCollection = uid => firestore.collection('users').doc(uid).collection('tasks');
  const getPomodorosCollection = uid =>
    firestore.collection('users').doc(uid).collection('pomodoros');
  const getGamificationRef = uid =>
    firestore.collection('users').doc(uid).collection('settings').doc('tasks-gamification');

  const calculateTaskLevel = points => Math.max(1, Math.floor(points / 100) + 1);

  const getGamificationState = async uid => {
    const snapshot = await getGamificationRef(uid).get();
    if (!snapshot.exists) {
      await getGamificationRef(uid).set(TASK_DEFAULT_GAMIFICATION, { merge: true });
      return { ...TASK_DEFAULT_GAMIFICATION };
    }
    const data = snapshot.data() ?? {};
    return {
      totalPoints: Number(data.totalPoints) || 0,
      level: calculateTaskLevel(Number(data.totalPoints) || 0),
      streak: Number(data.streak) || 0,
      lastCompletedAt: data.lastCompletedAt ?? null,
    };
  };

  const updateGamification = async (uid, updater) => {
    const current = await getGamificationState(uid);
    const next = updater(current) ?? current;
    await getGamificationRef(uid).set(
      {
        totalPoints: next.totalPoints,
        level: calculateTaskLevel(next.totalPoints),
        streak: next.streak ?? 0,
        lastCompletedAt: next.lastCompletedAt ?? null,
      },
      { merge: true }
    );
    return next;
  };

  const sanitizeRequiredString = (value, field) => {
    const sanitized = sanitizeString(value);
    if (!sanitized) {
      throw new Error(`Informe ${field ?? 'o valor'} corretamente.`);
    }
    return sanitized;
  };

  const normalizeTaskPriority = priority =>
    TASK_PRIORITIES.includes(priority) ? priority : TASK_PRIORITIES[0];
  const normalizeTaskStatus = status => (TASK_STATUSES.includes(status) ? status : 'open');

  const computeTaskStreak = (state, completedAtIso) => {
    if (!state.lastCompletedAt) {
      return 1;
    }
    const lastDate = new Date(state.lastCompletedAt);
    const completedDate = new Date(completedAtIso);
    const diffInDays = Math.floor(
      (completedDate.setHours(0, 0, 0, 0) - lastDate.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    if (diffInDays === 0) {
      return state.streak ?? 1;
    }
    if (diffInDays === 1) {
      return (state.streak ?? 0) + 1;
    }
    return 1;
  };

  taskRouter.get('/gamification', async (req, res) => {
    try {
      const { uid } = req.auth;
      const gamification = await getGamificationState(uid);
      res.json({ gamification });
    } catch (error) {
      console.error('[functions][tasks] get gamification', error);
      res.status(500).json({ message: 'Erro ao carregar gamificação.' });
    }
  });

  taskRouter.get('/pomodoros', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getPomodorosCollection(uid).orderBy('startedAt', 'desc').get();
      const pomodoros = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() ?? {}),
      }));
      res.json({ pomodoros });
    } catch (error) {
      console.error('[functions][tasks] list pomodoros', error);
      res.status(500).json({ message: 'Erro ao carregar pomodoros.' });
    }
  });

  taskRouter.post('/pomodoros', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { taskId, durationMinutes } = req.body ?? {};
      const duration = Number(durationMinutes);
      if (!duration || duration <= 0) {
        res.status(400).json({ message: 'Informe a duração da sessão em minutos.' });
        return;
      }
      const start = new Date();
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const payload = {
        taskId: taskId ? sanitizeString(taskId) : null,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        durationMinutes: duration,
      };
      const ref = await getPomodorosCollection(uid).add(payload);

      if (taskId) {
        await getTasksCollection(uid)
          .doc(taskId)
          .set(
            {
              pomodoros: admin.firestore.FieldValue.increment(1),
              updatedAt: start.toISOString(),
            },
            { merge: true }
          );
      }

      await updateGamification(uid, current => {
        const pointsEarned = Math.max(1, Math.floor(duration / 5));
        const totalPoints = (current.totalPoints || 0) + pointsEarned;
        return {
          totalPoints,
          level: calculateTaskLevel(totalPoints),
          streak: current.streak ?? 0,
          lastCompletedAt: current.lastCompletedAt ?? null,
        };
      });

      res.status(201).json({ pomodoro: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][tasks] create pomodoro', error);
      res.status(400).json({ message: error.message || 'Erro ao registrar pomodoro.' });
    }
  });

  taskRouter.get('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const snapshot = await getTasksCollection(uid).orderBy('createdAt', 'desc').get();
      const tasks = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() ?? {}),
      }));
      res.json({ tasks });
    } catch (error) {
      console.error('[functions][tasks] list tasks', error);
      res.status(500).json({ message: 'Erro ao carregar tarefas.' });
    }
  });

  taskRouter.post('/', async (req, res) => {
    try {
      const { uid } = req.auth;
      const title = sanitizeRequiredString(req.body?.title, 'title');
      const description = sanitizeString(req.body?.description);
      const dueDate = sanitizeRequiredString(req.body?.dueDate, 'dueDate');
      const priority = normalizeTaskPriority(req.body?.priority);
      const status = normalizeTaskStatus(req.body?.status);
      const now = new Date().toISOString();
      const payload = {
        title,
        description,
        dueDate,
        priority,
        status,
        pomodoros: Number(req.body?.pomodoros) || 0,
        createdAt: now,
        updatedAt: now,
      };
      const ref = await getTasksCollection(uid).add(payload);
      res.status(201).json({ task: { id: ref.id, ...payload } });
    } catch (error) {
      console.error('[functions][tasks] create task', error);
      res.status(400).json({ message: error.message || 'Erro ao criar tarefa.' });
    }
  });

  taskRouter.patch('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da tarefa.' });
        return;
      }
      const ref = getTasksCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
        return;
      }
      const updates = {};
      if (req.body?.title !== undefined) {
        updates.title = sanitizeRequiredString(req.body.title, 'title');
      }
      if (req.body?.description !== undefined) {
        updates.description = sanitizeString(req.body.description);
      }
      if (req.body?.dueDate !== undefined) {
        updates.dueDate = sanitizeRequiredString(req.body.dueDate, 'dueDate');
      }
      if (req.body?.priority !== undefined) {
        updates.priority = normalizeTaskPriority(req.body.priority);
      }
      if (req.body?.status !== undefined) {
        updates.status = normalizeTaskStatus(req.body.status);
      }
      if (req.body?.pomodoros !== undefined) {
        updates.pomodoros = Number(req.body.pomodoros) || 0;
      }
      updates.updatedAt = new Date().toISOString();

      await ref.update(updates);
      res.json({ id, ...updates });
    } catch (error) {
      console.error('[functions][tasks] update task', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar tarefa.' });
    }
  });

  taskRouter.patch('/:id/status', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      const { status } = req.body ?? {};
      if (!id || !status) {
        res.status(400).json({ message: 'Informe o ID e o status.' });
        return;
      }
      const nextStatus = normalizeTaskStatus(status);
      const ref = getTasksCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
        return;
      }
      const previous = snapshot.data() ?? {};
      const nowIso = new Date().toISOString();
      await ref.update({ status: nextStatus, updatedAt: nowIso });

      if (nextStatus === 'completed' && previous.status !== 'completed') {
        await updateGamification(uid, current => {
          const totalPoints = (current.totalPoints || 0) + 10;
          return {
            totalPoints,
            level: calculateTaskLevel(totalPoints),
            streak: computeTaskStreak(current, nowIso),
            lastCompletedAt: nowIso,
          };
        });
      }

      res.json({ id, status: nextStatus, updatedAt: nowIso });
    } catch (error) {
      console.error('[functions][tasks] update task status', error);
      res.status(400).json({ message: error.message || 'Erro ao atualizar status.' });
    }
  });

  taskRouter.delete('/:id', async (req, res) => {
    try {
      const { uid } = req.auth;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da tarefa.' });
        return;
      }
      const ref = getTasksCollection(uid).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch (error) {
      console.error('[functions][tasks] delete task', error);
      res.status(500).json({ message: 'Erro ao remover tarefa.' });
    }
  });

  return taskRouter;
};
