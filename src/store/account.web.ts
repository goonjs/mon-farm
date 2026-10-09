/**
 * Web account store: one small JSON document in localStorage, the same
 * trade-off as `farm.web.ts`. It is read once per launch and written once
 * per sign-in, so a single document is written whole — never half.
 *
 * A failed write keeps the value in memory for this session and raises the
 * not-durable warning (`durability.ts`), so nobody is told they are signed
 * in "for good" when a reload would lose it.
 */

import type { User } from '../core/user';
import type { AccountStore } from './account';
import { markNotDurable } from './durability';

const KEY = 'mon-farm:account';

interface AccountDoc {
  readonly user: User | null;
}

const EMPTY: AccountDoc = { user: null };

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

  private write(doc: AccountDoc): void {
    this.cached = doc;
    try {
      const storage = this.storage();
      if (!storage) throw new Error('No localStorage.');
      storage.setItem(KEY, JSON.stringify(doc));
    } catch (err) {
      markNotDurable(err);
    }
  }

  async user(): Promise<User | null> {
    return this.read().user;
  }

  async saveUser(user: User): Promise<void> {
    this.write({ ...this.read(), user });
  }
}

export const accountStore: AccountStore = new WebAccountStore();
