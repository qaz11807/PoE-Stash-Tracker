import { app } from 'electron';
import path from 'node:path';
import BetterSqlite3, { Database as BetterSqlite3Database } from 'better-sqlite3';

export type SqlParam = string | number | null | Uint8Array;
export type SqlParams = SqlParam[];

let db: BetterSqlite3Database | null = null;

export function initDatabase(): BetterSqlite3Database {
  if (db) {
    return db;
  }

  const dbPath = path.join(app.getPath('userData'), 'stash.db');
  db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');

  return db;
}

export function createTables(): void {
  const database = initDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER,
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      raw_json TEXT,
      FOREIGN KEY (league_id) REFERENCES leagues(id)
    );

    CREATE TABLE IF NOT EXISTS stash_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      league_id INTEGER,
      snapshot_id INTEGER,
      name TEXT,
      type_line TEXT,
      stack_size INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stash_items_item_id ON stash_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_stash_items_league_id ON stash_items(league_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_league_id ON snapshots(league_id);
  `);
}

export function query<T = unknown>(sql: string, params?: SqlParams): T[] {
  const database = initDatabase();
  const statement = database.prepare(sql);
  return statement.all(...(params ?? [])) as T[];
}

export function run(sql: string, params?: SqlParams) {
  const database = initDatabase();
  const statement = database.prepare(sql);
  return statement.run(...(params ?? []));
}
