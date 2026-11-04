import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';

const config = loadConfig();
const db = openDb(config.dbPath);
const app = createApp({ config, db });

// Housekeeping: drop expired sessions and reset tokens once an hour.
setInterval(() => {
  const t = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(t);
}, 60 * 60 * 1000).unref();

const server = app.listen(config.port, () => {
  console.log(`${config.brand} listening on ${config.baseUrl} (port ${config.port})`);
  if (!config.billingEnabled) console.log('Stripe not configured: billing disabled' + (config.devBilling ? ' (dev upgrade buttons enabled)' : ''));
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
