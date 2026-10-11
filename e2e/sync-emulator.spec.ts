import { expect, test, type APIRequestContext } from '@playwright/test';

import { E2E_USER, readStore, signedInNoGroup } from './session';

/**
 * E01-S09 in a real browser against the Firebase emulators: a new farm group
 * reaches the server by itself; then with no network a person is recorded and
 * waits in the outbox; back online the app sends it by itself and the outbox
 * empties, with no Sync button anywhere.
 *
 * Needs a build pointed at the emulators and the emulators running, so it is
 * skipped in the default run: `npm run test:e2e:sync` does both (with
 * `firebase.e2e.json`: one database, so the emulator loads the rules). Nothing here
 * touches a real Firebase project. The Firebase session is made by signing the
 * test user up on the Auth emulator and writing it where the SDK keeps its
 * persisted user (the Google popup is covered separately, `auth-emulator.spec.ts`).
 */

test.skip(!process.env.E2E_SYNC_EMULATOR, 'needs the emulators: npm run test:e2e:sync');
test.use({ storageState: signedInNoGroup, viewport: { width: 390, height: 844 } });

const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8085';
const PROJECT = 'demo-mon-farm';
const API_KEY = 'demo-api-key';
const DATABASE = process.env.E2E_FIRESTORE_DATABASE ?? '(default)';
const documents = `${FIRESTORE}/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
/** The emulator's admin token: skips the rules, for looking at what the app wrote. */
const admin = { Authorization: 'Bearer owner' };

/** Signs the test user up on the Auth emulator under the uid the app's session already has. */
async function emulatorSession(request: APIRequestContext) {
  const res = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    headers: admin, // the emulator lets an admin choose the uid
    data: { localId: E2E_USER.userId, email: 'e2e@example.com', password: 'secret-pass', returnSecureToken: true },
  });
  expect(res.ok()).toBe(true);
  // An admin-made account comes back without tokens: sign in to get them.
  const signedIn = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    data: { email: 'e2e@example.com', password: 'secret-pass', returnSecureToken: true },
  });
  expect(signedIn.ok()).toBe(true);
  return (await signedIn.json()) as { idToken: string; refreshToken: string; localId: string };
}

/** What the Firebase Auth SDK persists, so it restores this user on load. */
function persistedUser(s: { idToken: string; refreshToken: string; localId: string }) {
  const now = String(Date.now());
  return {
    fbase_key: `firebase:authUser:${API_KEY}:[DEFAULT]`,
    value: {
      uid: s.localId,
      email: 'e2e@example.com',
      emailVerified: false,
      isAnonymous: false,
      providerData: [],
      stsTokenManager: { refreshToken: s.refreshToken, accessToken: s.idToken, expirationTime: Date.now() + 3_600_000 },
      createdAt: now,
      lastLoginAt: now,
      apiKey: API_KEY,
      appName: '[DEFAULT]',
    },
  };
}

function writeFirebaseSession(record: ReturnType<typeof persistedUser>): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('firebaseLocalStorageDb', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put(record);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

interface EventRow {
  pending: 0 | 1;
  event: { id: string; groupId: string; actor: { userId: string } };
}

test('sends the new group, then what was recorded offline once the network returns', async ({ page, context, request }) => {
  test.setTimeout(90_000);
  // Rules are on for this database: an unauthenticated write is refused.
  const probe = await request.patch(`${documents}/groups/probe`, { data: { fields: { name: { stringValue: 'x' } } } });
  expect(probe.status()).toBe(403);

  const session = await emulatorSession(request);
  await page.goto('/');
  await expect(page.getByTestId('group-start')).toBeVisible();
  await page.evaluate(writeFirebaseSession, persistedUser(session));
  await page.reload();
  await expect(page.getByTestId('group-start')).toBeVisible();

  await page.getByTestId('group-name').fill('สวนบ้านนา');
  await page.getByTestId('group-create').click();
  await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();
  const [{ groupId }] = await page.evaluate(readStore<{ groupId: string }>, 'memberships');

  // The new group reaches the server by itself (the group is created before anything is sent into it).
  await expect.poll(async () => (await page.evaluate(readStore<unknown>, 'pendingOps')).length, { timeout: 30_000 }).toBe(0);
  const created = await request.get(`${documents}/groups/${groupId}`, { headers: admin });
  expect(created.ok()).toBe(true);

  // No network from here on: everything still works and waits in the outbox.
  await context.setOffline(true);
  // A full page load would need the network; move inside the running app instead.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/v2/people');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const id = (testID: string) => page.getByTestId(testID).filter({ visible: true });
  await id('add-person').click();
  await id('person-name').fill('สมหญิง');
  await id('role-tapper').click();
  await id('person-save').click();
  await expect(id('people-list')).toContainText('สมหญิง');

  const before = await page.evaluate(readStore<EventRow>, 'events');
  expect(before.length).toBeGreaterThan(0);
  expect(before.every((r) => r.pending === 1)).toBe(true);

  // Back online: no button, the app sends by itself.
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const rows = await page.evaluate(readStore<EventRow>, 'events');
        const ops = await page.evaluate(readStore<unknown>, 'pendingOps');
        return { pending: rows.filter((r) => r.pending === 1).length, ops: ops.length };
      },
      { timeout: 45_000 },
    )
    .toEqual({ pending: 0, ops: 0 });

  // What the server holds: the group made by this user, and exactly the local events.
  const group = await request.get(`${documents}/groups/${groupId}`, { headers: admin });
  expect(group.ok()).toBe(true);
  expect(((await group.json()) as { fields: { createdBy: { stringValue: string } } }).fields.createdBy.stringValue).toBe(E2E_USER.userId);
  const events = await request.get(`${documents}/groups/${groupId}/events?pageSize=300`, { headers: admin });
  const served = ((await events.json()) as { documents?: { name: string }[] }).documents ?? [];
  expect(served.map((d) => d.name.split('/').pop()).sort()).toEqual(before.map((r) => r.event.id).sort());
});
