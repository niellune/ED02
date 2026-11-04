import { Router } from 'express';
import { hashPassword, randomToken, rateLimiter, sha256, verifyPassword } from '../security.js';
import { forgotPage, loginPage, resetPage, signupPage } from '../views/auth.js';
import { SESSION_COOKIE, clientKey, safeNext, send, startSession } from './helpers.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export default function authRoutes(deps) {
  const { db, config, mailer } = deps;
  const router = Router();
  const scale = config.rateLimitScale;
  const loginLimited = rateLimiter({ windowMs: 15 * 60_000, max: 10, scale });
  const signupLimited = rateLimiter({ windowMs: 3_600_000, max: 10, scale });
  const forgotLimited = rateLimiter({ windowMs: 3_600_000, max: 5, scale });

  router.get('/signup', (req, res) => {
    if (req.user) return res.redirect(303, '/dashboard');
    send(res, signupPage(req.ctx, { plan: req.query.plan === 'pro' ? 'pro' : undefined }));
  });

  router.post('/signup', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const plan = req.body.plan === 'pro' ? 'pro' : undefined;
    if (signupLimited(clientKey(req))) return send(res, signupPage(req.ctx, { error: 'Too many sign-ups from your network. Try again later.', email, plan }), 429);
    if (!EMAIL_RE.test(email) || email.length > 200) return send(res, signupPage(req.ctx, { error: 'Please enter a valid email address.', email, plan }), 400);
    if (password.length < 8 || password.length > 200) return send(res, signupPage(req.ctx, { error: 'Your password needs at least 8 characters.', email, plan }), 400);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return send(res, signupPage(req.ctx, { error: 'An account with that email already exists. Try logging in.', email, plan }), 409);
    }
    const { lastInsertRowid } = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, await hashPassword(password), Date.now());
    startSession(deps, res, Number(lastInsertRowid));
    mailer({ to: email, subject: `Welcome to ${config.brand}`, text: `Thanks for signing up!\n\nCreate your first dynamic QR code: ${config.baseUrl}/dashboard\n\nYour codes will never be held hostage: ${config.baseUrl}/no-hostage-pledge\n\nReply to this email if you need anything.` }).catch(() => {});
    res.redirect(303, plan === 'pro' ? '/account' : '/dashboard');
  });

  router.get('/login', (req, res) => {
    if (req.user) return res.redirect(303, '/dashboard');
    send(res, loginPage(req.ctx, { notice: req.query.reset ? 'Password updated. Please log in.' : undefined }));
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (loginLimited(`${clientKey(req)}|${email}`)) return send(res, loginPage(req.ctx, { error: 'Too many attempts. Wait 15 minutes and try again.', email }), 429);
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    // Always run scrypt so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return send(res, loginPage(req.ctx, { error: 'Wrong email or password.', email }), 401);
    startSession(deps, res, user.id);
    res.redirect(303, safeNext(req.query.next));
  });

  router.post('/logout', (req, res) => {
    const token = (req.headers.cookie || '').match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(decodeURIComponent(token)));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.redirect(303, '/');
  });

  router.get('/forgot', (req, res) => send(res, forgotPage(req.ctx)));
  router.post('/forgot', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!forgotLimited(clientKey(req))) {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (user) {
        const token = randomToken();
        db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
          .run(sha256(token), user.id, Date.now() + 3_600_000);
        await mailer({ to: email, subject: `Reset your ${config.brand} password`, text: `Someone (hopefully you) asked to reset your password.\n\nChoose a new one here (valid for 1 hour):\n${config.baseUrl}/reset/${token}\n\nIf you didn't ask for this, ignore this email.` });
      }
    }
    send(res, forgotPage(req.ctx, { sent: true }));
  });

  const findReset = (token) => db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?').get(sha256(token), Date.now());

  router.get('/reset/:token', (req, res) => {
    const valid = findReset(req.params.token);
    send(res, resetPage(req.ctx, { token: req.params.token, invalid: !valid }), valid ? 200 : 400);
  });

  router.post('/reset/:token', async (req, res) => {
    const reset = findReset(req.params.token);
    if (!reset) return send(res, resetPage(req.ctx, { invalid: true }), 400);
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 200) return send(res, resetPage(req.ctx, { token: req.params.token, error: 'Your password needs at least 8 characters.' }), 400);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), reset.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(reset.token_hash);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
    res.redirect(303, '/login?reset=1');
  });

  return router;
}
