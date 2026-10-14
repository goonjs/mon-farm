import { expect, test } from '@playwright/test';

import { admin, documents, emulatorSession, persistedUser, writeFirebaseSession } from './firebase-emulator';
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
  // No Firebase session yet, so the server cannot be asked who this user is: not a create-group screen (E02-S05).
  await expect(page.getByTestId('group-check-failed')).toBeVisible();
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
