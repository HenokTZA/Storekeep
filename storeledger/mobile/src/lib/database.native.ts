import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('storeledger.db');

export async function initializeDatabase() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cache_entries (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_values (
      value_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export async function cacheSet(key: string, value: unknown) {
  await db.runAsync(
    `INSERT INTO cache_entries (cache_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM cache_entries WHERE cache_key = ?', key);
  return row ? (JSON.parse(row.payload) as T) : null;
}

export async function setLocalValue(key: string, value: unknown) {
  await db.runAsync(
    `INSERT INTO local_values (value_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(value_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function getLocalValue<T>(key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM local_values WHERE value_key = ?', key);
  return row ? (JSON.parse(row.payload) as T) : null;
}

export async function removeLocalValue(key: string) {
  await db.runAsync('DELETE FROM local_values WHERE value_key = ?', key);
}
