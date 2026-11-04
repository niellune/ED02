# KeepQR

**Dynamic QR codes that never get held hostage.** A small, deployable SaaS that earns
recurring revenue from small businesses who print QR codes on menus, signs, packaging and cards.

- **Free:** unlimited static QR codes (no account), plus 3 dynamic codes with 30 days of analytics.
- **Pro, $5/mo or $48/yr:** 250 dynamic codes, unlimited analytics history, custom colors, CSV export.
- **The pledge:** dynamic codes keep redirecting on every plan, even after cancelling. This answers
  the most common complaint about competitors, whose codes stop working when a trial ends.

The business case, pricing and growth plan are in [`docs/BUSINESS.md`](docs/BUSINESS.md).
The steps to go live and get the first customers are in [`docs/LAUNCH.md`](docs/LAUNCH.md).

## Features

| Area | What's included |
| --- | --- |
| Acquisition | Free no-signup QR generator (PNG/SVG, colors, error correction), 6 SEO landing pages, pricing, pledge page, sitemap, robots, OG tags |
| Product | Accounts, dynamic codes, live destination edits, `302` redirects with `no-store`, scan analytics (daily chart, devices, OS, country, unique-visitor estimate), PNG/SVG downloads, CSV export |
| Monetization | Stripe Checkout (monthly + yearly, promo codes), Customer Portal for self-serve cancel, signed + idempotent webhooks, plan limits in one file (`src/plans.js`) |
| Trust & safety | Destination validation (http/https only, no IPs/localhost/credentials, no URL-shortener chaining, custom blocklist), public abuse reports, admin disable, scannability (contrast) checks |
| Privacy | No IP addresses stored; daily-rotating salted visitor hash; data export + account deletion |
| Security | scrypt passwords, hashed session tokens, CSRF tokens, SameSite cookies, strict CSP, HSTS, rate limits, timing-safe login |
| Operations | `/admin` with users, Pro count, MRR, scans, abuse queue; `/healthz`; Dockerfile, `fly.toml`, `render.yaml`, GitHub Actions CI |

## Stack

Node.js 22 (built-in `node:sqlite`), Express 5, `qrcode`, `stripe`. Server-rendered HTML with
an auto-escaping template helper and no front-end build step. Three runtime dependencies.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Without Stripe keys, the account page shows a `[dev] Upgrade` button
so you can try Pro features. That button never exists in production.

```bash
npm test
```

## Configuration

All settings are environment variables. See [`.env.example`](.env.example). In production you need
at least `NODE_ENV=production`, `BASE_URL`, `SESSION_SECRET` (32+ chars), and a persistent `DATABASE_PATH`.

## Deploy (Fly.io, about $3–5/month)

```bash
fly launch --no-deploy --copy-config
```

```bash
fly volumes create keepqr_data --size 1
```

```bash
fly secrets set SESSION_SECRET="$(openssl rand -base64 48)" BASE_URL=https://yourdomain.com ADMIN_EMAILS=you@example.com
```

```bash
fly deploy
```

Then set up Stripe and your domain as described in [`docs/LAUNCH.md`](docs/LAUNCH.md).
`render.yaml` is included as an alternative.

**Back up the SQLite file.** Codes are printed on physical objects, so losing the database breaks
customers' signage. Use Fly volume snapshots (daily, automatic) plus [Litestream](https://litestream.io)
to S3/R2 for continuous backups.

## Project layout

```
src/
  app.js            Express app factory: security headers, sessions, CSRF, routing
  server.js         Entry point + housekeeping
  config.js         Environment → config
  plans.js          Plan limits & prices (single source of truth)
  db.js             SQLite schema + migrations
  safety.js         Destination validation, color/contrast checks
  security.js       Hashing, tokens, rate limiting
  ua.js             Coarse user-agent classification, bot filter
  mailer.js         Resend API (logs to console when unset)
  routes/           public, auth, codes, account, billing, admin, redirect
  views/            Server-rendered pages
public/             CSS, progressive-enhancement JS, favicon
test/               Integration tests (node:test)
docs/               Business plan and launch checklist
```
