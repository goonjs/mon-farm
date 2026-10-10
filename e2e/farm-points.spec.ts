import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';

/**
 * E03-S03: weighing points through the generic set-up helper (D-73), with
 * the network off — 2 farms, 3 tappers — then a duplicate name refused.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

const SHOTS = 'docs/ux/screenshots/overnight/farm';

async function addTapper(page: Page, name: string) {
  await page.goto('/person/new');
  await page.getByTestId('person-name').fill(name);
  await page.getByTestId('role-tapper').click();
  await page.getByTestId('person-save').click();
  // The save is async; leaving before it lands would lose it.
  await expect(page.getByTestId('add-person')).toBeVisible();
}

async function addFarm(page: Page, name: string) {
  await page.goto('/property/new');
  await page.getByTestId('property-name').fill(name);
  await page.getByTestId('crop-rubber').click();
  await page.getByTestId('property-save').click();
  await expect(page.getByTestId('add-property')).toBeVisible();
}

test('points: the helper creates every named point offline; names repeat only across farms', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  };
  // Navigation by URL loads the app shell, so set up while online, then cut the network.
  for (const n of ['แดง', 'นัด', 'ส้ม']) await addTapper(page, n);
  await addFarm(page, 'สวน ก');
  await addFarm(page, 'สวน ข');
  await page.goto('/properties');
  await context.setOffline(true);

  // Run 1: สวน ก, แดง ×2 and นัด ×1.
  await page.getByTestId('open-wizard').click();
  // The farm list stays mounted under the helper; pick the helper's own chip.
  await page.locator('[data-testid^="wizard-farm-"]', { hasText: 'สวน ก' }).click();
  await page.locator('[data-testid^="wizard-tapper-"]', { hasText: 'แดง' }).click();
  await page.locator('[data-testid^="wizard-tapper-"]', { hasText: 'นัด' }).click();
  await page.locator('[data-testid^="wizard-more-"]').first().click();
  await page.getByTestId('wizard-create').click();
  await expect(page.getByText('ใส่ชื่อจุดให้ครบทุกจุด')).toBeVisible();
  const inputs = page.locator('[data-testid^="wizard-name-"]');
  await inputs.nth(0).fill('จุด 1');
  await inputs.nth(1).fill('จุด 2');
  await inputs.nth(2).fill('จุด 3');
  await shot('e03-s03-wizard');
  await page.getByTestId('wizard-create').click();
  await expect(page.getByTestId('open-wizard')).toHaveCount(0);

  // A point in สวน ข may reuse "จุด 1"; a second "จุด 1" in สวน ก may not.
  await page.getByText('สวน ข', { exact: true }).click();
  await page.getByTestId('add-point').click();
  await page.getByTestId('point-name').fill('จุด 1');
  await page.getByTestId('point-save').click();
  await expect(page.getByTestId('property-points')).toContainText('จุด 1');
  await page.getByTestId('back').last().click();
  await page.getByText('สวน ก', { exact: true }).click();
  await page.getByTestId('add-point').click();
  await page.getByTestId('point-name').fill('จุด 1');
  await page.getByTestId('point-save').click();
  await expect(page.getByText('มีจุดชื่อ "จุด 1" ในสวนนี้แล้ว')).toBeVisible();
  await shot('e03-s03-point-duplicate');

  await context.setOffline(false);
  await page.goto('/properties');
  await expect(page.getByText('จุดชั่ง (3)')).toBeVisible();
  await expect(page.getByText('จุดชั่ง (1)')).toBeVisible();
  await shot('e03-s03-properties-with-points');
  await page.getByText('สวน ก', { exact: true }).click();
  await expect(page.getByTestId('property-points')).toContainText('จุด 3');
  await shot('e03-s03-farm-points');
});
