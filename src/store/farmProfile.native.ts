/**
 * Native farm profile: expo-sqlite, the same database file as events and
 * people (`store.native.ts`, `people.native.ts`), in a table of its own.
 *
 * One row, holding the profile document as JSON — see `farmProfile-doc.ts`
 * for why the profile is a document rather than relational rows. The
 * `CHECK (id = 1)` is the schema saying out loud that there is exactly one
 * farm profile per device (S27 follows the epic's "stored per device"
 * literally; see the story's Dev notes on the single-farm assumption).
 */

import * as SQLite from 'expo-sqlite';

import { DocFarmProfileStore, EMPTY_PROFILE } from './farmProfile-doc';
import type { FarmProfile, FarmProfileStore } from './farmProfile';

const DB_NAME = 'mon-farm.db';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS farm_profile (
    id  INTEGER PRIMARY KEY CHECK (id = 1),
    doc TEXT NOT NULL
  );
`;

export class SqliteFarmProfileStore extends DocFarmProfileStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(SCHEMA);
    }
    return this.db;
  }

  protected async read(): Promise<FarmProfile> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ doc: string }>(`SELECT doc FROM farm_profile WHERE id = 1`);
    if (!row) return EMPTY_PROFILE;
    try {
      const doc = JSON.parse(row.doc) as Partial<FarmProfile>;
      return { zones: doc.zones ?? [], seededTs: doc.seededTs ?? null };
    } catch {
      return EMPTY_PROFILE;
    }
  }

  protected async write(profile: FarmProfile): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO farm_profile (id, doc) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET doc = excluded.doc`,
      JSON.stringify(profile),
    );
  }
}

export const farmProfileStore: FarmProfileStore = new SqliteFarmProfileStore();
