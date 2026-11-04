import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { startTestServer, client } from './helpers.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv?.close(); });

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

test('marketing pages render with SEO essentials', async () => {
  const c = client(srv.base);
  for (const path of ['/', '/pricing', '/no-hostage-pledge', '/qr-code-for/restaurant-menu', '/terms', '/privacy', '/report']) {
    const r = await c.get(path);
    assert.equal(r.status, 200, path);
    assert.match(r.text, /<title>/);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  }
  assert.equal((await c.get('/qr-code-for/nope')).status, 404);
  assert.match((await c.get('/sitemap.xml')).text, /qr-code-for\/real-estate/);
  assert.match((await c.get('/robots.txt')).text, /Sitemap:/);
});

test('free static QR API returns SVG and PNG', async () => {
  const c = client(srv.base);
  const svg = await c.get('/api/qr?data=https://example.com&fg=%23112233');
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(svg.text, /<svg/);
  assert.match(svg.text, /#112233/);
  const png = await fetch(`${srv.base}/api/qr?data=hello&format=png&download=1`);
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.match(png.headers.get('content-disposition'), /attachment/);
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert.deepEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
  assert.equal((await c.get('/api/qr')).status, 400);
});

test('signup, login, logout and protected pages', async () => {
  const c = client(srv.base);
  assert.equal((await c.get('/dashboard')).status, 303);
  const email = await c.signup();
  assert.equal(srv.mail.at(-1).to, email);
  assert.equal((await c.get('/dashboard')).status, 200);

  const dup = client(srv.base);
  assert.equal((await dup.post('/signup', { email: email.toUpperCase(), password: 'password123' })).status, 409);

  await c.post('/logout', { _csrf: await c.csrf() });
  assert.equal((await c.get('/dashboard')).status, 303);
  assert.equal((await c.post('/login', { email, password: 'wrong-password' })).status, 401);
  const ok = await c.post('/login', { email, password: 'password123' });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), '/dashboard');
});

test('rejects POSTs without a valid CSRF token', async () => {
  const c = client(srv.base);
  await c.signup();
  const r = await c.post('/codes', { name: 'x', destination: 'https://example.com', _csrf: 'nope' });
  assert.equal(r.status, 403);
});

test('dynamic code lifecycle: create, redirect, count scans, edit, analytics', async () => {
  const c = client(srv.base);
  await c.signup();
  const created = await c.createCode('Table menu', 'example.com/menu');
  assert.equal(created.status, 303);
  const { slug, destination } = srv.db.prepare('SELECT slug, destination FROM codes WHERE id = ?').get(Number(created.id));
  assert.equal(destination, 'https://example.com/menu', 'scheme is added');

  const scan = await fetch(`${srv.base}/r/${slug}`, { redirect: 'manual', headers: { 'user-agent': IPHONE, 'cf-ipcountry': 'DE' } });
  assert.equal(scan.status, 302);
  assert.equal(scan.headers.get('location'), 'https://example.com/menu');
  assert.equal(scan.headers.get('cache-control'), 'no-store');
  await fetch(`${srv.base}/r/${slug}`, { redirect: 'manual', headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' } });

  const scans = srv.db.prepare('SELECT * FROM scans WHERE code_id = ?').all(Number(created.id));
  assert.equal(scans.length, 1, 'bots are not counted');
  assert.equal(scans[0].device, 'mobile');
  assert.equal(scans[0].os, 'iOS');
  assert.equal(scans[0].country, 'DE');
  assert.equal(scans[0].visitor.length, 16);

  const page = await c.get(`/codes/${created.id}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /iOS/);

  const edit = await c.post(`/codes/${created.id}`, { _csrf: await c.csrf(), name: 'Dinner menu', destination: 'https://example.org/dinner' });
  assert.equal(edit.status, 303);
  const again = await fetch(`${srv.base}/r/${slug}`, { redirect: 'manual', headers: { 'user-agent': IPHONE } });
  assert.equal(again.headers.get('location'), 'https://example.org/dinner');

  const img = await c.get(`/codes/${created.id}/qr.svg`);
  assert.match(img.text, /<svg/);
  assert.equal((await fetch(`${srv.base}/r/doesnotexist`, { redirect: 'manual' })).status, 404);
});

test('users cannot see or edit other users’ codes', async () => {
  const a = client(srv.base); await a.signup();
  const { id } = await a.createCode('Mine', 'https://example.com');
  const b = client(srv.base); await b.signup();
  assert.equal((await b.get(`/codes/${id}`)).status, 404);
  assert.equal((await b.post(`/codes/${id}/delete`, { _csrf: await b.csrf() })).status, 404);
  assert.equal((await b.get(`/codes/${id}/qr.png`)).status, 404);
});

test('destination safety checks', async () => {
  const c = client(srv.base); await c.signup();
  for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'http://127.0.0.1/admin', 'https://bit.ly/abc', 'http://localhost:3000', 'https://user:pw@example.com', 'http://qr.test/r/abc']) {
    const r = await c.createCode('Bad', bad);
    assert.equal(r.status, 400, bad);
  }
});

test('free plan limit, read-only after downgrade, and codes keep redirecting (no-hostage)', async () => {
  const c = client(srv.base); await c.signup();
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await c.createCode(`Code ${i}`, `https://example.com/${i}`)).id);
  assert.equal((await c.createCode('One too many', 'https://example.com/x')).status, 403);

  // Upgrade (dev billing), create more, then downgrade.
  assert.equal((await c.post('/billing/dev-upgrade', { _csrf: await c.csrf() })).status, 303);
  const extra = await c.createCode('Pro code', 'https://example.com/pro');
  assert.equal(extra.status, 303);
  assert.match((await c.get(`/codes/${extra.id}/scans.csv`)).text, /timestamp_utc/);
  await c.post('/billing/dev-downgrade', { _csrf: await c.csrf('/account') });

  const page = await c.get(`/codes/${extra.id}`);
  assert.match(page.text, /read-only/);
  const blocked = await c.post(`/codes/${extra.id}`, { _csrf: await c.csrf(), name: 'Changed', destination: 'https://evil.example' });
  assert.equal(blocked.status, 303);
  const slug = srv.db.prepare('SELECT slug, destination FROM codes WHERE id = ?').get(Number(extra.id));
  assert.equal(slug.destination, 'https://example.com/pro', 'read-only code unchanged');
  const r = await fetch(`${srv.base}/r/${slug.slug}`, { redirect: 'manual', headers: { 'user-agent': IPHONE } });
  assert.equal(r.status, 302, 'over-limit code still redirects after downgrade');
  assert.equal((await c.get(`/codes/${extra.id}/scans.csv`)).status, 303, 'CSV export is Pro-only');
  // Oldest codes remain editable.
  const edit = await c.post(`/codes/${ids[0]}`, { _csrf: await c.csrf(), name: 'Edited', destination: 'https://example.com/edited' });
  assert.equal(edit.status, 303);
  assert.equal(srv.db.prepare('SELECT name FROM codes WHERE id = ?').get(Number(ids[0])).name, 'Edited');
});

test('pro colors are validated for scannability', async () => {
  const c = client(srv.base); await c.signup();
  await c.post('/billing/dev-upgrade', { _csrf: await c.csrf() });
  const { id } = await c.createCode('Colors', 'https://example.com');
  const bad = await c.post(`/codes/${id}`, { _csrf: await c.csrf(), name: 'Colors', destination: 'https://example.com', fg: '#eeeeee', bg: '#ffffff' });
  assert.equal(bad.status, 400);
  const good = await c.post(`/codes/${id}`, { _csrf: await c.csrf(), name: 'Colors', destination: 'https://example.com', fg: '#0f766e', bg: '#ffffff' });
  assert.equal(good.status, 303);
  assert.match((await c.get(`/codes/${id}/qr.svg`)).text, /#0f766e/);
});

test('password reset flow', async () => {
  const c = client(srv.base);
  const email = await c.signup();
  const anon = client(srv.base);
  await anon.post('/forgot', { email });
  const link = srv.mail.at(-1).text.match(/\/reset\/([\w-]+)/);
  assert.ok(link, 'reset email sent');
  assert.equal((await anon.get(`/reset/${link[1]}`)).status, 200);
  assert.equal((await anon.post(`/reset/${link[1]}`, { password: 'new-password-1' })).status, 303);
  assert.equal((await anon.post(`/reset/${link[1]}`, { password: 'again-password' })).status, 400, 'token single use');
  assert.equal((await c.get('/dashboard')).status, 303, 'existing sessions revoked');
  assert.equal((await anon.post('/login', { email, password: 'new-password-1' })).status, 303);
});

test('abuse report and admin disable', async () => {
  const owner = client(srv.base); await owner.signup();
  const { id } = await owner.createCode('Suspicious', 'https://example.com/login');
  const { slug } = srv.db.prepare('SELECT slug FROM codes WHERE id = ?').get(Number(id));
  const anon = client(srv.base);
  assert.equal((await anon.post('/report', { slug: `http://qr.test/r/${slug}`, details: 'Phishing page' })).status, 200);

  const nonAdmin = client(srv.base); await nonAdmin.signup();
  assert.equal((await nonAdmin.get('/admin')).status, 404);

  const admin = client(srv.base); await admin.signup('admin@test.com');
  const page = await admin.get('/admin');
  assert.match(page.text, /Phishing page/);
  const reportId = srv.db.prepare('SELECT id FROM abuse_reports WHERE slug = ?').get(slug).id;
  await admin.post(`/admin/reports/${reportId}`, { _csrf: await admin.csrf('/admin'), action: 'disable' });
  const r = await fetch(`${srv.base}/r/${slug}`, { redirect: 'manual', headers: { 'user-agent': IPHONE } });
  assert.equal(r.status, 410);
});

test('account export and deletion', async () => {
  const c = client(srv.base);
  const email = await c.signup();
  await c.createCode('Export me', 'https://example.com');
  const exp = JSON.parse((await c.get('/account/export.json')).text);
  assert.equal(exp.account.email, email);
  assert.equal(exp.codes[0].name, 'Export me');
  assert.equal((await c.post('/account/delete', { _csrf: await c.csrf('/account'), password: 'wrong' })).status, 400);
  assert.equal((await c.post('/account/delete', { _csrf: await c.csrf('/account'), password: 'password123' })).status, 303);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email).n, 0);
});

test('stripe webhooks upgrade and downgrade users idempotently', async () => {
  const secret = 'whsec_test_secret';
  const s = await startTestServer({ STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, STRIPE_PRICE_PRO_MONTHLY: 'price_123' });
  try {
    const stripe = new Stripe('sk_test_dummy');
    const c = client(s.base);
    const email = await c.signup();
    const user = s.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    const send = (event, sig = true) => {
      const payload = JSON.stringify(event);
      const header = sig ? stripe.webhooks.generateTestHeaderString({ payload, secret }) : 't=1,v1=bad';
      return fetch(`${s.base}/billing/webhook`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
    };
    const checkout = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: String(user.id), customer: 'cus_1', subscription: 'sub_1' } } };
    assert.equal((await send(checkout, false)).status, 400, 'bad signature rejected');
    assert.equal((await send(checkout)).status, 200);
    assert.equal(s.db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id).plan, 'pro');

    const pastDue = { id: 'evt_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'past_due', metadata: {} } } };
    await send(pastDue);
    assert.equal(s.db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id).plan, 'pro', 'grace period');

    const deleted = { id: 'evt_3', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: {} } } };
    await send(deleted);
    assert.equal(s.db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id).plan, 'free');

    await send(checkout); // replayed old event must not re-upgrade
    assert.equal(s.db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id).plan, 'free');

    // Dev billing is disabled once Stripe is configured.
    assert.equal((await c.post('/billing/dev-upgrade', { _csrf: await c.csrf() })).status, 404);
  } finally {
    await s.close();
  }
});

test('login is rate limited per IP and email', async () => {
  const s = await startTestServer({ RATE_LIMIT_SCALE: '1' });
  try {
    const c = client(s.base);
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await c.post('/login', { email: 'x@test.com', password: 'nope-nope' })).status);
    assert.equal(statuses.at(-2), 401);
    assert.equal(statuses.at(-1), 429);
  } finally {
    await s.close();
  }
});

test('production config refuses to boot without a strong secret', async () => {
  const { loadConfig } = await import('../src/config.js');
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /SESSION_SECRET/);
  const cfg = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(40) });
  assert.equal(cfg.devBilling, false);
});
