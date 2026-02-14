const ctx = require('../shared/base');

module.exports = () => {
  const {
    express,
    sanitizeString,
    authenticateRequest,
    ensureStripeClient,
    getAccountDocRef,
    fetchAccountProfile,
    BILLING_CYCLE_MS,
  } = ctx;

  const billingRouter = express.Router();

  billingRouter.use(async (req, res, next) => {
    try {
      const uid = await authenticateRequest(req);
      req.auth = { uid };
      next();
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        res.status(401).json({ message: 'Autenticação necessária.' });
        return;
      }
      console.error('[functions][billing] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  billingRouter.post('/renew', async (req, res) => {
    try {
      const stripe = ensureStripeClient();
      const { uid } = req.auth;
      const sessionId = sanitizeString(req.body?.sessionId);
      if (!sessionId) {
        res.status(400).json({ message: 'Informe o identificador da sessão.' });
        return;
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer'],
      });
      if (session.status !== 'complete' || session.payment_status !== 'paid') {
        res.status(400).json({
          message: 'Ainda não recebemos a confirmação do pagamento. Tente novamente.',
        });
        return;
      }
      const metadataUserId = sanitizeString(session.metadata?.userId);
      const ownerId = metadataUserId || uid;
      if (ownerId !== uid) {
        res.status(403).json({
          message: 'Sessão de pagamento não pertence a este usuário.',
        });
        return;
      }
      const nextActiveUntil = new Date(Date.now() + BILLING_CYCLE_MS).toISOString();
      await getAccountDocRef(ownerId).set(
        {
          subscriptionStatus: 'active',
          canceledAt: null,
          cancellationRequestedAt: null,
          activeUntil: nextActiveUntil,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      const profile = await fetchAccountProfile(ownerId);
      res.json({ profile, activeUntil: nextActiveUntil });
    } catch (error) {
      console.error('[functions][billing] renew', error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível validar o pagamento. Caso o valor já tenha sido cobrado, entre em contato com o suporte.',
      });
    }
  });

  return billingRouter;
};
