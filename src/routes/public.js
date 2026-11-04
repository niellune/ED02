import { Router } from 'express';
import QRCode from 'qrcode';
import { normalizeHex } from '../safety.js';
import { rateLimiter } from '../security.js';
import {
  USE_CASES, homePage, legalPage, pledgePage, pricingPage, reportPage, useCasePage,
} from '../views/marketing.js';
import { clientKey, send } from './helpers.js';

export async function renderQr({ data, fg = '#000000', bg = '#ffffff', ecc = 'M', format = 'svg', size = 1024 }) {
  const opts = { errorCorrectionLevel: ecc, margin: 2, color: { dark: fg, light: bg } };
  if (format === 'png') return QRCode.toBuffer(data, { ...opts, type: 'png', width: size });
  return QRCode.toString(data, { ...opts, type: 'svg' });
}

export function sendQr(res, body, { format, download, filename }) {
  res.type(format === 'png' ? 'image/png' : 'image/svg+xml');
  if (download) res.set('Content-Disposition', `attachment; filename="${filename}.${format}"`);
  res.send(body);
}

export default function publicRoutes({ db, config }) {
  const router = Router();
  const scale = config.rateLimitScale;
  const qrLimited = rateLimiter({ windowMs: 60_000, max: 120, scale });
  const reportLimited = rateLimiter({ windowMs: 3_600_000, max: 10, scale });

  router.get('/', (req, res) => send(res, homePage(req.ctx)));
  router.get('/pricing', (req, res) => send(res, pricingPage(req.ctx)));
  router.get('/no-hostage-pledge', (req, res) => send(res, pledgePage(req.ctx)));
  router.get('/terms', (req, res) => send(res, legalPage(req.ctx, 'terms')));
  router.get('/privacy', (req, res) => send(res, legalPage(req.ctx, 'privacy')));
  router.get('/qr-code-for/:slug', (req, res, next) => {
    if (!Object.hasOwn(USE_CASES, req.params.slug)) return next();
    send(res, useCasePage(req.ctx, req.params.slug));
  });

  // Free static QR generator. Stateless: the data is never stored or logged.
  router.get('/api/qr', async (req, res) => {
    if (qrLimited(clientKey(req))) return res.status(429).send('Too many requests, slow down a little.');
    const data = String(req.query.data || '');
    if (!data || data.length > 1000) return res.status(400).send('data must be 1–1000 characters');
    const format = req.query.format === 'png' ? 'png' : 'svg';
    const ecc = ['L', 'M', 'Q', 'H'].includes(req.query.ecc) ? req.query.ecc : 'M';
    const size = Math.min(2048, Math.max(128, Number(req.query.size) || 1024));
    const body = await renderQr({
      data, ecc, format, size, fg: normalizeHex(req.query.fg, '#000000'), bg: normalizeHex(req.query.bg, '#ffffff'),
    });
    res.set('Cache-Control', 'public, max-age=86400');
    sendQr(res, body, { format, download: Boolean(req.query.download), filename: 'qr-code' });
  });

  router.get('/report', (req, res) => send(res, reportPage(req.ctx, { values: { slug: String(req.query.slug || '') } })));
  router.post('/report', (req, res) => {
    const values = { slug: String(req.body.slug || '').trim(), details: String(req.body.details || '').trim(), email: String(req.body.email || '').trim() };
    if (reportLimited(clientKey(req))) return send(res, reportPage(req.ctx, { error: 'Too many reports from your network. Please email us instead.', values }), 429);
    if (!values.slug || !values.details) return send(res, reportPage(req.ctx, { error: 'Please fill in the link and what happened.', values }), 400);
    const slug = values.slug.split('/').filter(Boolean).pop().slice(0, 64);
    db.prepare('INSERT INTO abuse_reports (slug, details, reporter_email, created_at) VALUES (?, ?, ?, ?)')
      .run(slug, values.details.slice(0, 2000), values.email.slice(0, 200) || null, Date.now());
    send(res, reportPage(req.ctx, { done: true }));
  });

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nDisallow: /dashboard\nDisallow: /codes\nDisallow: /account\nDisallow: /admin\nDisallow: /r/\nDisallow: /api/\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
  });
  router.get('/sitemap.xml', (req, res) => {
    const paths = ['/', '/pricing', '/no-hostage-pledge', '/signup', '/terms', '/privacy', ...Object.keys(USE_CASES).map((s) => `/qr-code-for/${s}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${config.baseUrl}${p}</loc></url>`).join('')}</urlset>`);
  });

  return router;
}
