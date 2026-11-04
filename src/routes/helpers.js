export const SESSION_COOKIE = 'kq_session';
import { randomToken, sha256 } from '../security.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const send = (res, page, status = 200) => res.status(status).type('html').send(page.toString());

export function requireUser(req, res, next) {
  if (!req.user) return res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`);
  next();
}

export function startSession(deps, res, userId) {
  const token = randomToken();
  deps.db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: deps.config.secureCookies, maxAge: SESSION_TTL_MS, path: '/',
  });
}

export function clientKey(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Only allow same-site relative redirects after login.
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : '/dashboard';
}
