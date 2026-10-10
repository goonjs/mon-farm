import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';

/**
 * E03-S01: people and buyers as farm master data, exercised in a real
 * browser with the network off. Portrait is the primary orientation for
 * these screens (D-17), so the viewport is pinned here; screenshots are
 * taken once, from the first project only.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

const SHOTS = 'docs/ux/screenshots/overnight/farm';

test('people: create offline, survive a reload, filter, delete and restore', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  };

  await page.goto('/');
  await expect(page.getByTestId('open-farm-data')).toBeVisible();
  await context.setOffline(true);

  await page.getByTestId('open-farm-data').click();
  await expect(page.getByTestId('farm-data-people')).toBeVisible();
  await shot('e03-s01-farm-data');

  await page.getByTestId('farm-data-people').click();
  await page.getByTestId('add-person').click();

  // Edge case: saving empty shows both errors and writes nothing.
  await page.getByTestId('person-save').click();
  await expect(page.getByText('ใส่ชื่อ')).toBeVisible();
  await expect(page.getByText('เลือกบทบาทอย่างน้อย 1 อย่าง')).toBeVisible();
  await shot('e03-s01-person-form-errors');

  await page.getByTestId('person-name').fill('แดง');
  await page.getByTestId('role-tapper').click();
  await page.getByTestId('person-save').click();

  await page.getByTestId('add-person').click();
  await page.getByTestId('person-name').fill('อาจารย์สมหวัง');
  await page.getByTestId('role-manager').click();
  await page.getByTestId('role-payer').click();
  await page.getByTestId('person-other-role').fill('ลูกคนงาน');
  await page.getByTestId('person-add-other-role').click();
  await shot('e03-s01-person-form');
  await page.getByTestId('person-save').click();
  await expect(page.getByText('อาจารย์สมหวัง')).toBeVisible();

  // Everything above was written with the network off. There is no service
  // worker (yet), so the app shell itself needs the network to reload; what
  // this proves is that the DATA survives — it came from the local log.
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByText('แดง', { exact: true })).toBeVisible();
  await expect(page.getByText('อาจารย์สมหวัง')).toBeVisible();
  await shot('e03-s01-people-list');

  await page.getByTestId('filter-tapper').click();
  await expect(page.getByText('อาจารย์สมหวัง')).toHaveCount(0);
  await expect(page.getByText('แดง', { exact: true })).toBeVisible();
  await shot('e03-s01-people-filter-tapper');

  await page.getByText('แดง', { exact: true }).click();
  await expect(page.getByTestId('person-profile')).toContainText('แดง');
  await shot('e03-person-detail');
  await page.getByTestId('person-delete').click();
  await expect(page.getByTestId('delete-confirm')).toContainText('กู้คืนได้');
  await shot('e03-s01-delete-confirm');
  await page.getByTestId('delete-confirm-yes').click();

  await expect(page.getByText('แดง', { exact: true })).toHaveCount(0);
  await page.getByTestId('show-deleted').click();
  await expect(page.getByText('ลบแล้ว')).toBeVisible();
  await shot('e03-s01-people-deleted');
  await page.locator('[data-testid^="restore-"]').first().click();
  await page.getByTestId('hide-deleted').click();
  await expect(page.getByText('แดง', { exact: true })).toBeVisible();
});

test('buyers: add two, and the form keeps working offline', async ({ page, context }, info) => {
  await page.goto('/');
  await context.setOffline(true);
  await page.getByTestId('open-farm-data').click();
  await page.getByTestId('farm-data-buyers').click();
  for (const name of ['คนรับซื้อยาง ก', 'คนรับซื้อยาง ข']) {
    await page.getByTestId('buyer-name').fill(name);
    await page.getByTestId('buyer-save').click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('คนรับซื้อยาง ข')).toBeVisible();
  if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/e03-s01-buyers.png`, fullPage: true });
});

test('share: a tapper starts at 50/50; a custom share from a date is kept offline (E03-S06)', async ({ page, context }, info) => {
  await page.goto('/person/new');
  await page.getByTestId('person-name').fill('แดง');
  await page.getByTestId('role-tapper').click();
  await page.getByTestId('person-save').click();
  await expect(page.getByTestId('add-person')).toBeVisible();
  await context.setOffline(true);
  await page.getByText('แดง', { exact: true }).click();
  // The person's detail (farm-05) shows the share; it opens on its own screen.
  await expect(page.getByTestId('share-summary')).toContainText('คนกรีดยาง 50%');
  await page.getByTestId('share-summary').click();
  await expect(page.getByTestId('share-now')).toContainText('คนกรีดยาง 50%');
  await page.getByTestId('share-custom').click();
  await page.getByTestId('share-pct').fill('101');
  await page.getByTestId('share-save').click();
  await expect(page.getByText('ใส่ได้ตั้งแต่ 0 ถึง 100')).toBeVisible();
  await page.getByTestId('share-pct').fill('55');
  await expect(page.getByTestId('share-owner')).toContainText('45%');
  await page.getByTestId('share-from').fill('1/1/2569');
  if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/e03-s06-share-form.png`, fullPage: true });
  await page.getByTestId('share-save').click();
  await expect(page.getByTestId('share-history')).toContainText('55%');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('share-now')).toContainText('คนกรีดยาง 55%');
  if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/e03-s06-share-saved.png`, fullPage: true });
});
