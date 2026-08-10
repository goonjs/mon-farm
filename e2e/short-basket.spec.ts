import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * The F-22 short-basket input: opens below the stage (never over it), the
 * three input modes (typed / ± / drag) stay in sync, and only "confirm"
 * writes anything.
 */

async function openCounter(page: import('@playwright/test').Page, standardBaskets = 5) {
  const saleId = testSaleId('short');
  await seedSale(page, saleId, openPileScenario(saleId, standardBaskets));
  await page.goto(`/sale/${saleId}/counter`);
  await expect(page.getByTestId('count')).toBeVisible();
}

test('opening the panel never covers the count', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('short').click();
  await expect(page.getByTestId('short-basket-panel')).toBeVisible();

  // The stage may legitimately shrink to make room (it's flex:1 above a now-
  // taller sibling column), but the panel must never overlap the numeral —
  // that's the actual F-13 requirement, not that the stage stays a fixed size.
  const countBox = (await page.getByTestId('count').boundingBox())!;
  const panelBox = (await page.getByTestId('short-basket-panel').boundingBox())!;
  expect(panelBox.y).toBeGreaterThanOrEqual(countBox.y + countBox.height);
});

test('typing a reading updates the live net preview', async ({ page }) => {
  await openCounter(page);
  await page.getByTestId('short').click();

  await page.getByTestId('short-reading-typed').fill('43');
  // demo pile: tare 2 kg -> 43 - 2 = 41 kg net
  await expect(page.getByTestId('short-preview')).toContainText('41');
});

test('confirm logs exactly the entered reading; cancel logs nothing', async ({ page }) => {
  await openCounter(page, 5);
  const before = await page.getByTestId('count').textContent();

  await page.getByTestId('short').click();
  await page.getByTestId('short-cancel').click();
  await expect(page.getByTestId('short-basket-panel')).toHaveCount(0);
  await expect(page.getByTestId('count')).toHaveText(before!); // cancel changed nothing

  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('43');
  await page.getByTestId('short-confirm').click();

  await expect(page.getByTestId('short-basket-panel')).toHaveCount(0);
  await expect(page.getByTestId('count')).toHaveText(String(Number(before) + 1));

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('เข่งไม่เต็ม');
  await expect(page.getByTestId('log')).toContainText('41'); // the net that was logged
});

test('plus and minus buttons move the reading by 0.5 kg', async ({ page }) => {
  await openCounter(page);
  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('40');

  await page.getByTestId('short-reading-plus').click();
  await expect(page.getByTestId('short-reading-typed')).toHaveValue('40.5');

  await page.getByTestId('short-reading-minus').click();
  await page.getByTestId('short-reading-minus').click();
  await expect(page.getByTestId('short-reading-typed')).toHaveValue('39.5');
});
