import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * E01-S28 round 2 on device (review N10), with expo-sqlite faked: the copy marker in the event store's
 * `meta` table and the read-only old finance log (`finance_events` in `mon-farm.db`). Android has never run
 * these on a phone (E01-S06); the copy runs there today even though sync does not.
 */
const db = vi.hoisted(() => ({
  meta: new Map<string, string>(),
  financeTable: true,
  financeRows: [] as { body: string }[],
  opened: [] as string[],
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async (name: string) => {
    db.opened.push(name);
    return {
      execAsync: async () => undefined,
      getFirstAsync: async (sql: string, ...args: unknown[]) => {
        if (sql.includes('FROM meta')) {
          const v = db.meta.get(String(args[0]));
          return v === undefined ? null : { value: v };
        }
        if (sql.includes('sqlite_master')) return db.financeTable ? { name: 'finance_events' } : null;
        return null;
      },
      getAllAsync: async (sql: string) => (sql.includes('FROM finance_events') ? db.financeRows : []),
      runAsync: async (sql: string, ...args: unknown[]) => {
        if (sql.includes('INSERT INTO meta')) db.meta.set(String(args[0]), String(args[1]));
      },
    };
  }),
}));

const { SqliteStore } = await import('./store.native');
const { SqliteLegacyFinanceLog } = await import('./finance.native');

beforeEach(() => {
  db.meta.clear();
  db.financeTable = true;
  db.financeRows = [];
  db.opened = [];
});

describe('SqliteStore meta values (the copy marker)', () => {
  it('null until set, then the value; kept under its own key in meta', async () => {
    const store = new SqliteStore();
    expect(await store.metaValue('financeLogCopied')).toBeNull();
    await store.setMetaValue('financeLogCopied', '{"count":4}');
    expect(await store.metaValue('financeLogCopied')).toBe('{"count":4}');
    expect([...db.meta.keys()]).toEqual(['value:financeLogCopied']);
    expect(db.opened).toContain('mon-farm-v1.db');
  });
});

describe('SqliteLegacyFinanceLog (the old log, read-only)', () => {
  it('reads every row of finance_events in mon-farm.db', async () => {
    const e = { id: 'f1', groupId: 'g1', deviceSeq: 1, ts: 1, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId: 'c1', baseEventId: null, payload: { t: 'category_added', name: 'ค่าไฟ' } };
    db.financeRows = [{ body: JSON.stringify(e) }];
    expect(await new SqliteLegacyFinanceLog().load()).toEqual([e]);
    expect(db.opened).toContain('mon-farm.db');
  });

  it('a new install with no finance_events table reads as empty', async () => {
    db.financeTable = false;
    expect(await new SqliteLegacyFinanceLog().load()).toEqual([]);
  });

  it('has no way to write', () => {
    expect('append' in new SqliteLegacyFinanceLog()).toBe(false);
  });
});
