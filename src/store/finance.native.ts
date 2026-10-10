/**
 * Native finance log: expo-sqlite, same database file as people and the farm
 * profile, its own append-only table. Moves into `events` with the envelope
 * redesign (see `finance.ts`).
 */

import * as SQLite from 'expo-sqlite';

import type { FinanceEvent } from '../core/finance/types';
import type { FinanceStore } from './finance';
import { shouldInsert } from './finance-memory';

const DB_NAME = 'mon-farm.db';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS finance_events (
    id         TEXT PRIMARY KEY,
    target_id  TEXT NOT NULL,
    body       TEXT NOT NULL
  );
`;

export class SqliteFinanceStore implements FinanceStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(SCHEMA);
    }
    return this.db;
  }

  async append(event: FinanceEvent): Promise<void> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ body: string }>(`SELECT body FROM finance_events WHERE id = ?`, event.id);
    if (!shouldInsert(row ? (JSON.parse(row.body) as FinanceEvent) : undefined, event)) return;
    await db.runAsync(
      `INSERT INTO finance_events (id, target_id, body) VALUES (?, ?, ?)`,
      event.id,
      event.targetId,
      JSON.stringify(event),
    );
  }

  async load(): Promise<FinanceEvent[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ body: string }>(`SELECT body FROM finance_events`);
    return rows.map((r) => JSON.parse(r.body) as FinanceEvent);
  }
}

export const financeStore: FinanceStore = new SqliteFinanceStore();
