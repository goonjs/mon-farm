/**
 * Native persistence: expo-sqlite. Metro resolves this on iOS and Android.
 *
 * Why SQLite rather than AsyncStorage, specifically:
 *
 * NFR-1 requires counts to survive backgrounding, screen lock, force quit and
 * device restart, and calls a lost count "money lost and trust lost".
 * AsyncStorage's API is get/set over a blob, so appending basket 300 means
 * re-serialising and rewriting all 300 events. A force quit mid-write can tear
 * that blob and lose the whole sale. An INSERT loses at most the row in flight,
 * and WAL journaling protects the rest.
 *
 * UNIQUE(sale_id, seq) is the second reason: a duplicate sequence number
 * becomes a constraint violation enforced by the storage engine rather than an
 * invariant that JavaScript has to remember. And `synced_at IS NULL` gives the
 * outbox query for free, which is what makes this sync-ready without a sync
 * engine existing yet.
 */

import * as SQLite from 'expo-sqlite';

import { DuplicateSeqError, type EventStore } from './store';
import type { SaleEvent } from '../core/types';

const DB_NAME = 'mon-farm.db';

interface Row {
  sale_id: string;
  seq: number;
  ts: number;
  mono: number;
  kind: string;
  payload: string;
  actor: string;
}

/**
 * One table. No piles table, no zones table, no totals column — entities and
 * rollups are projections (see src/core/project.ts). One table means no
 * migration surface, and no way for a cached total to disagree with the log.
 */
const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS events (
    sale_id    TEXT    NOT NULL,
    seq        INTEGER NOT NULL,
    ts         INTEGER NOT NULL,
    mono       INTEGER NOT NULL,
    kind       TEXT    NOT NULL,
    payload    TEXT    NOT NULL,
    actor      TEXT    NOT NULL,
    synced_at  INTEGER,
    PRIMARY KEY (sale_id, seq)
  );
  CREATE INDEX IF NOT EXISTS events_pending ON events(synced_at) WHERE synced_at IS NULL;
`;

/** Everything except the columns stored in their own right. */
function toPayload(e: SaleEvent): string {
  const { saleId: _s, seq: _q, ts: _t, mono: _m, actor: _a, kind: _k, ...rest } = e as SaleEvent &
    Record<string, unknown>;
  return JSON.stringify(rest);
}

function fromRow(r: Row): SaleEvent {
  return {
    saleId: r.sale_id,
    seq: r.seq,
    ts: r.ts,
    mono: r.mono,
    actor: r.actor,
    kind: r.kind,
    ...JSON.parse(r.payload),
  } as SaleEvent;
}

export class SqliteStore implements EventStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(SCHEMA);
    }
    return this.db;
  }

  async append(event: SaleEvent): Promise<void> {
    const db = await this.open();
    try {
      await db.runAsync(
        `INSERT INTO events (sale_id, seq, ts, mono, kind, payload, actor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        event.saleId,
        event.seq,
        event.ts,
        event.mono,
        event.kind,
        toPayload(event),
        event.actor,
      );
    } catch (err) {
      // Surface the domain meaning rather than a SQLITE_CONSTRAINT string.
      if (String(err).includes('UNIQUE') || String(err).includes('constraint')) {
        throw new DuplicateSeqError(event.saleId, event.seq);
      }
      throw err;
    }
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM events WHERE sale_id = ? ORDER BY seq`,
      saleId,
    );
    return rows.map(fromRow);
  }

  async pending(): Promise<SaleEvent[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM events WHERE synced_at IS NULL ORDER BY sale_id, seq`,
    );
    return rows.map(fromRow);
  }

  async markSynced(saleId: string, seqs: readonly number[]): Promise<void> {
    if (!seqs.length) return;
    const db = await this.open();
    const now = Date.now();
    const holes = seqs.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE events SET synced_at = ? WHERE sale_id = ? AND seq IN (${holes})`,
      now,
      saleId,
      ...seqs,
    );
  }

  async listSales(): Promise<string[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ sale_id: string; started: number }>(
      `SELECT sale_id, MIN(ts) AS started FROM events GROUP BY sale_id ORDER BY started DESC`,
    );
    return rows.map((r) => r.sale_id);
  }
}

export const store: EventStore = new SqliteStore();
