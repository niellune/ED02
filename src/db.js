import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     password_hash TEXT NOT NULL,
     plan TEXT NOT NULL DEFAULT 'free',
     stripe_customer_id TEXT UNIQUE,
     stripe_subscription_id TEXT,
     subscription_status TEXT,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL
   );
   CREATE TABLE codes (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     destination TEXT NOT NULL,
     fg TEXT NOT NULL DEFAULT '#000000',
     bg TEXT NOT NULL DEFAULT '#ffffff',
     disabled_reason TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX codes_user ON codes(user_id);
   CREATE TABLE scans (
     id INTEGER PRIMARY KEY,
     code_id INTEGER NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
     ts INTEGER NOT NULL,
     day TEXT NOT NULL,
     visitor TEXT NOT NULL,
     device TEXT NOT NULL,
     os TEXT NOT NULL,
     browser TEXT NOT NULL,
     country TEXT
   );
   CREATE INDEX scans_code_ts ON scans(code_id, ts);
   CREATE TABLE password_resets (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL,
     used INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE abuse_reports (
     id INTEGER PRIMARY KEY,
     slug TEXT NOT NULL,
     details TEXT NOT NULL,
     reporter_email TEXT,
     created_at INTEGER NOT NULL,
     resolved INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE stripe_events (
     id TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL
   );`,
];

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get();
  let version = row ? row.version : 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.prepare('UPDATE schema_version SET version = ?').run(version);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export const now = () => Date.now();
