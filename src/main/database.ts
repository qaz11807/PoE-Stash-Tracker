import { app } from 'electron';
import path from 'node:path';
import BetterSqlite3, { Database as BetterSqlite3Database } from 'better-sqlite3';

const SCHEMA_VERSION = 1;

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
  stash_tab_id: string | null;
  tab_name: string | null;
  tab_type: string | null;
  created_at: string;
};

export type NewStashItem = {
  item_id: string;
  league_id: number | null;
  snapshot_id: number | null;
  name?: string | null;
  type_line?: string | null;
  stack_size?: number | null;
  note?: string | null;
  stash_tab_id?: string | null;
  tab_name?: string | null;
  tab_type?: string | null;
};

let db: BetterSqlite3Database | null = null;

function runMigrations(database: BetterSqlite3Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const row = database.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  const currentVersion = row?.v ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    database.transaction(() => {
      // v1: add stash tab metadata columns
      for (const col of ['stash_tab_id TEXT', 'tab_name TEXT', 'tab_type TEXT']) {
        try {
          database.exec(`ALTER TABLE stash_items ADD COLUMN ${col}`);
        } catch (err) {
          if (err instanceof Error && !err.message.includes('duplicate column name')) {
            console.error('[db] Unexpected migration error:', err);
            throw err;
          }
        }
      }
      database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    })();
  }
}

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
      stash_tab_id TEXT,
      tab_name TEXT,
      tab_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stash_items_item_id ON stash_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_stash_items_league_id ON stash_items(league_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_league_id ON snapshots(league_id);
  `);

  runMigrations(database);
}

export function getLeagues(): League[] {
  const database = initDatabase();
  const statement = database.prepare('SELECT id, name, created_at FROM leagues ORDER BY created_at DESC, id DESC');
  return statement.all() as League[];
}

export function insertLeague(name: string): number {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 128) throw new Error('Invalid league name');
  const database = initDatabase();
  const statement = database.prepare('INSERT INTO leagues (name) VALUES (?)');
  const result = statement.run(trimmed);
  return Number(result.lastInsertRowid);
}

export function getSnapshots(leagueId: number): Omit<Snapshot, 'raw_json'>[] {
  const database = initDatabase();
  const statement = database.prepare(
    'SELECT id, league_id, captured_at FROM snapshots WHERE league_id = ? ORDER BY captured_at DESC, id DESC'
  );
  return statement.all(leagueId) as Omit<Snapshot, 'raw_json'>[];
}

export function getSnapshotDetail(id: number): Snapshot | null {
  const database = initDatabase();
  const statement = database.prepare(
    'SELECT id, league_id, captured_at, raw_json FROM snapshots WHERE id = ?'
  );
  return (statement.get(id) as Snapshot | undefined) ?? null;
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
    `SELECT id, item_id, league_id, snapshot_id, name, type_line, stack_size, note, stash_tab_id, tab_name, tab_type, created_at
     FROM stash_items
     WHERE snapshot_id = ?
     ORDER BY created_at DESC, id DESC`
  );
  return statement.all(snapshotId) as StashItem[];
}

export function insertStashItem(data: NewStashItem): number {
  const database = initDatabase();
  const statement = database.prepare(
    `INSERT INTO stash_items (item_id, league_id, snapshot_id, name, type_line, stack_size, note, stash_tab_id, tab_name, tab_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = statement.run(
    data.item_id,
    data.league_id,
    data.snapshot_id,
    data.name ?? null,
    data.type_line ?? null,
    data.stack_size ?? null,
    data.note ?? null,
    data.stash_tab_id ?? null,
    data.tab_name ?? null,
    data.tab_type ?? null
  );
  return Number(result.lastInsertRowid);
}

export function insertStashItemsBatch(items: NewStashItem[]): void {
  if (items.length === 0) return;
  const database = initDatabase();
  const insert = database.prepare(
    `INSERT INTO stash_items (item_id, league_id, snapshot_id, name, type_line, stack_size, note, stash_tab_id, tab_name, tab_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMany = database.transaction((rows: NewStashItem[]) => {
    for (const row of rows) {
      insert.run(
        row.item_id,
        row.league_id,
        row.snapshot_id,
        row.name ?? null,
        row.type_line ?? null,
        row.stack_size ?? null,
        row.note ?? null,
        row.stash_tab_id ?? null,
        row.tab_name ?? null,
        row.tab_type ?? null
      );
    }
  });
  insertMany(items);
}

export function saveStashSnapshot(leagueId: number, rawJson: string, items: NewStashItem[]): { snapshotId: number; itemCount: number } {
  const database = initDatabase();
  let snapshotId: number = 0;
  let itemCount = 0;

  const transaction = database.transaction(() => {
    snapshotId = insertSnapshot(leagueId, rawJson);

    if (items.length > 0) {
      const updated = items.map(item => ({
        ...item,
        snapshot_id: snapshotId,
        league_id: leagueId
      }));
      insertStashItemsBatch(updated);
      itemCount = updated.length;
    }
  });

  transaction();

  return { snapshotId, itemCount };
}
