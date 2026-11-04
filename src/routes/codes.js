import { Router } from 'express';
import { planFor } from '../plans.js';
import { blockedDomains, colorProblem, normalizeHex, validateDestination } from '../safety.js';
import { randomSlug } from '../security.js';
import { codePage, dashboardPage } from '../views/app.js';
import { renderQr, sendQr } from './public.js';
import { requireUser, send } from './helpers.js';

const DAY = 86_400_000;

export default function codeRoutes({ db, config }) {
  const router = Router();
  const blocked = blockedDomains();
  const ownHost = new URL(config.baseUrl).hostname;

  const listCodes = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM scans s WHERE s.code_id = c.id) AS total,
      (SELECT COUNT(*) FROM scans s WHERE s.code_id = c.id AND s.ts >= ?) AS week
    FROM codes c WHERE c.user_id = ? ORDER BY c.id ASC`);
  const countCodes = db.prepare('SELECT COUNT(*) AS n FROM codes WHERE user_id = ?');
  const getCode = db.prepare('SELECT * FROM codes WHERE id = ? AND user_id = ?');
  // A code is editable if it is among the oldest N codes, where N is the plan limit.
  // Extra codes (after a downgrade) stay live but become read-only.
  const codeRank = db.prepare('SELECT COUNT(*) AS n FROM codes WHERE user_id = ? AND id < ?');

  function loadOwned(req, res) {
    const id = Number(req.params.id);
    const code = Number.isInteger(id) ? getCode.get(id, req.user.id) : null;
    if (!code) res.status(404).type('text/plain').send('Code not found');
    return code;
  }
  const isEditable = (user, code) => !code.disabled_reason && codeRank.get(user.id, code.id).n < planFor(user).maxDynamicCodes;

  function renderDashboard(req, res, extra = {}, status = 200) {
    const plan = planFor(req.user);
    const codes = listCodes.all(Date.now() - 7 * DAY, req.user.id);
    send(res, dashboardPage(req.ctx, { codes, plan, usage: { count: codes.length }, ...extra }), status);
  }

  router.get('/dashboard', requireUser, (req, res) => renderDashboard(req, res, { msg: req.query.msg }));

  router.post('/codes', requireUser, (req, res) => {
    const plan = planFor(req.user);
    const name = String(req.body.name || '').trim().slice(0, 80);
    const values = { name, destination: String(req.body.destination || '') };
    if (countCodes.get(req.user.id).n >= plan.maxDynamicCodes) {
      return renderDashboard(req, res, { error: `The ${plan.name} plan includes ${plan.maxDynamicCodes} dynamic codes.`, values }, 403);
    }
    if (!name) return renderDashboard(req, res, { error: 'Give your code a name so you can find it later.', values }, 400);
    const dest = validateDestination(req.body.destination, { ownHost, blocked });
    if (dest.error) return renderDashboard(req, res, { error: dest.error, values }, 400);
    const t = Date.now();
    let id;
    for (let attempt = 0; attempt < 5 && !id; attempt++) {
      try {
        id = db.prepare('INSERT INTO codes (user_id, slug, name, destination, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.user.id, randomSlug(), name, dest.url, t, t).lastInsertRowid;
      } catch (err) {
        if (!String(err.message).includes('UNIQUE')) throw err;
      }
    }
    res.redirect(303, `/codes/${id}?msg=created`);
  });

  function stats(codeId, range, plan) {
    const t = Date.now();
    let days = range === 'all' ? null : Number(range);
    if (plan.historyDays && (!days || days > plan.historyDays)) days = plan.historyDays;
    const from = days ? t - days * DAY : 0;
    const q = (sql) => db.prepare(sql);
    const total = q('SELECT COUNT(*) AS n FROM scans WHERE code_id = ? AND ts >= ?').get(codeId, from).n;
    const unique = q('SELECT COUNT(DISTINCT visitor) AS n FROM scans WHERE code_id = ? AND ts >= ?').get(codeId, from).n;
    const todayKey = new Date(t).toISOString().slice(0, 10);
    const today = q('SELECT COUNT(*) AS n FROM scans WHERE code_id = ? AND day = ?').get(codeId, todayKey).n;
    const group = (col) => q(`SELECT ${col} AS label, COUNT(*) AS count FROM scans WHERE code_id = ? AND ts >= ? GROUP BY ${col} ORDER BY count DESC LIMIT 10`).all(codeId, from);
    const byDay = new Map(q('SELECT day, COUNT(*) AS count FROM scans WHERE code_id = ? AND ts >= ? GROUP BY day').all(codeId, from).map((r) => [r.day, r.count]));
    let chartDays = days || 30;
    if (!days) {
      const first = q('SELECT MIN(ts) AS t FROM scans WHERE code_id = ?').get(codeId).t;
      if (first) chartDays = Math.min(365, Math.max(30, Math.ceil((t - first) / DAY) + 1));
    }
    chartDays = Math.min(chartDays, 365);
    const daily = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const day = new Date(t - i * DAY).toISOString().slice(0, 10);
      daily.push({ day, count: byDay.get(day) || 0 });
    }
    return { total, unique, today, daily, devices: group('device'), os: group('os'), countries: group('country') };
  }

  router.get('/codes/:id', requireUser, (req, res) => {
    const code = loadOwned(req, res);
    if (!code) return;
    const plan = planFor(req.user);
    const range = ['30', '90', '365', 'all'].includes(req.query.range) ? req.query.range : '30';
    const effectiveRange = plan.historyDays && (range === 'all' || Number(range) > plan.historyDays) ? String(plan.historyDays) : range;
    send(res, codePage(req.ctx, {
      code, plan, editable: isEditable(req.user, code), stats: stats(code.id, effectiveRange, plan), range: effectiveRange, msg: req.query.msg,
    }));
  });

  router.post('/codes/:id', requireUser, (req, res) => {
    const code = loadOwned(req, res);
    if (!code) return;
    const plan = planFor(req.user);
    const fail = (error, status = 400) => send(res, codePage(req.ctx, {
      code: { ...code, name: req.body.name ?? code.name, destination: req.body.destination ?? code.destination },
      plan, editable: true, stats: stats(code.id, '30', plan), range: '30', error,
    }), status);
    if (!isEditable(req.user, code)) return res.redirect(303, `/codes/${code.id}`);
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return fail('Name cannot be empty.');
    const dest = validateDestination(req.body.destination, { ownHost, blocked });
    if (dest.error) return fail(dest.error);
    let { fg, bg } = code;
    if (plan.customColors) {
      fg = normalizeHex(req.body.fg, code.fg);
      bg = normalizeHex(req.body.bg, code.bg);
      const problem = colorProblem(fg, bg);
      if (problem) return fail(problem);
    }
    db.prepare('UPDATE codes SET name = ?, destination = ?, fg = ?, bg = ?, updated_at = ? WHERE id = ?')
      .run(name, dest.url, fg, bg, Date.now(), code.id);
    res.redirect(303, `/codes/${code.id}?msg=updated`);
  });

  router.post('/codes/:id/delete', requireUser, (req, res) => {
    const code = loadOwned(req, res);
    if (!code) return;
    db.prepare('DELETE FROM codes WHERE id = ?').run(code.id);
    res.redirect(303, '/dashboard?msg=deleted');
  });

  router.get('/codes/:id/qr.:format', requireUser, async (req, res) => {
    const code = loadOwned(req, res);
    if (!code) return;
    const format = req.params.format === 'png' ? 'png' : 'svg';
    // Colors only apply while the plan allows them; the code itself is unchanged.
    const colors = planFor(req.user).customColors ? { fg: code.fg, bg: code.bg } : {};
    const body = await renderQr({ data: `${config.baseUrl}/r/${code.slug}`, format, ecc: 'M', size: 2048, ...colors });
    res.set('Cache-Control', 'private, max-age=60');
    const filename = code.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'qr-code';
    sendQr(res, body, { format, download: Boolean(req.query.download), filename });
  });

  router.get('/codes/:id/scans.csv', requireUser, (req, res) => {
    const code = loadOwned(req, res);
    if (!code) return;
    if (!planFor(req.user).csvExport) return res.redirect(303, '/account');
    const rows = db.prepare('SELECT ts, device, os, browser, country FROM scans WHERE code_id = ? ORDER BY ts ASC').all(code.id);
    const lines = ['timestamp_utc,device,os,browser,country', ...rows.map((r) => [new Date(r.ts).toISOString(), r.device, r.os, r.browser, r.country || ''].join(','))];
    res.type('text/csv').set('Content-Disposition', `attachment; filename="scans-${code.slug}.csv"`).send(`${lines.join('\n')}\n`);
  });

  return router;
}
