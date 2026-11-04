import { Router } from 'express';
import { sha256 } from '../security.js';
import { classifyUA, isBot } from '../ua.js';
import { messagePage } from '../views/marketing.js';
import { send } from './helpers.js';

function countryFrom(req) {
  const c = String(req.get('cf-ipcountry') || req.get('x-vercel-ip-country') || req.get('x-country-code') || '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
}

export default function redirectRoutes({ db, config }) {
  const router = Router();
  const findCode = db.prepare('SELECT id, destination, disabled_reason FROM codes WHERE slug = ?');
  const insertScan = db.prepare(
    'INSERT INTO scans (code_id, ts, day, visitor, device, os, browser, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );

  router.get('/r/:slug', (req, res) => {
    const ctx = { config, user: null, csrf: '' };
    const code = findCode.get(req.params.slug);
    res.set('Cache-Control', 'no-store'); // destinations can change at any time
    if (!code) {
      return send(res, messagePage(ctx, { title: 'QR code not found', message: 'This QR code does not exist or was deleted by its owner.', status: 404 }), 404);
    }
    if (code.disabled_reason) {
      return send(res, messagePage(ctx, { title: 'Link disabled', message: 'This QR code was disabled because it violated our acceptable use policy.' }), 410);
    }
    const ua = req.get('user-agent') || '';
    if (!isBot(ua)) {
      const t = Date.now();
      const day = new Date(t).toISOString().slice(0, 10);
      // Daily-rotating, salted, one-way hash: estimates unique visitors without storing IPs.
      const visitor = sha256(`${config.sessionSecret}|${day}|${req.ip}|${ua}`).slice(0, 16);
      const { device, os, browser } = classifyUA(ua);
      insertScan.run(code.id, t, day, visitor, device, os, browser, countryFrom(req));
    }
    res.redirect(302, code.destination);
  });

  return router;
}
