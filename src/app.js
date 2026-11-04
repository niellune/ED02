import express from 'express';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createMailer } from './mailer.js';
import { hmac, safeEqual, sha256 } from './security.js';
import { messagePage } from './views/marketing.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import codeRoutes from './routes/codes.js';
import accountRoutes from './routes/account.js';
import billingRoutes, { webhookHandler } from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import redirectRoutes from './routes/redirect.js';

import { SESSION_COOKIE } from './routes/helpers.js';
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const CSRF_EXEMPT = [/^\/login$/, /^\/signup$/, /^\/forgot$/, /^\/reset\//, /^\/report$/];

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createApp({ config = loadConfig(), db, mailer, stripe } = {}) {
  db = db || openDb(config.dbPath);
  const deps = { config, db, mailer: mailer || createMailer(config), stripe };
  const app = express();
  app.locals.deps = deps;
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': [
        "default-src 'self'",
        "img-src 'self' data:",
        `script-src 'self'${config.plausibleDomain ? ' https://plausible.io' : ''}`,
        `connect-src 'self'${config.plausibleDomain ? ' https://plausible.io' : ''}`,
        "style-src 'self'",
        "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join('; '),
    });
    if (config.secureCookies) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.get('/healthz', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });

  // Redirects are the hot path: keep them ahead of sessions and body parsing.
  app.use(redirectRoutes(deps));

  // Stripe needs the raw body to verify signatures.
  app.post('/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhookHandler(deps));

  app.use(express.static(PUBLIC_DIR, { maxAge: config.isProd ? '1d' : 0 }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // Session + CSRF
  app.use((req, res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    req.user = null;
    if (token) {
      const row = db.prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
      ).get(sha256(token), Date.now());
      if (row) req.user = row;
    }
    const csrf = req.user ? hmac(config.sessionSecret, `csrf:${token}`) : '';
    req.ctx = { config, user: req.user, csrf };
    if (req.method === 'POST' && req.user && !CSRF_EXEMPT.some((re) => re.test(req.path))) {
      if (!safeEqual(req.body?._csrf || '', csrf)) {
        return res.status(403).send(messagePage(req.ctx, { title: 'Session expired', message: 'Please go back, refresh the page and try again.' }).toString());
      }
    }
    next();
  });

  app.use(publicRoutes(deps));
  app.use(authRoutes(deps));
  app.use(codeRoutes(deps));
  app.use(accountRoutes(deps));
  app.use(billingRoutes(deps));
  app.use(adminRoutes(deps));

  app.use((req, res) => {
    res.status(404).send(messagePage(req.ctx || { config }, { title: 'Page not found', message: "We couldn't find that page.", status: 404 }).toString());
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(messagePage(req.ctx || { config }, { title: 'Something went wrong', message: 'We hit an unexpected error. Please try again in a moment.' }).toString());
  });

  return app;
}
