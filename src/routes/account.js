import { Router } from 'express';
import { planFor } from '../plans.js';
import { hashPassword, verifyPassword } from '../security.js';
import { accountPage } from '../views/app.js';
import { SESSION_COOKIE, requireUser, send } from './helpers.js';

export default function accountRoutes({ db, config }) {
  const router = Router();
  const billing = {
    enabled: config.billingEnabled,
    yearly: Boolean(config.stripe.priceYearly),
    dev: config.devBilling,
  };
  const render = (req, res, extra = {}, status = 200) => send(res, accountPage(req.ctx, { user: req.user, plan: planFor(req.user), billing, ...extra }), status);

  router.get('/account', requireUser, (req, res) => render(req, res, { msg: req.query.msg }));

  router.post('/account/password', requireUser, async (req, res) => {
    if (!(await verifyPassword(String(req.body.current || ''), req.user.password_hash))) return render(req, res, { error: 'Your current password is incorrect.' }, 400);
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 200) return render(req, res, { error: 'Your new password needs at least 8 characters.' }, 400);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), req.user.id);
    res.redirect(303, '/account?msg=password');
  });

  router.get('/account/export.json', requireUser, (req, res) => {
    const u = req.user;
    const codes = db.prepare('SELECT id, slug, name, destination, fg, bg, created_at, updated_at FROM codes WHERE user_id = ?').all(u.id)
      .map((c) => ({
        ...c,
        short_url: `${config.baseUrl}/r/${c.slug}`,
        scans: db.prepare('SELECT ts, device, os, browser, country FROM scans WHERE code_id = ? ORDER BY ts').all(c.id),
      }));
    res.set('Content-Disposition', 'attachment; filename="keepqr-export.json"')
      .json({ account: { email: u.email, plan: u.plan, created_at: u.created_at }, codes });
  });

  router.post('/account/delete', requireUser, async (req, res) => {
    if (!(await verifyPassword(String(req.body.password || ''), req.user.password_hash))) return render(req, res, { error: 'Password incorrect. Your account was not deleted.' }, 400);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id); // cascades to sessions, codes and scans
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.redirect(303, '/');
  });

  return router;
}
