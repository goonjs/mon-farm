/**
 * Web account store: one small JSON document in localStorage, the same
 * trade-off as `farm.web.ts`. The user, the memberships and the pending
 * group ops live in that one document, so a group's membership row and its
 * `create_group` op are written in one `setItem` — together or not at all.
 *
 * A failed sign-in write keeps the user in memory for this session and
 * raises the not-durable warning (`durability.ts`). A failed group write is
 * refused instead: a group that a reload would forget must not be entered.
 */

import type { CreateGroupOp, Membership } from '../core/group';
import type { User } from '../core/user';
import type { AccountStore } from './account';
import { markNotDurable } from './durability';

const KEY = 'mon-farm:account';

interface AccountDoc {
  readonly user: User | null;
  readonly memberships: readonly Membership[];
  readonly pendingOps: readonly CreateGroupOp[];
}

const EMPTY: AccountDoc = { user: null, memberships: [], pendingOps: [] };

export class WebAccountStore implements AccountStore {
  private cached: AccountDoc | null = null;

  /** `storage` is for tests; the app uses the page's localStorage. */
  constructor(private readonly storage: () => Storage | undefined = () => globalThis.localStorage) {}

  private read(): AccountDoc {
    if (this.cached) return this.cached;
    try {
      const raw = this.storage()?.getItem(KEY);
      this.cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as AccountDoc) } : EMPTY;
    } catch (err) {
      console.warn('Stored account could not be read; treating as signed out.', err);
      this.cached = EMPTY;
    }
    return this.cached;
  }

  /** Throws when the document could not be stored; the cache follows only success. */
  private persist(doc: AccountDoc): void {
    const storage = this.storage();
    if (!storage) throw new Error('No localStorage.');
    storage.setItem(KEY, JSON.stringify(doc));
    this.cached = doc;
  }

  async user(): Promise<User | null> {
    return this.read().user;
  }

  async saveUser(user: User): Promise<void> {
    const doc = { ...this.read(), user };
    try {
      this.persist(doc);
    } catch (err) {
      this.cached = doc;
      markNotDurable(err);
    }
  }

  async memberships(): Promise<Membership[]> {
    return [...this.read().memberships];
  }

  async createGroup(membership: Membership, op: CreateGroupOp): Promise<void> {
    const doc = this.read();
    this.persist({
      ...doc,
      memberships: [...doc.memberships, membership],
      pendingOps: [...doc.pendingOps, op],
    });
  }

  async pendingOps(): Promise<CreateGroupOp[]> {
    return [...this.read().pendingOps];
  }
}

export const accountStore: AccountStore = new WebAccountStore();
