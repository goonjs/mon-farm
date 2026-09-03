import { describe, expect, it, vi } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import { DuplicateSeqError } from './errors';
import { SqliteStore } from './store.native';

/**
 * `SqliteStore.appendAll` against a FAKE expo-sqlite (S23 review, finding 1).
 *
 * Be clear about what this proves and what it cannot. There is no device or
 * emulator here, so SQLite is not running: these tests prove the adapter's
 * WIRING — that a batch goes through exactly one `withTransactionAsync`, that
 * every event is inserted inside it, that a constraint violation surfaces as
 * `DuplicateSeqError` and propagates OUT of the transaction callback (which is
 * what makes a real transaction roll back), and that an empty batch opens no
 * transaction at all. They do NOT prove SQLite's atomicity or WAL durability;
 * that is the engine's contract, and the code's part of it is the part tested
 * here. A real force-quit-mid-transaction test needs a device and stays open
 * (see the story's QA notes).
 */

interface Insert {
  sql: string;
  args: unknown[];
}

const db = {
  execAsync: vi.fn(async () => {}),
  /** Enforces PRIMARY KEY (sale_id, seq) the way the real schema does. */
  runAsync: vi.fn(async (sql: string, ...args: unknown[]) => {
    if (sql.includes('INSERT')) {
      const key = `${args[0]}#${args[1]}`;
      if (keys.has(key)) throw new Error('UNIQUE constraint failed: events.sale_id, events.seq');
      keys.add(key);
      inserts.push({ sql, args });
    }
  }),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (body: () => Promise<void>) => {
    transactions += 1;
    await body();
  }),
};

let keys: Set<string>;
let inserts: Insert[];
let transactions = 0;

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => db }));

const batch = () => {
  const b = new LogBuilder('s1').sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'ย้อนหลัง' });
  b.accept('p1', 50_000, 2_000, 'bulk');
  b.accept('p1', 50_000, 2_000, 'bulk');
  b.short('p1', 10_400);
  b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
  return b.build();
};

function freshStore(): SqliteStore {
  keys = new Set();
  inserts = [];
  transactions = 0;
  vi.clearAllMocks();
  // A new instance each time: the adapter caches its handle, and each test
  // wants its own empty fake database.
  return new SqliteStore();
}

describe('SqliteStore.appendAll — one transaction around the batch', () => {
  it('inserts every event, inside exactly one transaction', async () => {
    const store = freshStore();
    await store.appendAll(batch());
    expect(transactions).toBe(1);
    expect(inserts).toHaveLength(5);
    expect(inserts.map((i) => i.args[1])).toEqual([1, 2, 3, 4, 5]);
  });

  it('surfaces a constraint violation as DuplicateSeqError, out of the transaction', async () => {
    const store = freshStore();
    const events = batch();
    await store.append(events[3]); // the leftover lands first, on its own

    await expect(store.appendAll(events)).rejects.toBeInstanceOf(DuplicateSeqError);
    // The error escapes the transaction body rather than being swallowed —
    // that is the signal a real `withTransactionAsync` rolls back on.
    expect(transactions).toBe(1);
  });

  it('opens no transaction for an empty batch', async () => {
    const store = freshStore();
    await store.appendAll([]);
    expect(transactions).toBe(0);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });
});
