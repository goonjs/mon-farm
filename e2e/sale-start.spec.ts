import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';

/**
 * E04-S01/S02: start a sale from farm master data with the network off —
 * header pre-filled, no price — pick farm → tapper → point, weigh the first
 * basket on the existing counter, and the basket carries its point and
 * number. Then the price is added later.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

const SHOTS = 'docs/ux/screenshots/overnight/farm';

async function hold(page: Page, ms: number) {
  const box = (await page.getByTestId('stage').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('offline: start → pick point → first basket numbered at its point, price later', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  };
  // Master data: a buyer, a tapper, a farm and one point assigned to her.
  await page.goto('/buyers');
  await page.getByTestId('buyer-name').fill('ล้ง ก');
  await page.getByTestId('buyer-save').click();
  await expect(page.getByText('ล้ง ก')).toBeVisible();
  await page.goto('/person/new');
  await page.getByTestId('person-name').fill('แดง');
  await page.getByTestId('role-tapper').click();
  await page.getByTestId('person-save').click();
  await expect(page.getByTestId('add-person')).toBeVisible();
  await page.goto('/property/new');
  await page.getByTestId('property-name').fill('สวน ก');
  await page.getByTestId('crop-rubber').click();
  await page.getByTestId('property-save').click();
  await expect(page.getByTestId('add-property')).toBeVisible();
  await page.getByTestId('open-wizard').click();
  await page.locator('[data-testid^="wizard-farm-"]', { hasText: 'สวน ก' }).click();
  await page.locator('[data-testid^="wizard-tapper-"]', { hasText: 'แดง' }).click();
  await page.locator('[data-testid^="wizard-name-"]').first().fill('จุด 1');
  await page.getByTestId('wizard-create').click();
  await expect(page.getByTestId('open-wizard')).toHaveCount(0);

  await page.goto('/');
  await context.setOffline(true);
  await page.getByTestId('new-sale').click();
  await expect(page.getByTestId('start-buyer')).toContainText('ล้ง ก');
  await shot('e04-s02-start');
  await page.getByTestId('start-next').click();

  await expect(page.locator('[data-testid^="pick-tapper-"]')).toContainText('แดง');
  await shot('e04-s02-pick-point');
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 1' }).click();

  // The existing counter, on the picked point: its zero/tare gate first.
  await page.getByTestId('zero-yes').click();
  await page.getByTestId('tare-input').fill('2');
  await page.getByTestId('tare-confirm').click();
  await page.getByTestId('ready-button').click();
  await expect(page.getByTestId('count')).toHaveText('0');
  await hold(page, 1100);
  await expect(page.getByTestId('count')).toHaveText('1');
  await shot('e04-s02-first-basket');

  const baskets = await page.evaluate(
    () =>
      new Promise<{ pointId?: string; basketNo?: number }[]>((res) => {
        const o = indexedDB.open('mon-farm-v1', 1);
        o.onsuccess = () => {
          const r = o.result.transaction('events').objectStore('events').getAll();
          type Stored = { event: { kind: string; pointId?: string; basketNo?: number } };
          r.onsuccess = () => res((r.result as Stored[]).map((x) => x.event).filter((e) => e.kind === 'accept'));
        };
      }),
  );
  expect(baskets).toHaveLength(1);
  expect(baskets[0].basketNo).toBe(1);
  expect(baskets[0].pointId).toBeTruthy();
});

test('zero check "first point of each farm": the 2nd point of the farm opens without asking; a skew then forces the check (E04-S03)', async ({ page }, info) => {
  // Two points of one farm, both แดง's, and the group mode set to first-per-farm.
  await page.goto('/person/new');
  await page.getByTestId('person-name').fill('แดง');
  await page.getByTestId('role-tapper').click();
  await page.getByTestId('person-save').click();
  await expect(page.getByTestId('add-person')).toBeVisible();
  await page.goto('/property/new');
  await page.getByTestId('property-name').fill('สวน ก');
  await page.getByTestId('crop-rubber').click();
  await page.getByTestId('property-save').click();
  await page.getByTestId('open-wizard').click();
  await page.locator('[data-testid^="wizard-farm-"]', { hasText: 'สวน ก' }).click();
  await page.locator('[data-testid^="wizard-tapper-"]', { hasText: 'แดง' }).click();
  await page.locator('[data-testid^="wizard-more-"]').first().click();
  await page.locator('[data-testid^="wizard-name-"]').nth(0).fill('จุด 1');
  await page.locator('[data-testid^="wizard-name-"]').nth(1).fill('จุด 2');
  await page.getByTestId('wizard-create').click();
  await expect(page.getByTestId('open-wizard')).toHaveCount(0);
  await page.goto('/sale-settings');
  await page.getByTestId('zero-first-per-farm').click();
  await expect(page.getByTestId('zero-first-per-farm')).toContainText('✓');

  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await page.getByTestId('start-next').click();
  const saleUrl = page.url().replace(/\/points.*$/, '');
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 1' }).click();
  await page.getByTestId('zero-yes').click();
  await page.getByTestId('tare-input').fill('2');
  await page.getByTestId('tare-confirm').click();
  await page.getByTestId('ready-button').click();
  await expect(page.getByTestId('count')).toHaveText('0');

  // Same farm, second point: no check asked.
  await page.goto(`${saleUrl}/points`);
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 2' }).click();
  await expect(page.getByTestId('count')).toHaveText('0');
  await expect(page.getByTestId('zero-tare-gate')).toHaveCount(0);
  if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/e04-s03-second-point-no-check.png` });
});
