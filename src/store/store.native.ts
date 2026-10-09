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
 * `id` is the primary key (E01-S02): one event, one row, wherever it was
 * minted. The device sequence counter lives in `meta` and is advanced in the
 * same exclusive transaction as the insert, so a force-close can never leave
 * a stored event whose number is handed out again (NFR-2). `synced_at IS NULL`
 * is the outbox.
 *
 * A new file, `mon-farm-v1.db`: the v0.4 log is not migrated (owner
 * 2026-10-03). The old `mon-farm.db` is left alone — the interim farm/people
 * stores still use it until E03 replaces them.
 */

import * as SQLite from 'expo-sqlite';

import { checkAppend, type DeviceState } from './append-rule';
import type { EventStore } from './store';
import { MASTER_SCOPE } from '../core/master';
import type { EventId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';

const DB_NAME = 'mon-farm-v1.db';

/**
 * Columns are the fields queries filter or order by; `body` is the whole event
 * as JSON, which is what `load` returns and what sync will send.
 */
const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS events (
    id          TEXT    PRIMARY KEY,
    sale_id     TEXT    NOT NULL,
    device_id   TEXT    NOT NULL,
    device_seq  INTEGER NOT NULL,
    user_id     TEXT    NOT NULL,
    kind        TEXT    NOT NULL,
    seq         INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    body        TEXT    NOT NULL,
    synced_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS events_outbox ON events(device_seq) WHERE synced_at IS NULL;
  CREATE INDEX IF NOT EXISTS events_sale ON events(sale_id);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export class SqliteStore implements EventStore {
  private db: Promise<SQLite.SQLiteDatabase> | null = null;
  /**
   * Tail of the write queue (see `serial`). The provider fires appends without
   * awaiting, and two racing transactions could otherwise commit seq 8 before
   * seq 7 — which the store would then renumber to 9, reversing this
   * device's outbox order.
   */
  private queue: Promise<unknown> = Promise.resolve();

  private open(): Promise<SQLite.SQLiteDatabase> {
    this.db ??= (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA);
      return db;
    })();
    return this.db;
  }

  private async readDevice(db: SQLite.SQLiteDatabase): Promise<DeviceState | null> {
    const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = 'device'`);
    return row ? (JSON.parse(row.value) as DeviceState) : null;
  }

  private async writeDevice(db: SQLite.SQLiteDatabase, d: DeviceState): Promise<void> {
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES ('device', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      JSON.stringify(d),
    );
  }

  /**
   * Runs writes one at a time, in call order: once an exclusive transaction
   * holds the write lock, any other write aborts with "database is locked".
   */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    // A failed write must not wedge every write after it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  append(event: SaleEvent): Promise<void> {
    return this.serial(async () => {
      const db = await this.open();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const device = (await this.readDevice(txn)) ?? (await this.mintDevice(txn));
        const row = await txn.getFirstAsync<{ body: string }>(
          `SELECT body FROM events WHERE id = ?`,
          event.id,
        );
        const result = checkAppend(event, row ? (JSON.parse(row.body) as SaleEvent) : undefined, device);
        if (!result) return;
        const stored = result.event;
        await txn.runAsync(
          `INSERT INTO events (id, sale_id, device_id, device_seq, user_id, kind, seq, ts, body)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          stored.id,
          stored.saleId,
          stored.actor.deviceId,
          stored.deviceSeq,
          stored.actor.userId,
          stored.kind,
          stored.seq,
          stored.ts,
          JSON.stringify(stored),
        );
        if (result.device !== device) await this.writeDevice(txn, result.device);
      });
    });
  }

  private async mintDevice(db: SQLite.SQLiteDatabase): Promise<DeviceState> {
    const fresh: DeviceState = { deviceId: uuidv7(), nextDeviceSeq: 1 };
    await this.writeDevice(db, fresh);
    return fresh;
  }

  load(saleId: string): Promise<SaleEvent[]> {
    // Behind queued appends, so re-entering a sale right after leaving it
    // cannot read a log missing the baskets still being written.
    return this.serial(async () => {
      const db = await this.open();
      const rows = await db.getAllAsync<{ body: string }>(
        `SELECT body FROM events WHERE sale_id = ? ORDER BY seq, device_id, device_seq, id`,
        saleId,
      );
      return rows.map((r) => JSON.parse(r.body) as SaleEvent);
    });
  }

  async pending(): Promise<SaleEvent[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ body: string }>(
      `SELECT body FROM events WHERE synced_at IS NULL ORDER BY device_seq`,
    );
    return rows.map((r) => JSON.parse(r.body) as SaleEvent);
  }

  async markSynced(ids: readonly EventId[]): Promise<void> {
    if (!ids.length) return;
    const holes = ids.map(() => '?').join(',');
    await this.serial(async () => {
      const db = await this.open();
      await db.runAsync(
        `UPDATE events SET synced_at = ? WHERE id IN (${holes})`,
        Date.now(),
        ...ids,
      );
    });
  }

  async listSales(): Promise<string[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ sale_id: string; started: number }>(
      `SELECT sale_id, MIN(ts) AS started FROM events WHERE sale_id != ? GROUP BY sale_id ORDER BY started DESC`,
      MASTER_SCOPE,
    );
    return rows.map((r) => r.sale_id);
  }

  async isDurable(): Promise<boolean> {
    return true;
  }

  device(): Promise<DeviceState> {
    // Through the queue, so a first launch cannot mint two device ids.
    return this.serial(async () => {
      const db = await this.open();
      return (await this.readDevice(db)) ?? (await this.mintDevice(db));
    });
  }
}

export const store: EventStore = new SqliteStore();
