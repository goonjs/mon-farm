import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Native account store on start-up (owner q3 = ก, 2026-11-08), with expo-sqlite faked. Native has never
 * run on a device (E01-S06); these pin what the gate relies on: a read that fails once is tried again,
 * an open that failed is not remembered until the app closes, and a read that keeps failing throws
 * instead of reading as "never signed in".
 */
const somchai = { userId: 'uid-1', displayName: 'สมชาย', identities: [{ provider: 'google', subject: 'g-1' }] };

const sqlite = vi.hoisted(() => ({ opens: 0, failOpens: 0, failReads: 0 }));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => {
    sqlite.opens += 1;
    if (sqlite.failOpens > 0) {
      sqlite.failOpens -= 1;
      throw new Error('database is locked');
    }
    const read = <T,>(value: T) => async () => {
      if (sqlite.failReads > 0) {
        sqlite.failReads -= 1;
        throw new Error('disk I/O error');
      }
      return value;
    };
    return {
      execAsync: async () => undefined,
      getFirstAsync: read({ value: JSON.stringify(somchai) }),
      getAllAsync: read([{ group_id: 'g-1', user_id: 'uid-1', name: 'สวนบ้านนา', role: 'owner' }]),
    };
  }),
}));

const { SqliteAccountStore } = await import('./account.native');

beforeEach(() => {
  Object.assign(sqlite, { opens: 0, failOpens: 0, failReads: 0 });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('SqliteAccountStore — start-up reads', () => {
  it('an open that fails once is tried again: the user is read', async () => {
    sqlite.failOpens = 1;
    expect(await new SqliteAccountStore().user()).toEqual(somchai);
    expect(sqlite.opens).toBe(2);
  });

  it('a read that fails once is tried again, for the user and the groups', async () => {
    const store = new SqliteAccountStore();
    sqlite.failReads = 1;
    expect(await store.user()).toEqual(somchai);
    sqlite.failReads = 1;
    expect((await store.memberships()).map((m) => m.groupId)).toEqual(['g-1']);
  });

  it('two failures throw — not "never signed in" — and a later call opens again instead of reusing the failure', async () => {
    const store = new SqliteAccountStore();
    sqlite.failOpens = 2;
    await expect(store.user()).rejects.toThrow();
    expect(await store.user()).toEqual(somchai);
  });

  it('no stored session is still "never signed in"', async () => {
    const { openDatabaseAsync } = await import('expo-sqlite');
    vi.mocked(openDatabaseAsync).mockImplementationOnce(async () => ({ execAsync: async () => undefined, getFirstAsync: async () => null }) as never);
    expect(await new SqliteAccountStore().user()).toBeNull();
  });
});
