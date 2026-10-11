/**
 * Web account store: the app's IndexedDB database `mon-farm-v1`, as the
 * architecture lays it out (§Schema — เว็บ, schema in `idb.ts`):
 *   - the signed-in user in `meta`, key `session` (the event store owns key
 *     `device` in the same store; each module touches only its own key)
 *   - one record per group in `memberships`, keyed by `groupId`
 *   - pending server writes in `pendingOps`, keyed `${op}:${groupId}`
 *
 * Nothing is cached: every read goes to the database and every write is one
 * `readwrite` transaction, so a second tab (or a stale read in this one) can
 * never write an old copy back over a newer one — IndexedDB serialises the
 * transactions across tabs. A group's membership and its `create_group` op
 * are written in one transaction over both stores: together or not at all.
 *
 * Where IndexedDB cannot be opened at all (some private modes) the account
 * lives in memory for this session, as the event store's records do, and the
 * not-durable warning is raised (`durability.ts`, E01-S03). Once IndexedDB is
 * open, a failed sign-in write still keeps the user in memory for this
 * session and warns; a failed group write is refused instead: a group that a
 * reload would forget must not be entered.
 */

import type { CreateGroupOp, Membership } from '../core/group';
import type { User } from '../core/user';
import type { AccountStore } from './account';
import { MemoryAccountStore } from './account-memory';
import { markNotDurable } from './durability';
import { committed, connection, request } from './idb';

const SESSION = 'session';

function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null && typeof (v as User).userId === 'string';
}

export class WebAccountStore implements AccountStore {
  private readonly open: () => Promise<IDBDatabase>;
  private chosen: Promise<IDBDatabase | MemoryAccountStore> | null = null;
  /** Only when the session could not be stored: this tab's sign-in, until reload. */
  private unsaved: User | null = null;

  /** `factory` is for tests; the app uses the page's IndexedDB. */
  constructor(factory: () => IDBFactory | undefined = () => globalThis.indexedDB) {
    this.open = connection(factory);
  }

  /** IndexedDB when it can be opened on first use; otherwise memory, and say so. */
  private async pick(): Promise<IDBDatabase | MemoryAccountStore> {
    this.chosen ??= this.open().catch((err) => {
      console.warn('IndexedDB unavailable; the account is kept in memory only.', err);
      markNotDurable(err);
      return new MemoryAccountStore();
    });
    const chosen = await this.chosen;
    // Chosen once; after that, the connection reopens itself if dropped.
    return chosen instanceof MemoryAccountStore ? chosen : this.open();
  }

  async user(): Promise<User | null> {
    // A dropped connection (Safari, a transient error) must not read as "never
    // signed in" — that would ask for internet at the farm. Try once more first.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const db = await this.pick();
        if (db instanceof MemoryAccountStore) return db.user();
        const stored = await request(db.transaction('meta', 'readonly').objectStore('meta').get(SESSION));
        if (stored === undefined) return this.unsaved;
        if (isUser(stored)) return stored;
        console.warn('Stored session is not a user; treating as signed out.', stored);
        return this.unsaved;
      } catch (err) {
        if (attempt === 1) console.warn('Stored session could not be read; treating as signed out.', err);
      }
    }
    return this.unsaved;
  }

  async saveUser(user: User): Promise<void> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.saveUser(user);
    try {
      const tx = db.transaction('meta', 'readwrite');
      const done = committed(tx);
      tx.objectStore('meta').put(user, SESSION);
      await done;
      this.unsaved = null;
    } catch (err) {
      this.unsaved = user;
      markNotDurable(err);
    }
  }

  async memberships(): Promise<Membership[]> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.memberships();
    return (await request(db.transaction('memberships', 'readonly').objectStore('memberships').getAll())) as Membership[];
  }

  async createGroup(membership: Membership, op: CreateGroupOp): Promise<void> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.createGroup(membership, op);
    const tx = db.transaction(['memberships', 'pendingOps'], 'readwrite');
    const done = committed(tx);
    // `add`, not `put`: an existing key aborts the whole transaction, so
    // neither half is written over or written alone.
    tx.objectStore('memberships').add(membership);
    tx.objectStore('pendingOps').add(op, `${op.op}:${op.groupId}`);
    await done;
  }

  async saveMemberships(memberships: readonly Membership[]): Promise<void> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.saveMemberships(memberships);
    const tx = db.transaction('memberships', 'readwrite');
    const done = committed(tx);
    // `put`: asking the server again must not fail on a group already kept.
    for (const m of memberships) tx.objectStore('memberships').put(m);
    await done;
  }

  async pendingOps(): Promise<CreateGroupOp[]> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.pendingOps();
    return (await request(db.transaction('pendingOps', 'readonly').objectStore('pendingOps').getAll())) as CreateGroupOp[];
  }

  async completeOp(op: CreateGroupOp): Promise<void> {
    const db = await this.pick();
    if (db instanceof MemoryAccountStore) return db.completeOp(op);
    const tx = db.transaction('pendingOps', 'readwrite');
    const done = committed(tx);
    tx.objectStore('pendingOps').delete(`${op.op}:${op.groupId}`);
    await done;
  }
}

export const accountStore: AccountStore = new WebAccountStore();
