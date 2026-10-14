import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { newGroup } from '../core/group';
import { userFromSignIn } from '../core/user';
import type { AccountStore } from './account';
import { MemoryAccountStore } from './account-memory';
import { WebAccountStore } from './account.web';
import { durabilityLost } from './durability';
import { DB_NAME, openDb } from './idb';

const somchai = userFromSignIn('uid-1', 'สมชาย', { provider: 'google', subject: 'g-1' });

/** One browser profile: every `open()` is a new store instance on the same IndexedDB — a reload, or another tab. */
function profile() {
  const factory = new IDBFactory();
  return { factory, open: () => new WebAccountStore(() => factory) };
}

/** A browser where IndexedDB cannot be opened at all (some private modes). */
const noIndexedDb = () =>
  new WebAccountStore(() => {
    throw new Error('SecurityError');
  });

describe('MemoryAccountStore', () => {
  it('has no user until one signs in', async () => {
    const s = new MemoryAccountStore();
    expect(await s.user()).toBeNull();
    await s.saveUser(somchai);
    expect(await s.user()).toEqual(somchai);
  });
});

describe('WebAccountStore (E02-S01: the session survives a force-close)', () => {
  it('a signed-in user is still there after a reload, with no network involved', async () => {
    const { open } = profile();
    await open().saveUser(somchai);
    expect(await open().user()).toEqual(somchai);
  });

  it('a fresh profile has no user', async () => {
    expect(await profile().open().user()).toBeNull();
  });

  it('keeps the session in the IndexedDB `meta` store, key `session` (architecture §Schema — เว็บ)', async () => {
    const { factory, open } = profile();
    await open().saveUser(somchai);
    const db = await openDb(factory);
    const stored = await new Promise((resolve, reject) => {
      const r = db.transaction('meta').objectStore('meta').get('session');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    expect(stored).toEqual(somchai);
  });

  it('a malformed stored session reads as signed out rather than crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { factory, open } = profile();
    const db = await openDb(factory);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put('{not a user', 'session');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    expect(await open().user()).toBeNull();
  });

  it('no IndexedDB: keeps the user for this session and raises the not-durable warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = noIndexedDb();
    await s.saveUser(somchai);
    expect(await s.user()).toEqual(somchai);
    expect(durabilityLost()).toBe(true);
  });

  it('uses the app database, not a second one', () => {
    expect(DB_NAME).toBe('mon-farm-v1');
  });
});

const created = newGroup('g-local', 'สวนบ้านนา', somchai, 1_790_000_000_000);

/** E02-S02: memberships are kept on the device, so an offline reopen can enter the group (AC5). */
describe.each<[string, () => () => AccountStore]>([
  ['MemoryAccountStore', () => {
    const s = new MemoryAccountStore();
    return () => s;
  }],
  ['WebAccountStore', () => profile().open],
])('%s — memberships', (_name, device) => {
  it('starts with no group', async () => {
    const open = device();
    expect(await open().memberships()).toEqual([]);
    expect(await open().pendingOps()).toEqual([]);
  });

  it('creating a group keeps the membership and queues the server batch, across a reload', async () => {
    const open = device();
    await open().createGroup(created.membership, created.op);
    const reopened = open();
    expect(await reopened.memberships()).toEqual([created.membership]);
    expect(await reopened.pendingOps()).toEqual([created.op]);
  });

  it('completing an op removes that op only, keeps the membership, and survives a reload (E01-S09)', async () => {
    const open = device();
    const other = newGroup('g-other', 'สวนริมน้ำ', somchai, 1_790_000_000_001);
    await open().createGroup(created.membership, created.op);
    await open().createGroup(other.membership, other.op);
    await open().completeOp(created.op);
    expect(await open().pendingOps()).toEqual([other.op]);
    expect(await open().memberships()).toHaveLength(2);
    // Completing it again (a repeated drain) is harmless.
    await open().completeOp(created.op);
    expect(await open().pendingOps()).toEqual([other.op]);
  });

  it('restoring groups from the server keeps them across a reload, queues no op, and is idempotent (E02-S05)', async () => {
    const open = device();
    const restored = { groupId: 'g-server', userId: 'uid-1', name: 'สวนบ้านนา', role: 'owner' as const };
    const second = { ...restored, groupId: 'g-two', name: 'สวนสอง' };
    await open().saveMemberships([restored]);
    await open().saveMemberships([restored, second]);
    expect(await open().memberships()).toEqual([restored, second]);
    expect(await open().pendingOps()).toEqual([]);
  });

  it('restoring a group never touches the pending op of a group made here (E02-S05)', async () => {
    const open = device();
    await open().createGroup(created.membership, created.op);
    await open().saveMemberships([{ ...created.membership, name: 'ชื่อจากเซิร์ฟเวอร์' }]);
    expect(await open().pendingOps()).toEqual([created.op]);
    expect(await open().memberships()).toHaveLength(1);
  });

  it('the signed-in user and the memberships do not overwrite each other', async () => {
    const open = device();
    await open().saveUser(somchai);
    await open().createGroup(created.membership, created.op);
    expect(await open().user()).toEqual(somchai);
    expect(await open().memberships()).toHaveLength(1);
  });
});

describe('WebAccountStore — two tabs on one profile (review F1)', () => {
  it("a tab that read the account earlier cannot wipe another tab's new group by signing in", async () => {
    const { open } = profile();
    const tabA = open();
    const tabB = open();
    // Both tabs have read the account before anything happened.
    expect(await tabB.user()).toBeNull();
    expect(await tabB.memberships()).toEqual([]);
    expect(await tabA.memberships()).toEqual([]);

    await tabA.saveUser(somchai);
    await tabA.createGroup(created.membership, created.op);
    // Tab B, still on its first read, signs in.
    await tabB.saveUser(somchai);

    const reloaded = open();
    expect(await reloaded.memberships()).toEqual([created.membership]);
    expect(await reloaded.pendingOps()).toEqual([created.op]);
    // And tab B sees the group without a reload, so it does not offer to create a second one.
    expect(await tabB.memberships()).toEqual([created.membership]);
  });

  it('two tabs creating groups at once keep both', async () => {
    const { open } = profile();
    const other = newGroup('g-other', 'สวนริมน้ำ', somchai, 1_790_000_000_001);
    await Promise.all([
      open().createGroup(created.membership, created.op),
      open().createGroup(other.membership, other.op),
    ]);
    expect(await open().memberships()).toHaveLength(2);
    expect(await open().pendingOps()).toHaveLength(2);
  });
});

describe('WebAccountStore without IndexedDB (E01-S03 AC4: still usable, says nothing is kept)', () => {
  it('signs in and opens a group in memory for this session, like the event store, and warns', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = noIndexedDb();
    await s.saveUser(somchai);
    await s.createGroup(created.membership, created.op);
    expect(await s.user()).toEqual(somchai);
    expect(await s.memberships()).toEqual([created.membership]);
    expect(durabilityLost()).toBe(true);
  });
});

describe('WebAccountStore — a group that cannot be kept is not reported as created', () => {

  it('a failed write leaves neither half: no membership without its op', async () => {
    const { open } = profile();
    await open().createGroup(created.membership, created.op);
    // Same group again: the op key already exists, so the whole transaction aborts.
    const again = newGroup('g-local', 'ชื่อใหม่', somchai, 2);
    await expect(open().createGroup(again.membership, again.op)).rejects.toThrow();
    expect(await open().memberships()).toEqual([created.membership]);
    expect(await open().pendingOps()).toEqual([created.op]);
  });
});

describe('IndexedDB v1 → v2 (E02-S02: adds stores only)', () => {
  it('a browser that has v1 events keeps them and gains the account stores', async () => {
    const factory = new IDBFactory();
    // A v1 database as the previous build left it: events + meta, one event.
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        const events = open.result.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('saleId', 'saleId');
        events.createIndex('pending', 'pending');
        open.result.createObjectStore('meta');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction('events', 'readwrite');
      tx.objectStore('events').put({ id: 'old-1', saleId: 's1', ts: 1, deviceSeq: 1, pending: 1, event: { id: 'old-1' } });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v1.close();

    const db = await openDb(factory);
    expect([...db.objectStoreNames].sort()).toEqual(['events', 'memberships', 'meta', 'pendingOps']);
    const kept = await new Promise((resolve, reject) => {
      const r = db.transaction('events').objectStore('events').get('old-1');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    expect(kept).toMatchObject({ id: 'old-1', saleId: 's1' });
  });
});
