const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const admin = require('firebase-admin');
const Layer = require('express/lib/router/layer');
const Router = require('express/lib/router');

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const originalHandleRequest = Layer.prototype.handle_request;
Layer.prototype.handle_request = function patchedHandleRequest(req, res, next) {
  if (typeof this.handle !== 'function') {
    console.error('[functions] Layer missing handler', {
      name: this.name,
      route: this.route ? this.route.path : undefined,
      regexp: this.regexp ? this.regexp.toString() : undefined,
    });
    const error = new Error('Layer missing handler');
    return next ? next(error) : undefined;
  }
  return originalHandleRequest.call(this, req, res, next);
};

const loadLocalEnv = () => {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const parseLine = line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return null;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return null;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      return null;
    }
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '');
    return { key, value: unquoted };
  };

  const fileContent = fs.readFileSync(envPath, 'utf8');
  fileContent.split(/\r?\n/).forEach(line => {
    const parsed = parseLine(line);
    if (!parsed) {
      return;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  });
};

loadLocalEnv();

const sanitizeEnv = value => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const parseAllowedOrigins = () => {
  const raw = sanitizeEnv(process.env.ALLOWED_ORIGINS);
  if (!raw) {
    return [];
  }

  const configured = raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const merged = new Set(configured);
  DEVELOPMENT_ORIGINS.forEach(origin => merged.add(origin));

  return Array.from(merged);
};

const getConfig = () => ({
  secretKey: sanitizeEnv(process.env.STRIPE_SECRET_KEY),
  priceId: sanitizeEnv(process.env.STRIPE_PRICE_ID),
  checkoutMode: sanitizeEnv(process.env.STRIPE_CHECKOUT_MODE) || 'subscription',
});

const AUTH_HEADER_PREFIX = 'Bearer ';
const PAYMENT_METHODS = ['dinheiro', 'debito', 'credito', 'pix', 'boleto', 'outro'];
const INVESTMENT_TYPES = ['renda_fixa', 'renda_variavel', 'fundo', 'poupanca', 'outro'];
const RECURRENCE_VALUES = ['none', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'];
const RECURRENCE_INTERVAL_IN_MONTHS = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};
const TASK_STATUSES = ['open', 'in_progress', 'completed'];
const TASK_PRIORITIES = ['do_first', 'schedule', 'delegate', 'eliminate'];
const TASK_DEFAULT_GAMIFICATION = {
  totalPoints: 0,
  level: 1,
  streak: 0,
  lastCompletedAt: null,
};
const NOTE_DEFAULT_PAYLOAD = {
  title: 'Nota sem título',
  content: '',
  tags: [],
  pinned: false,
};
const CATEGORY_GROUPS = ['expenses', 'incomes', 'investments'];
const DEFAULT_CATEGORIES = {
  expenses: ['Moradia', 'Alimentação', 'Transporte', 'Educação'],
  incomes: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
  investments: ['Renda fixa', 'Renda variável', 'Poupança', 'Fundo'],
};
const CALENDAR_TAGS = ['Reunião', 'Pessoal', 'Entrega', 'Lembrete'];
const RELATIONSHIP_STAGES = ['Contato inicial', 'Oportunidade', 'Negociação', 'Fidelizado'];
const RELATIONSHIP_PRIORITIES = ['Alta', 'Média', 'Baixa'];
const RELATIONSHIP_CHANNELS = ['Ligação', 'Reunião', 'E-mail', 'Mensagem', 'Anotação'];
const TIME_CLOCK_SHIFT_TYPES = ['padrao', 'homeOffice', 'viagem'];
const ACCOUNT_AVATAR_MAX_SIZE = 4 * 1024 * 1024;
const ACCOUNT_DEFAULT_NAME = 'Usuário';
const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

const initializeStripe = () => {
  const { secretKey } = getConfig();
  if (!secretKey) {
    throw new Error(
      'Stripe secret key not configured. Define STRIPE_SECRET_KEY in your environment (.env).'
    );
  }
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
};

let stripe = null;
let stripeInitializationError = null;

const attemptStripeInitialization = () => {
  try {
    stripe = initializeStripe();
    stripeInitializationError = null;
  } catch (error) {
    stripe = null;
    if (!stripeInitializationError || stripeInitializationError.message !== error.message) {
      console.warn(
        '[functions][stripe] Inicialização do Stripe pulada:',
        error instanceof Error ? error.message : error
      );
    }
    stripeInitializationError = error;
  }
  return stripe;
};

const ensureStripeClient = () => {
  const instance = stripe || attemptStripeInitialization();
  if (instance) {
    return instance;
  }
  const error = new Error(
    'Stripe não está configurado. Defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID para habilitar pagamentos.'
  );
  error.code = 'STRIPE_NOT_CONFIGURED';
  if (stripeInitializationError) {
    error.cause = stripeInitializationError;
  }
  throw error;
};

attemptStripeInitialization();
const allowedOrigins = parseAllowedOrigins();

const sanitizeString = value => (typeof value === 'string' ? value.trim() : '');

const parseNumber = (value, field) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Campo ${field ?? 'valor'} inválido.`);
  }
  return parsed;
};

const ensureDate = (isoDate, field) => {
  const sanitized = sanitizeString(isoDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    throw new Error(`Campo ${field ?? 'data'} inválido. Use o formato AAAA-MM-DD.`);
  }
  return sanitized;
};

const ensureTimeValue = (time, field, { optional = false } = {}) => {
  const sanitized = sanitizeString(time);
  if (!sanitized) {
    if (optional) {
      return '';
    }
    throw new Error(`Informe ${field ?? 'o horário'} no formato HH:MM.`);
  }
  if (!/^\d{2}:\d{2}$/.test(sanitized)) {
    throw new Error(`Campo ${field ?? 'horário'} inválido. Use o formato HH:MM.`);
  }
  return sanitized;
};

const generateRecurringDates = (date, frequency, occurrences) => {
  const sanitizedOccurrences = Math.max(1, Math.min(Number(occurrences) || 1, 24));
  if (frequency === 'none' || sanitizedOccurrences === 1) {
    return [date];
  }
  const interval = RECURRENCE_INTERVAL_IN_MONTHS[frequency];
  if (!interval) {
    return [date];
  }
  const pad = value => value.toString().padStart(2, '0');
  const addMonthsPreservingDay = (isoDate, monthsToAdd) => {
    const [yearString, monthString, dayString] = isoDate.split('-');
    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return isoDate;
    }
    const totalMonths = month - 1 + monthsToAdd;
    const nextYear = year + Math.floor(totalMonths / 12);
    const nextMonthIndex = ((totalMonths % 12) + 12) % 12;
    const lastDayOfTargetMonth = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayOfTargetMonth);
    return `${nextYear}-${pad(nextMonthIndex + 1)}-${pad(safeDay)}`;
  };

  const schedule = [date];
  for (let index = 1; index < sanitizedOccurrences; index += 1) {
    schedule.push(addMonthsPreservingDay(date, interval * index));
  }
  return schedule;
};

const authenticateRequest = async req => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(AUTH_HEADER_PREFIX)) {
    const error = new Error('UNAUTHENTICATED');
    error.code = 'UNAUTHENTICATED';
    throw error;
  }
  const token = header.slice(AUTH_HEADER_PREFIX.length);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    const authError = new Error('UNAUTHENTICATED');
    authError.code = 'UNAUTHENTICATED';
    throw authError;
  }
};

const getUserProfile = async uid => {
  const snapshot = await firestore.collection('users').doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data();
};

const isSubscriptionActive = profile => {
  if (!profile) {
    return true;
  }
  const status = profile.subscriptionStatus ?? 'active';
  if (status === 'active') {
    return true;
  }
  if (status === 'pending_cancel' && profile.activeUntil) {
    const expiresAt = new Date(profile.activeUntil).getTime();
    return Number.isFinite(expiresAt) && expiresAt >= Date.now();
  }
  return false;
};

const createCorsMiddleware = () => {
  if (allowedOrigins.length === 0) {
    return cors({ origin: true, credentials: true });
  }

  const options = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      console.warn('[functions][cors] origin blocked', origin);
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  };

  return cors(options);
};

const applyCors = (req, res, next) => {
  const middleware = createCorsMiddleware();
  middleware(req, res, err => {
    if (err) {
      res.status(403).json({ message: 'Origem não autorizada.' });
      return;
    }
    next();
  });
};

const getAccountDocRef = uid => firestore.collection('users').doc(uid);

const resolveAuthFallbackName = userRecord => {
  if (!userRecord) {
    return ACCOUNT_DEFAULT_NAME;
  }
  if (userRecord.displayName) {
    return userRecord.displayName;
  }
  if (userRecord.email) {
    return userRecord.email.split('@')[0];
  }
  return ACCOUNT_DEFAULT_NAME;
};

const normalizeAccountProfile = (data = {}, userRecord = null) => ({
  displayName: sanitizeString(data.displayName) || resolveAuthFallbackName(userRecord),
  photoURL: sanitizeString(data.photoURL) || (userRecord ? userRecord.photoURL : null) || null,
  subscriptionStatus: data.subscriptionStatus || 'active',
  updatedAt: data.updatedAt || null,
  canceledAt: data.canceledAt || null,
  activeUntil: data.activeUntil || null,
  cancellationRequestedAt: data.cancellationRequestedAt || null,
});

const fetchAccountProfile = async uid => {
  const docRef = getAccountDocRef(uid);
  const [snapshot, userRecord] = await Promise.all([docRef.get(), admin.auth().getUser(uid)]);
  if (!snapshot.exists) {
    const fallback = normalizeAccountProfile({}, userRecord);
    await docRef.set(
      {
        displayName: fallback.displayName,
        photoURL: fallback.photoURL ?? null,
        subscriptionStatus: fallback.subscriptionStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return fallback;
  }
  return normalizeAccountProfile(snapshot.data() ?? {}, userRecord);
};

const inferAvatarExtension = (contentType, fileName) => {
  const lowerContentType = (contentType || '').toLowerCase();
  if (lowerContentType === 'image/png') {
    return 'png';
  }
  if (lowerContentType === 'image/webp') {
    return 'webp';
  }
  if (lowerContentType === 'image/gif') {
    return 'gif';
  }
  if (lowerContentType === 'image/svg+xml') {
    return 'svg';
  }
  if (fileName && fileName.includes('.')) {
    return fileName.split('.').pop().toLowerCase() || 'jpg';
  }
  return 'jpg';
};

module.exports = {
  admin,
  allowedOrigins,
  applyCors,
  authenticateRequest,
  AUTH_HEADER_PREFIX,
  BILLING_CYCLE_MS,
  CATEGORY_GROUPS,
  CALENDAR_TAGS,
  cors,
  crypto,
  DEFAULT_CATEGORIES,
  DEVELOPMENT_ORIGINS,
  express,
  firestore,
  functions,
  generateRecurringDates,
  getConfig,
  getUserProfile,
  initializeStripe,
  ensureStripeClient,
  INVESTMENT_TYPES,
  isSubscriptionActive,
  NOTE_DEFAULT_PAYLOAD,
  PAYMENT_METHODS,
  RECURRENCE_VALUES,
  RELATIONSHIP_CHANNELS,
  RELATIONSHIP_PRIORITIES,
  RELATIONSHIP_STAGES,
  sanitizeEnv,
  sanitizeString,
  stripe,
  TASK_DEFAULT_GAMIFICATION,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TIME_CLOCK_SHIFT_TYPES,
  ACCOUNT_AVATAR_MAX_SIZE,
  ACCOUNT_DEFAULT_NAME,
  loadLocalEnv,
  parseAllowedOrigins,
  parseNumber,
  ensureDate,
  ensureTimeValue,
  getAccountDocRef,
  resolveAuthFallbackName,
  normalizeAccountProfile,
  fetchAccountProfile,
  inferAvatarExtension,
  Stripe,
};
