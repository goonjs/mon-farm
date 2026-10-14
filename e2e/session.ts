import { FIXTURE_GROUP_ID } from '../src/core/fixtures';
import { DB_NAME, DB_VERSION, STORES } from '../src/store/idb';

/**
 * E02-S01/S02: every screen sits behind sign-in and an open farm group. The
 * interaction suites are about counting and settling, not about logging in,
 * so they start from a device that has already signed in — the account the
 * app keeps in IndexedDB (`src/store/account.web.ts`), preloaded through
 * Playwright's `storageState`, which restores an origin's IndexedDB as well
 * as its localStorage. The database is built from the app's own schema
 * (`src/store/idb.ts`), so the app opens it without an upgrade.
 *
 * Signing in itself is covered by the gate's component tests.
 * `auth-emulator.spec.ts` drives the popup against the Firebase Auth emulator.
 */

export const BASE_URL = 'http://127.0.0.1:8080';

export const E2E_USER = {
  userId: 'e2e-user',
  displayName: 'ผู้ทดสอบ',
  identities: [{ provider: 'google', subject: 'e2e-google-sub' }],
};

interface PreloadedMembership {
  groupId: string;
  userId: string;
  name: string;
  role: 'owner';
}

/** Playwright's storage-state shape for one IndexedDB database (restored by `newContext`). */
function database(memberships: PreloadedMembership[], user: typeof E2E_USER) {
  const records: Record<string, { key?: unknown; value: unknown }[]> = {
    meta: [{ key: 'session', value: user }],
    memberships: memberships.map((m) => ({ value: m })),
  };
  return {
    name: DB_NAME,
    version: DB_VERSION,
    stores: STORES.map((s) => ({
      name: s.name,
      autoIncrement: false,
      keyPath: s.keyPath,
      indexes: s.indexes.map((i) => ({ ...i, unique: false, multiEntry: false })),
      records: records[s.name] ?? [],
    })),
  };
}

const account = (memberships: PreloadedMembership[], user = E2E_USER) => ({
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [], indexedDB: [database(memberships, user)] }],
});

/** Signed in, one farm group — the group the fixtures' events are recorded in. */
export const signedIn = account([
  { groupId: FIXTURE_GROUP_ID, userId: E2E_USER.userId, name: 'สวนทดสอบ', role: 'owner' },
]);

/** Signed in, no farm group yet (E02-S02). */
export const signedInNoGroup = account([]);

/** Signed in as someone else, no farm group yet — for specs that must not share a server-side user with the others. */
export const signedInNoGroupAs = (user: typeof E2E_USER) => account([], user);

/** A browser that has never signed in — for the login screen itself. */
export const signedOut = { cookies: [], origins: [] };

/** Reads one object store of the app's database from inside the page. */
export function readStore<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('mon-farm-v1');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const all = db.transaction(storeName).objectStore(storeName).getAll();
      all.onsuccess = () => {
        db.close();
        resolve(all.result as T[]);
      };
      all.onerror = () => reject(all.error);
    };
  });
}
