import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';

export async function startTestServer(env = {}, opts = {}) {
  const config = loadConfig({ DATABASE_PATH: ':memory:', BASE_URL: 'http://qr.test', ADMIN_EMAILS: 'admin@test.com', RATE_LIMIT_SCALE: '100', ...env });
  const db = openDb(':memory:');
  const mail = [];
  const app = createApp({ config, db, mailer: async (m) => { mail.push(m); }, ...opts });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, db, config, mail, close: () => new Promise((r) => server.close(r)) };
}

// Tiny cookie-keeping HTTP client.
export function client(base) {
  let cookie = '';
  async function request(method, path, { form, headers = {}, body } = {}) {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    let payload = body;
    if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
    const res = await fetch(base + path, { method, headers: h, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(';');
      cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  }
  const c = {
    get: (p, o) => request('GET', p, o),
    post: (p, form, o = {}) => request('POST', p, { ...o, form }),
    async csrf(path = '/dashboard') {
      const r = await c.get(path);
      return r.text.match(/name="_csrf" value="([^"]+)"/)?.[1];
    },
    async signup(email = `u${Math.random().toString(36).slice(2)}@test.com`, password = 'password123') {
      const r = await c.post('/signup', { email, password });
      if (r.status !== 303) throw new Error(`signup failed: ${r.status} ${r.text.slice(0, 200)}`);
      return email;
    },
    async createCode(name, destination) {
      const r = await c.post('/codes', { _csrf: await c.csrf(), name, destination });
      return { ...r, id: r.headers.get('location')?.match(/\/codes\/(\d+)/)?.[1] };
    },
  };
  return c;
}
