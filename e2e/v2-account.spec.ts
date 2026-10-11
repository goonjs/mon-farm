import { expect, test } from '@playwright/test';

import { evidence } from './fixtures';
import { BASE_URL, readStore, signedIn, signedInNoGroup, signedOut } from './session';
import type { CreateGroupOp, Membership } from '../src/core/group';
import type { SaleEvent } from '../src/core/types';

/**
 * E02-S01 + E02-S02 on the v2 shell, in the real web build and without a
 * backend: the sign-in gate, the first-launch-offline message, creating a farm
 * group offline, and reopening on a device that signed in before while every
 * request off this origin fails. Nothing here signs in through Google —
 * `auth-emulator.spec.ts` drives the popup against the Auth emulator.
 * Screenshots (light — the app has no way to switch to dark yet) are written
 * to docs/ only with UPDATE_SCREENSHOTS=1.
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/account';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'account screens are portrait-first'));
test.use({ viewport: { width: 390, height: 844 } });

test.describe('not signed in', () => {
  test.use({ storageState: signedOut });

  test('only the sign-in screen, on every route; offline it says the first sign-in needs internet', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('signin')).toBeVisible();
    await expect(page.getByText('ครั้งแรกต้องต่ออินเทอร์เน็ต')).toBeVisible();
    await expect(page.getByTestId('splash')).toHaveCount(0);
    await expect(page.getByTestId('v2-home')).toHaveCount(0);
    await evidence(page, `${SHOTS}/01-sign-in.png`);

    // A deep link to a recording screen lands on the sign-in screen too.
    await page.goto('/v2/people');
    await expect(page.getByTestId('signin')).toBeVisible();
    await expect(page.getByTestId('add-person')).toHaveCount(0);

    await context.setOffline(true);
    await page.getByTestId('signin-google').click();
    await expect(page.getByText('ต้องต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบครั้งแรก — ต่อเน็ตแล้วกดอีกครั้ง')).toBeVisible();
    await evidence(page, `${SHOTS}/02-sign-in-offline.png`);
    await expect(page.getByText(/ออกจากระบบ/)).toHaveCount(0);
  });
});

test.describe('signed in before', () => {
  test.use({ storageState: signedIn });

  test('reopens straight into the app with no auth backend reachable', async ({ page, context }) => {
    // Everything off this origin fails, as in airplane mode. (A reload under
    // `setOffline` cannot load the page itself — there is no service worker yet.)
    await context.route(
      (url) => url.origin !== BASE_URL,
      (route) => route.abort('internetdisconnected'),
    );
    await page.goto('/');
    await context.setOffline(true);
    await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId('signin')).toHaveCount(0);
    await expect(page.getByTestId('group-start')).toHaveCount(0);
  });
});

test.describe('signed in, no farm group', () => {
  test.use({ storageState: signedInNoGroup });

  test('only create (and a disabled join); create offline, then reopen offline straight into the group', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('group-start')).toBeVisible();
    await expect(page.getByText('ต้องมีกลุ่มฟาร์มก่อนจึงจะบันทึกข้อมูลได้', { exact: false })).toBeVisible();
    await expect(page.getByTestId('group-join')).toBeDisabled();
    await expect(page.getByTestId('v2-home')).toHaveCount(0);
    await evidence(page, `${SHOTS}/03-group-start.png`);

    await page.getByTestId('group-create').click();
    await expect(page.getByText('ใส่ชื่อกลุ่มฟาร์ม', { exact: true })).toBeVisible();
    await evidence(page, `${SHOTS}/04-name-required.png`);

    // Created with no network at all: the id is minted on the device.
    await context.setOffline(true);
    await page.getByTestId('group-name').fill('สวนบ้านนา');
    await expect(page.getByText('ใส่ชื่อกลุ่มฟาร์ม', { exact: true })).toHaveCount(0);
    await page.getByTestId('group-create').click();
    await expect(page.getByTestId('splash')).toBeVisible();
    await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();

    // Kept in IndexedDB (architecture §Schema — เว็บ), in one transaction with its op.
    const memberships = await page.evaluate(readStore<Membership>, 'memberships');
    const pendingOps = await page.evaluate(readStore<CreateGroupOp>, 'pendingOps');
    expect(memberships).toEqual([expect.objectContaining({ name: 'สวนบ้านนา', role: 'owner', userId: 'e2e-user' })]);
    expect(pendingOps).toEqual([expect.objectContaining({ op: 'create_group', groupId: memberships[0].groupId, createdBy: 'e2e-user' })]);

    // Reopen: the page itself must load (no service worker), everything else fails.
    await context.setOffline(false);
    await context.route(
      (url) => url.origin !== BASE_URL,
      (route) => route.abort('internetdisconnected'),
    );
    await page.reload();
    await context.setOffline(true);
    await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId('group-start')).toHaveCount(0);
    await expect(page.getByTestId('signin')).toHaveCount(0);
  });

  test('what is recorded in the group carries its id and the signed-in writer', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('group-name').fill('สวนบ้านนา');
    await page.getByTestId('group-create').click();
    await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();
    const [{ groupId }] = await page.evaluate(readStore<Membership>, 'memberships');

    await page.goto('/v2/people');
    const id = (testID: string) => page.getByTestId(testID).filter({ visible: true });
    await id('add-person').click();
    await id('person-name').fill('สมหญิง');
    await id('role-tapper').click();
    await id('person-save').click();
    await expect(id('people-list')).toContainText('สมหญิง');

    const events = (await page.evaluate(readStore<{ event: SaleEvent }>, 'events')).map((r) => r.event);
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((e) => e.groupId))).toEqual(new Set([groupId]));
    expect(new Set(events.map((e) => e.actor.userId))).toEqual(new Set(['e2e-user']));
  });
});
