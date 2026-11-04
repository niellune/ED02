import { html } from './html.js';
import { layout } from './layout.js';
import { PLANS } from '../plans.js';

const MESSAGES = {
  created: 'Your dynamic QR code is ready. Download it below and start printing.',
  updated: 'Saved. Scans now go to the new destination.',
  deleted: 'Code deleted.',
  upgraded: 'Welcome to Pro! Thanks for supporting an honest QR service.',
  downgraded: 'You are now on the Free plan. All your codes keep working.',
  password: 'Password updated.',
  'checkout-cancelled': 'Checkout cancelled. No charge was made.',
};

const csrfField = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const shortUrl = (ctx, code) => `${ctx.config.baseUrl}/r/${code.slug}`;

function flash(msg) {
  return msg && MESSAGES[msg] ? html`<p class="notice">${MESSAGES[msg]}</p>` : '';
}

export function dashboardPage(ctx, { codes, plan, usage, msg, error, values = {} }) {
  const atLimit = usage.count >= plan.maxDynamicCodes;
  const body = html`
  <section class="wrap">
    <div class="page-head">
      <h1>My QR codes</h1>
      <p class="muted">${usage.count} of ${plan.maxDynamicCodes} dynamic codes used · <strong>${plan.name}</strong> plan
        ${plan.id === 'free' ? html` · <a href="/account">Upgrade to Pro</a>` : ''}</p>
    </div>
    ${flash(msg)}
    ${error ? html`<p class="error">${error}</p>` : ''}
    <div class="card">
      <h2>New dynamic code</h2>
      ${atLimit
        ? html`<p>You have reached the ${plan.maxDynamicCodes}-code limit on the ${plan.name} plan. ${plan.id === 'free' ? html`<a href="/account">Upgrade to Pro</a> for ${PLANS.pro.maxDynamicCodes} codes.` : html`Contact us if you need more.`}</p>`
        : html`<form method="post" action="/codes" class="row-form">
            ${csrfField(ctx)}
            <label>Name<input name="name" required maxlength="80" placeholder="Table stickers" value="${values.name || ''}"></label>
            <label class="grow">Destination URL<input name="destination" required maxlength="2000" placeholder="https://your-site.com/menu" value="${values.destination || ''}"></label>
            <button class="btn">Create code</button>
          </form>`}
    </div>
    ${codes.length === 0
      ? html`<div class="empty"><p>No codes yet. Create your first one above. It takes 10 seconds.</p></div>`
      : html`<div class="code-list">${codes.map((c, i) => html`
        <div class="card code-item">
          <img class="thumb" src="/codes/${c.id}/qr.svg" alt="QR code for ${c.name}" width="96" height="96" loading="lazy">
          <div class="grow">
            <h3><a href="/codes/${c.id}">${c.name}</a>${c.disabled_reason ? html` <span class="pill danger">Disabled</span>` : ''}${i >= plan.maxDynamicCodes ? html` <span class="pill">Read-only</span>` : ''}</h3>
            <p class="mono small"><button class="link copy" data-copy="${shortUrl(ctx, c)}" type="button">${shortUrl(ctx, c)}</button> → ${c.destination}</p>
          </div>
          <div class="stats"><strong>${fmt(c.total)}</strong><span>scans</span></div>
          <div class="stats"><strong>${fmt(c.week)}</strong><span>last 7 days</span></div>
          <a class="btn btn-ghost btn-small" href="/codes/${c.id}">Open</a>
        </div>`)}</div>`}
  </section>`;
  return layout({ ctx, title: 'My codes', body, noindex: true });
}

function barChart(series) {
  const w = 720; const h = 180; const pad = 24;
  const max = Math.max(1, ...series.map((d) => d.count));
  const bw = (w - pad) / Math.max(1, series.length);
  const bars = series.map((d, i) => {
    const bh = Math.round(((h - pad - 16) * d.count) / max);
    return html`<rect x="${(pad + i * bw + 1).toFixed(1)}" y="${h - pad - bh}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh}" rx="2"><title>${d.day}: ${d.count} scans</title></rect>`;
  });
  const first = series[0]?.day || '';
  const last = series[series.length - 1]?.day || '';
  return html`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily scans">
    <text x="0" y="12" class="axis">${max}</text><text x="0" y="${h - pad}" class="axis">0</text>
    <g class="bars">${bars}</g>
    <text x="${pad}" y="${h - 6}" class="axis">${first}</text><text x="${w}" y="${h - 6}" class="axis" text-anchor="end">${last}</text>
  </svg>`;
}

function breakdown(title, rows, total) {
  return html`<div class="card"><h3>${title}</h3>${rows.length === 0 ? html`<p class="muted small">No data yet.</p>` : html`<table class="table compact">${rows.map((r) => html`<tr><td>${r.label || 'Unknown'}</td><td class="num">${fmt(r.count)}</td><td class="num muted">${Math.round((100 * r.count) / Math.max(1, total))}%</td></tr>`)}</table>`}</div>`;
}

export function codePage(ctx, { code, plan, editable, stats, range, msg, error }) {
  const ranges = [['30', '30 days'], ['90', '90 days'], ['365', '1 year'], ['all', 'All time']];
  const body = html`
  <section class="wrap">
    <p><a href="/dashboard">← My codes</a></p>
    <div class="page-head"><h1>${code.name}</h1>
      ${code.disabled_reason ? html`<p class="error">This code has been disabled: ${code.disabled_reason}. Contact support if you think this is a mistake.</p>` : ''}
    </div>
    ${flash(msg)}
    ${error ? html`<p class="error">${error}</p>` : ''}
    <div class="code-grid">
      <div class="card center">
        <img src="/codes/${code.id}/qr.svg" alt="QR code" width="220" height="220">
        <p class="mono small"><button class="link copy" data-copy="${shortUrl(ctx, code)}" type="button">${shortUrl(ctx, code)}</button></p>
        <div class="row center-row">
          <a class="btn btn-small" href="/codes/${code.id}/qr.png?download=1">PNG</a>
          <a class="btn btn-small btn-ghost" href="/codes/${code.id}/qr.svg?download=1">SVG</a>
        </div>
      </div>
      <div class="card">
        <h2>Settings</h2>
        ${editable
          ? html`<form method="post" action="/codes/${code.id}" class="stack">
              ${csrfField(ctx)}
              <label>Name<input name="name" required maxlength="80" value="${code.name}"></label>
              <label>Destination URL<input name="destination" required maxlength="2000" value="${code.destination}"></label>
              <div class="row">
                <label>Color<input type="color" name="fg" value="${code.fg}" ${plan.customColors ? '' : 'disabled'}></label>
                <label>Background<input type="color" name="bg" value="${code.bg}" ${plan.customColors ? '' : 'disabled'}></label>
                ${plan.customColors ? '' : html`<p class="small muted">Custom colors are a <a href="/account">Pro</a> feature.</p>`}
              </div>
              <button class="btn">Save changes</button>
            </form>`
          : html`<p>This code is <strong>read-only</strong> because your account has more codes than the ${plan.name} plan allows. It still redirects to <span class="mono">${code.destination}</span>. <a href="/account">Upgrade</a> or delete other codes to edit it.</p>`}
        <form method="post" action="/codes/${code.id}/delete" class="danger-zone" data-confirm="Delete this code? Printed copies will stop working. This cannot be undone.">
          ${csrfField(ctx)}<button class="link danger">Delete code</button>
        </form>
      </div>
    </div>

    <div class="page-head row-between">
      <h2>Scans</h2>
      <div class="row">
        ${ranges.map(([v, label]) => {
          const locked = plan.historyDays && (v === 'all' || Number(v) > plan.historyDays);
          return locked
            ? html`<span class="chip locked" title="Pro feature">${label} 🔒</span>`
            : html`<a class="chip ${range === v ? 'active' : ''}" href="/codes/${code.id}?range=${v}">${label}</a>`;
        })}
        ${plan.csvExport ? html`<a class="chip" href="/codes/${code.id}/scans.csv">Export CSV</a>` : html`<span class="chip locked" title="Pro feature">CSV 🔒</span>`}
      </div>
    </div>
    <div class="cards three">
      <div class="card stat"><strong>${fmt(stats.total)}</strong><span>scans</span></div>
      <div class="card stat"><strong>${fmt(stats.unique)}</strong><span>unique visitors (est.)</span></div>
      <div class="card stat"><strong>${fmt(stats.today)}</strong><span>today</span></div>
    </div>
    <div class="card">${barChart(stats.daily)}</div>
    <div class="cards three">
      ${breakdown('Devices', stats.devices, stats.total)}
      ${breakdown('Operating systems', stats.os, stats.total)}
      ${breakdown('Countries', stats.countries, stats.total)}
    </div>
  </section>`;
  return layout({ ctx, title: code.name, body, noindex: true });
}

export function accountPage(ctx, { plan, user, msg, error, billing }) {
  const body = html`
  <section class="wrap narrow">
    <h1>Account</h1>
    ${flash(msg)}
    ${error ? html`<p class="error">${error}</p>` : ''}
    <div class="card">
      <h2>Plan: ${plan.name}</h2>
      ${user.plan === 'pro'
        ? html`<p>Thanks for being a Pro customer${user.subscription_status && user.subscription_status !== 'active' ? html` (status: ${user.subscription_status})` : ''}.</p>
          ${billing.enabled ? html`<form method="post" action="/billing/portal">${csrfField(ctx)}<button class="btn btn-ghost">Manage billing / cancel</button></form>` : ''}
          ${billing.dev ? html`<form method="post" action="/billing/dev-downgrade">${csrfField(ctx)}<button class="btn btn-ghost">[dev] Downgrade to Free</button></form>` : ''}`
        : html`<p>Upgrade to Pro for ${PLANS.pro.maxDynamicCodes} dynamic codes, unlimited analytics history, custom colors and CSV export.</p>
          ${billing.enabled
            ? html`<div class="row">
                <form method="post" action="/billing/checkout">${csrfField(ctx)}<input type="hidden" name="interval" value="month"><button class="btn">$${PLANS.pro.priceMonthly} / month</button></form>
                ${billing.yearly ? html`<form method="post" action="/billing/checkout">${csrfField(ctx)}<input type="hidden" name="interval" value="year"><button class="btn btn-ghost">$${PLANS.pro.priceYearly} / year (2 months free)</button></form>` : ''}
              </div>`
            : billing.dev
              ? html`<form method="post" action="/billing/dev-upgrade">${csrfField(ctx)}<button class="btn">[dev] Upgrade without paying</button></form><p class="small muted">Stripe is not configured; this button only exists outside production.</p>`
              : html`<p class="muted">Payments are not available yet. Please check back soon.</p>`}`}
      <p class="small muted">Whatever you choose, your existing codes keep working. <a href="/no-hostage-pledge">Our pledge</a>.</p>
    </div>
    <div class="card">
      <h2>Change password</h2>
      <form method="post" action="/account/password" class="stack">
        ${csrfField(ctx)}
        <label>Current password<input name="current" type="password" required autocomplete="current-password"></label>
        <label>New password<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <button class="btn btn-ghost">Update password</button>
      </form>
    </div>
    <div class="card">
      <h2>Your data</h2>
      <p><a href="/account/export.json">Download all my data (JSON)</a></p>
      <form method="post" action="/account/delete" class="stack danger-zone" data-confirm="Delete your account? All dynamic codes will stop working immediately. This cannot be undone.">
        ${csrfField(ctx)}
        <label>Type your password to delete your account<input name="password" type="password" required></label>
        <button class="btn btn-danger">Delete account</button>
      </form>
      ${user.plan === 'pro' ? html`<p class="small muted">Deleting your account does not cancel your subscription automatically. Cancel it under "Manage billing" first.</p>` : ''}
    </div>
  </section>`;
  return layout({ ctx, title: 'Account', body, noindex: true });
}

export function adminPage(ctx, { metrics, reports, recentUsers }) {
  const body = html`
  <section class="wrap">
    <h1>Admin</h1>
    <div class="cards three">
      <div class="card stat"><strong>${fmt(metrics.users)}</strong><span>users (+${fmt(metrics.users7d)} this week)</span></div>
      <div class="card stat"><strong>${fmt(metrics.pro)}</strong><span>Pro customers · ${(100 * metrics.pro / Math.max(1, metrics.users)).toFixed(1)}% conversion</span></div>
      <div class="card stat"><strong>$${fmt(metrics.mrr)}</strong><span>est. MRR (at monthly price)</span></div>
      <div class="card stat"><strong>${fmt(metrics.codes)}</strong><span>dynamic codes</span></div>
      <div class="card stat"><strong>${fmt(metrics.scans7d)}</strong><span>scans last 7 days</span></div>
      <div class="card stat"><strong>${fmt(reports.length)}</strong><span>open abuse reports</span></div>
    </div>
    <div class="card">
      <h2>Open abuse reports</h2>
      ${reports.length === 0 ? html`<p class="muted">Nothing to review.</p>` : html`<table class="table">
        <thead><tr><th>When</th><th>Code</th><th>Destination</th><th>Details</th><th></th></tr></thead>
        ${reports.map((r) => html`<tr>
          <td class="small">${new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')}</td>
          <td class="mono">${r.slug}</td><td class="mono small">${r.destination || 'not found'}</td>
          <td>${r.details}${r.reporter_email ? html`<br><span class="small muted">${r.reporter_email}</span>` : ''}</td>
          <td><form method="post" action="/admin/reports/${r.id}" class="row">${csrfField(ctx)}
            ${r.code_id ? html`<button class="btn btn-small btn-danger" name="action" value="disable">Disable code</button>` : ''}
            <button class="btn btn-small btn-ghost" name="action" value="dismiss">Dismiss</button></form></td>
        </tr>`)}
      </table>`}
    </div>
    <div class="card">
      <h2>Newest users</h2>
      <table class="table compact">${recentUsers.map((u) => html`<tr><td>${u.email}</td><td>${u.plan}</td><td class="num">${u.codes} codes</td><td class="small muted">${new Date(u.created_at).toISOString().slice(0, 10)}</td></tr>`)}</table>
    </div>
  </section>`;
  return layout({ ctx, title: 'Admin', body, noindex: true });
}
