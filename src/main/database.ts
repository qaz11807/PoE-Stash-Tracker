import { app } from 'electron';
import path from 'node:path';
import BetterSqlite3, { Database as BetterSqlite3Database } from 'better-sqlite3';

export type League = {
  id: number;
  name: string;
  created_at: string;
};

export type Snapshot = {
  id: number;
  league_id: number | null;
  captured_at: string;
  raw_json: string | null;
};

export type StashItem = {
  id: number;
  item_id: string;
  league_id: number | null;
  snapshot_id: number | null;
  name: string | null;
  type_line: string | null;
  stack_size: number | null;
  note: string | null;
  created_at: string;
};

export type NewStashItem = {
  itemId: string;
  leagueId: number | null;
  snapshotId: number | null;
  name?: string | null;
  typeLine?: string | null;
  stackSize?: number | null;
  note?: string | null;
};

let db: BetterSqlite3Database | null = null;

export function initDatabase(): BetterSqlite3Database {
  if (db) {
    return db;
  }

  const dbPath = path.join(app.getPath('userData'), 'stash.db');
  db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

export function getLeagues(): League[] {
  const database = initDatabase();
  const statement = database.prepare('SELECT id, name, created_at FROM leagues ORDER BY created_at DESC, id DESC');
  return statement.all() as League[];
}

export function insertLeague(name: string): number {
  const database = initDatabase();
  const statement = database.prepare('INSERT INTO leagues (name) VALUES (?)');
  const result = statement.run(name);
  return Number(result.lastInsertRowid);
}

export function getSnapshots(leagueId: number): Snapshot[] {
  const database = initDatabase();
  const statement = database.prepare(
    'SELECT id, league_id, captured_at, raw_json FROM snapshots WHERE league_id = ? ORDER BY captured_at DESC, id DESC'
  );
  return statement.all(leagueId) as Snapshot[];
}

export function insertSnapshot(leagueId: number, rawJson: string): number {
  const database = initDatabase();
  const statement = database.prepare('INSERT INTO snapshots (league_id, raw_json) VALUES (?, ?)');
  const result = statement.run(leagueId, rawJson);
  return Number(result.lastInsertRowid);
}

export function getStashItems(snapshotId: number): StashItem[] {
  const database = initDatabase();
  const statement = database.prepare(
    `SELECT id, item_id, league_id, snapshot_id, name, type_line, stack_size, note, created_at
     FROM stash_items
     WHERE snapshot_id = ?
     ORDER BY created_at DESC, id DESC`
  );
  return statement.all(snapshotId) as StashItem[];
}

export function insertStashItem(data: NewStashItem): number {
  const database = initDatabase();
  const statement = database.prepare(
    `INSERT INTO stash_items (item_id, league_id, snapshot_id, name, type_line, stack_size, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = statement.run(
    data.itemId,
    data.leagueId,
    data.snapshotId,
    data.name ?? null,
    data.typeLine ?? null,
    data.stackSize ?? null,
    data.note ?? null
  );
  return Number(result.lastInsertRowid);
}
