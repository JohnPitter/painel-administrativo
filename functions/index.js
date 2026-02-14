const base = require('./src/shared/base');
const moduleRegistry = require('./src/modules');

const { express, functions, applyCors, getConfig, sanitizeString, ensureStripeClient } = base;

const registerModules = router => {
  console.info(`[functions] Registering ${moduleRegistry.length} modules...`);
  moduleRegistry.forEach(({ key, basePath, factory }) => {
    try {
      if (typeof factory !== 'function') {
        throw new Error(`Module factory must be a function. Received ${typeof factory}.`);
      }
      const moduleRouter = factory();
      if (!moduleRouter || typeof moduleRouter !== 'function') {
        throw new Error(
          `Module "${key}" did not return a valid express router. Returned ${typeof moduleRouter}.`
        );
      }
      router.use(basePath, moduleRouter);
      console.info(`[functions] Module mounted: ${key} (${basePath})`);
    } catch (error) {
      console.error(`[functions] Failed to register module "${key}"`, error);
      throw error;
    }
  });
};

const ensureSessionIdPlaceholder = url => {
  if (!url.includes('{CHECKOUT_SESSION_ID}')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
  }
  return url;
};

const createApp = () => {
  const router = express.Router();
  router.use(applyCors);
  router.use(express.json());

  registerModules(router);
  if (Array.isArray(router.stack)) {
    console.info(
      '[functions] Router stack:',
      router.stack.map((layer, idx) => ({
        idx,
        name: layer.name,
        handleType: typeof layer.handle,
        route: layer.route ? layer.route.path : undefined,
        regexp: layer.regexp ? layer.regexp.toString() : undefined,
      }))
    );
  }

  router.post('/checkout/sessions', async (req, res) => {
    try {
      const stripe = ensureStripeClient();
      const { name, email, successUrl, cancelUrl, userId, context } = req.body || {};
      const { priceId, checkoutMode } = getConfig();

      if (!priceId) {
        throw new Error(
          'Stripe price id not configured. Define STRIPE_PRICE_ID in your environment (.env).'
        );
      }

      if (!email || !successUrl || !cancelUrl) {
        res.status(400).json({
          message: 'Informe email, successUrl e cancelUrl para criar a sessão de checkout.',
        });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: checkoutMode,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer_email: email,
        success_url: ensureSessionIdPlaceholder(successUrl),
        cancel_url: cancelUrl,
        metadata: {
          name: sanitizeString(name) || '',
          userId: sanitizeString(userId) || '',
          context: context || 'signup',
        },
        allow_promotion_codes: true,
      });

      res.status(201).json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error('[functions] createCheckoutSession failed', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Erro ao criar sessão de checkout.',
      });
    }
  });

  router.get('/checkout/sessions/:id', async (req, res) => {
    try {
      const stripe = ensureStripeClient();
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Informe o ID da sessão.' });
        return;
      }
      const session = await stripe.checkout.sessions.retrieve(id, { expand: ['customer'] });
      res.json({
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
        metadata: session.metadata ?? null,
      });
    } catch (error) {
      console.error('[functions] getCheckoutSessionStatus failed', error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível recuperar a sessão de checkout.',
      });
    }
  });

  const app = express();
  app.use(router);
  return app;
};

exports.api = functions.region('southamerica-east1').https.onRequest(createApp());
