/* eslint-disable no-console */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

dotenv.config();

const requiredEnv = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(
    `[stripe-backend] Defina as variáveis obrigatórias: ${missingEnv.join(
      ', '
    )}. Consulte o README para detalhes.`
  );
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : undefined;

app.use(
  cors(
    allowedOrigins && allowedOrigins.length > 0
      ? { origin: allowedOrigins }
      : { origin: true }
  )
);

const defaultProxyTarget =
  process.env.FUNCTIONS_PROXY_TARGET ||
  'https://southamerica-east1-painel-administrativo-br.cloudfunctions.net/api';
const proxyUrl = new URL(defaultProxyTarget);
const proxyPathBase = proxyUrl.pathname.endsWith('/')
  ? proxyUrl.pathname.slice(0, -1)
  : proxyUrl.pathname;
const proxyRequestFactory = proxyUrl.protocol === 'https:' ? httpsRequest : httpRequest;

app.use('/api', (req, res) => {
  const path = `${proxyPathBase}${req.url === '/' ? '' : req.url}`;
  const options = {
    protocol: proxyUrl.protocol,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path,
    headers: {
      ...req.headers,
      host: proxyUrl.host,
    },
  };

  const proxyReq = proxyRequestFactory(options, proxyRes => {
    res.status(proxyRes.statusCode ?? 500);
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', error => {
    console.error('[stripe-backend] API proxy error', error);
    if (!res.headersSent) {
      res
        .status(502)
        .json({ message: 'Não foi possível contatar a API. Verifique o Functions proxy.' });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq, { end: true });
});

app.use(express.json());

const port = Number(process.env.PORT || 4242);
const priceId = process.env.STRIPE_PRICE_ID;
const checkoutMode = process.env.STRIPE_CHECKOUT_MODE || 'subscription';

const ensureSuccessUrlHasSessionId = (url) => {
  if (!url.includes('{CHECKOUT_SESSION_ID}')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
  }
  return url;
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/checkout/sessions', async (req, res, next) => {
  try {
    const { name, email, successUrl, cancelUrl } = req.body ?? {};

    if (!email || !successUrl || !cancelUrl) {
      return res.status(400).json({
        message: 'Informe email, successUrl e cancelUrl para criar a sessão de checkout.',
      });
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
      success_url: ensureSuccessUrlHasSessionId(successUrl),
      cancel_url: cancelUrl,
      metadata: {
        name: name ?? '',
      },
      allow_promotion_codes: true,
    });

    return res.status(201).json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/checkout/sessions/:id', async (req, res, next) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ['customer'],
    });

    return res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail:
        session.customer_details?.email ?? session.customer?.email ?? session.customer_email ?? null,
      metadata: session.metadata ?? {},
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('[stripe-backend] Erro ao processar requisição', error);

  const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
  const message =
    typeof error.message === 'string'
      ? error.message
      : 'Não foi possível processar a solicitação. Tente novamente.';

  res.status(status).json({ message });
});

app.listen(port, () => {
  console.log(`[stripe-backend] Servidor pronto em http://localhost:${port}`);
});
