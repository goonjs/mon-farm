/**
 * Native account store: expo-sqlite, the `meta` table of `mon-farm-v1.db`
 * (architecture §Schema — native: `meta` key `session`). Same file and table
 * as the event store's device counter; each module only touches its own key.
 *
 * Written but not yet exercised on a device — native has never run (E01-S06).
 */

import * as SQLite from 'expo-sqlite';

import type { User } from '../core/user';
import type { AccountStore } from './account';

const DB_NAME = 'mon-farm-v1.db';

export class SqliteAccountStore implements AccountStore {
  private db: Promise<SQLite.SQLiteDatabase> | null = null;

  private open(): Promise<SQLite.SQLiteDatabase> {
    this.db ??= (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      return db;
    })();
    return this.db;
  }

  async user(): Promise<User | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = 'session'`);
    return row ? (JSON.parse(row.value) as User) : null;
  }

  async saveUser(user: User): Promise<void> {
    const db = await this.open();
    await db.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('session', ?)`, JSON.stringify(user));
  }
}

export const accountStore: AccountStore = new SqliteAccountStore();
