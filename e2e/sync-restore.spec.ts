import { expect, test, type Page } from '@playwright/test';

import { admin, documents, emulatorSession, persistedUser, signInToEmulator, writeFirebaseSession } from './firebase-emulator';
import { evidence } from './fixtures';
import { BASE_URL, E2E_USER, readStore, signedInNoGroupAs } from './session';

/**
 * E02-S05 in a real browser against the Firebase emulators: the owner made a
 * farm group in one window; a second window with an empty profile signs in as
 * the same account. It must find that group, not offer a second one, and sync
 * must bring the farm's data in.
 *
 * Window two first has a server that does not answer (requests held): it says
 * it is fetching, then — after the 10 s bound — that it could not, with retry
 * and no create-group. Once the server answers, retry enters the group.
 *
 * The second window starts from the stored signed-in user with no group
 * (`signedInNoGroup`) — the state right after sign-in — because the Google
 * popup cannot be driven in this environment (`auth-emulator.spec.ts`); the
 * sign-in path itself is proven in the gate's component tests.
 *
 * Skipped in the default run: `npm run test:e2e:sync`. Screenshots are written
 * to docs/ only with UPDATE_SCREENSHOTS=1.
 */

/** Its own account: the other sync specs create groups for `e2e-user` on the same emulator. */
const OWNER = { ...E2E_USER, userId: 'restore-owner', displayName: 'เจ้าของสวน' };
const signedInNoGroup = signedInNoGroupAs(OWNER);

test.skip(!process.env.E2E_SYNC_EMULATOR, 'needs the emulators: npm run test:e2e:sync');
test.use({ storageState: signedInNoGroup, viewport: { width: 390, height: 844 } });

const SHOTS = 'docs/ux/screenshots/ui-v2/account';
const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });

test('a second device of the same account finds the existing farm group and its data, not a create-group screen', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(150_000);

  // ── Window one: sign in, create the farm group, record a person, let it sync. ──
  const session = await emulatorSession(request, OWNER);
  await page.goto('/');
  await expect(page.getByTestId('group-check-failed')).toBeVisible(); // no Firebase session yet
  await page.evaluate(writeFirebaseSession, persistedUser(session));
  await page.reload();
  await page.getByTestId('group-name').fill('สวนบ้านนา');
  await page.getByTestId('group-create').click();
  await expect(on(page)('v2-home')).toBeVisible();
  const [{ groupId }] = await page.evaluate(readStore<{ groupId: string }>, 'memberships');
  await expect.poll(async () => (await page.evaluate(readStore<unknown>, 'pendingOps')).length, { timeout: 30_000 }).toBe(0);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/v2/people');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await on(page)('add-person').click();
  await on(page)('person-name').fill('สมหญิง');
  await on(page)('role-tapper').click();
  await on(page)('person-save').click();
  await expect(on(page)('people-list')).toContainText('สมหญิง');
  await expect
    .poll(async () => (await page.evaluate(readStore<{ pending: 0 | 1 }>, 'events')).filter((r) => r.pending === 1).length, { timeout: 45_000 })
    .toBe(0);

  // ── Window two: a new device, nothing local but the signed-in user. ──
  const context = await browser.newContext({ storageState: signedInNoGroup, baseURL: BASE_URL, viewport: { width: 390, height: 844 } });
  try {
    const second = await context.newPage();
    const id = on(second);
    // The server (not the app's own origin) does not answer yet.
    let answering = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await context.route(/:8085\//, async (route) => {
      if (!answering) await held;
      await route.continue().catch(() => undefined);
    });

    await second.goto('/');
    await second.evaluate(writeFirebaseSession, persistedUser(await signInToEmulator(request, OWNER)));
    await second.reload();

    // Asking: nothing else is offered meanwhile.
    await expect(second.getByTestId('group-check')).toBeVisible();
    await expect(second.getByTestId('group-start')).toHaveCount(0);
    await evidence(second, `${SHOTS}/03-fetching-groups.png`);

    // No answer within the bound: said plainly, with retry, and still no create-group.
    await expect(second.getByTestId('group-check-failed')).toBeVisible({ timeout: 30_000 });
    await expect(second.getByText('ดึงรายการกลุ่มไม่สำเร็จ — ต่อเน็ตแล้วลองอีกครั้ง')).toBeVisible();
    await expect(second.getByTestId('group-start')).toHaveCount(0);
    await expect(second.getByTestId('group-create')).toHaveCount(0);
    await evidence(second, `${SHOTS}/04-fetching-groups-failed.png`);

    // The server answers: retry finds the existing group and goes in.
    answering = true;
    release();
    await second.getByTestId('group-check-retry').click();
    await expect(id('v2-home')).toBeVisible({ timeout: 30_000 });
    await expect(second.getByTestId('group-start')).toHaveCount(0);

    const restored = await second.evaluate(readStore<{ groupId: string; name: string; userId: string }>, 'memberships');
    expect(restored).toEqual([{ groupId, name: 'สวนบ้านนา', userId: OWNER.userId, role: 'owner' }]);
    expect(await second.evaluate(readStore<unknown>, 'pendingOps')).toEqual([]);

    // Sync's first pull brings the farm's data: the person recorded in window one.
    await second.goto('/v2/people');
    await expect(id('people-list')).toContainText('สมหญิง', { timeout: 45_000 });
    await evidence(second, `${SHOTS}/05-restored-group-data.png`);

    // Reopening goes straight in, and no second group exists on the server.
    await second.reload();
    await expect(id('people-list')).toContainText('สมหญิง');
    type GroupDoc = { name: string; fields: { createdBy: { stringValue: string } } };
    const groups = await request.get(`${documents}/groups`, { headers: admin });
    const served = ((await groups.json()) as { documents?: GroupDoc[] }).documents ?? [];
    const ours = served.filter((d) => d.fields.createdBy.stringValue === OWNER.userId);
    expect(ours.map((d) => d.name.split('/').pop())).toEqual([groupId]);
  } finally {
    await context.close();
  }
});
