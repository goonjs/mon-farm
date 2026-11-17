import { FIXTURE_GROUP_ID } from '../src/core/fixtures';
import type { BrowserContext } from '@playwright/test';

import { DB_NAME, DB_VERSION, STORES, type StoreSpec } from '../src/store/idb';

/**
 * E02-S01/S02: every screen sits behind sign-in and an open farm group. The
 * interaction suites are about counting and settling, not about logging in,
 * so they start from a device that has already signed in — the account the
 * app keeps in IndexedDB (`src/store/account.web.ts`), preloaded by
 * `preloadAccount` below. The database is built from the app's own schema
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

/** What the device has stored before the test opens the app: who signed in, and their farm groups. `null` = never signed in. */
export type Account = { user: typeof E2E_USER; memberships: PreloadedMembership[] } | null;

const account = (memberships: PreloadedMembership[], user = E2E_USER): Account => ({ user, memberships });

/** Signed in, one farm group — the group the fixtures' events are recorded in. */
export const signedIn = account([
  { groupId: FIXTURE_GROUP_ID, userId: E2E_USER.userId, name: 'สวนทดสอบ', role: 'owner' },
]);

/** Signed in, no farm group yet (E02-S02). */
export const signedInNoGroup = account([]);

/** Signed in as someone else, no farm group yet — for specs that must not share a server-side user with the others. */
export const signedInNoGroupAs = (user: typeof E2E_USER) => account([], user);

/** A browser that has never signed in — for the login screen itself. */
export const signedOut: Account = null;

/**
 * Puts `account` on the device before the app's first script runs (the
 * `account` fixture in `e2e/test.ts`; call it yourself on a context you make
 * with `browser.newContext`).
 *
 * Until 2026-11-07 this went through Playwright's `storageState`, whose
 * IndexedDB restore resolves on each `add()` request without waiting for the
 * transaction to commit, then closes the page it wrote from. About once in
 * 150 runs a test opened on the sign-in screen, which fits a restore that
 * never committed (not proven). Here the records are written inside the
 * transaction that creates the database, from a script that runs before the
 * app's: IndexedDB queues the app's own `open` behind that upgrade, so the app
 * cannot read the database before the account is in it. It writes only when
 * the database does not exist yet, so a reload keeps what the test changed.
 */
export async function preloadAccount(context: BrowserContext, account: Account): Promise<void> {
  if (!account) return;
  await context.addInitScript(seedAccount, { origin: BASE_URL, name: DB_NAME, version: DB_VERSION, stores: STORES, ...account });
}

/** Runs in the page (serialised by Playwright): self-contained, no imports. */
function seedAccount(a: { origin: string; name: string; version: number; stores: readonly StoreSpec[]; user: unknown; memberships: unknown[] }) {
  if (location.origin !== a.origin) return;
  const open = indexedDB.open(a.name, a.version);
  open.onupgradeneeded = (event) => {
    if (event.oldVersion !== 0) return;
    const db = open.result;
    for (const spec of a.stores) {
      const store = db.createObjectStore(spec.name, spec.keyPath ? { keyPath: spec.keyPath } : undefined);
      for (const index of spec.indexes) store.createIndex(index.name, index.keyPath);
    }
    const tx = open.transaction!;
    tx.objectStore('meta').put(a.user, 'session');
    for (const m of a.memberships) tx.objectStore('memberships').put(m);
  };
  open.onsuccess = () => open.result.close();
  open.onerror = () => console.error(`e2e: preloading the account failed: ${String(open.error)}`);
}

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
