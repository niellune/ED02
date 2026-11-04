import { Router } from 'express';
import { PLANS } from '../plans.js';
import { adminPage } from '../views/app.js';
import { requireUser, send } from './helpers.js';

export default function adminRoutes({ db, config }) {
  const router = Router();
  const requireAdmin = (req, res, next) => {
    if (!config.adminEmails.includes(String(req.user?.email).toLowerCase())) return res.status(404).send('Not found');
    next();
  };

  router.get('/admin', requireUser, requireAdmin, (req, res) => {
    const t = Date.now();
    const week = t - 7 * 86_400_000;
    const one = (sql, ...p) => db.prepare(sql).get(...p).n;
    const pro = one(`SELECT COUNT(*) AS n FROM users WHERE plan = 'pro'`);
    const metrics = {
      users: one('SELECT COUNT(*) AS n FROM users'),
      users7d: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', week),
      pro,
      mrr: pro * PLANS.pro.priceMonthly,
      codes: one('SELECT COUNT(*) AS n FROM codes'),
      scans7d: one('SELECT COUNT(*) AS n FROM scans WHERE ts >= ?', week),
    };
    const reports = db.prepare(`SELECT r.*, c.id AS code_id, c.destination FROM abuse_reports r LEFT JOIN codes c ON c.slug = r.slug WHERE r.resolved = 0 ORDER BY r.created_at DESC LIMIT 100`).all();
    const recentUsers = db.prepare('SELECT u.email, u.plan, u.created_at, (SELECT COUNT(*) FROM codes c WHERE c.user_id = u.id) AS codes FROM users u ORDER BY u.id DESC LIMIT 20').all();
    send(res, adminPage(req.ctx, { metrics, reports, recentUsers }));
  });

  router.post('/admin/reports/:id', requireUser, requireAdmin, (req, res) => {
    const report = db.prepare('SELECT * FROM abuse_reports WHERE id = ?').get(Number(req.params.id));
    if (report) {
      if (req.body.action === 'disable') {
        db.prepare(`UPDATE codes SET disabled_reason = 'reported for abuse and confirmed by our team' WHERE slug = ?`).run(report.slug);
      }
      db.prepare('UPDATE abuse_reports SET resolved = 1 WHERE slug = ?').run(report.slug);
    }
    res.redirect(303, '/admin');
  });

  return router;
}
