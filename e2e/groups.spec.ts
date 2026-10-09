import { expect, test } from '@playwright/test';

import type { CreateGroupOp, Membership } from '../src/core/group';
import { BASE_URL, readStore, signedInNoGroup } from './session';

/**
 * E02-S02: signed in with no farm group → only create / join; create one →
 * straight into it; reopen with every request off this origin failing →
 * straight into the same group, no picker, no login.
 */

const SHOTS = 'docs/ux/screenshots/overnight/e02';

test.use({ storageState: signedInNoGroup, viewport: { width: 390, height: 844 } });

test('create a farm group, then reopen offline straight into it', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('group-start')).toBeVisible();
  await expect(page.getByText('ต้องมีกลุ่มฟาร์มก่อนจึงจะบันทึกข้อมูลได้')).toBeVisible();
  await expect(page.getByTestId('empty-state')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/s02-group-start.png` });

  await page.getByTestId('group-create').click();
  await page.getByTestId('group-submit').click();
  await expect(page.getByText('ใส่ชื่อกลุ่มฟาร์ม', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/s02-create-name-required.png` });

  // Created with no network at all: the id is minted on the device.
  await context.setOffline(true);
  await page.getByTestId('group-name').fill('สวนบ้านนา');
  await page.screenshot({ path: `${SHOTS}/s02-create-group.png` });
  await page.getByTestId('group-submit').click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/s02-in-group.png` });

  // Kept in IndexedDB (architecture §Schema — เว็บ), not localStorage.
  const memberships = await page.evaluate(readStore<Membership>, 'memberships');
  const pendingOps = await page.evaluate(readStore<CreateGroupOp>, 'pendingOps');
  expect(memberships).toEqual([expect.objectContaining({ name: 'สวนบ้านนา', role: 'owner', userId: 'e2e-user' })]);
  expect(pendingOps).toEqual([
    expect.objectContaining({ op: 'create_group', groupId: memberships[0].groupId, createdBy: 'e2e-user' }),
  ]);
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:account'))).toBeNull();

  // Reopen: the page itself must load (no service worker), everything else fails.
  await context.setOffline(false);
  await context.route(
    (url) => url.origin !== BASE_URL,
    (route) => route.abort('internetdisconnected'),
  );
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('group-start')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/s02-reopen-offline.png` });
});

test('a sale started in the group records the group id on its events', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('group-create').click();
  await page.getByTestId('group-name').fill('สวนบ้านนา');
  await page.getByTestId('group-submit').click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
  const [{ groupId }] = await page.evaluate(readStore<Membership>, 'memberships');

  await page.getByTestId('new-sale').click();
  // The default split saves on its own (setup.spec.ts) — an event to inspect.
  await expect(page.getByTestId('saved-split')).toContainText('บันทึกแล้ว');

  const groups = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('events').objectStore('events').getAll();
          all.onsuccess = () => resolve(all.result.map((r: { event: { groupId: string } }) => r.event.groupId));
          all.onerror = () => reject(all.error);
        };
      }),
  );
  expect(groups.length).toBeGreaterThan(0);
  expect(new Set(groups)).toEqual(new Set([groupId]));
});
