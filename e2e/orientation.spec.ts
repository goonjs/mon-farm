import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * Orientation (S19). Only runs on `phone-portrait` and `tablet-portrait` —
 * see playwright.config.ts for why the rest of the suite doesn't also run
 * here.
 *
 * The rotate hint is driven by a measurement (fontSize vs. the device's short
 * edge — see HoldStage.tsx), not by an orientation or digit-count check. These
 * tests verify the observable OUTCOME of that measurement: the hint appears
 * exactly where the physical constraint says it must, and nowhere else.
 */

test('a phone in portrait shows no rotate hint at two digits', async ({ page }) => {
  const saleId = testSaleId('orient-phone-2');
  await seedSale(page, saleId, openPileScenario(saleId, 5));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('5');
  await expect(page.getByTestId('rotate-hint')).toHaveCount(0);
});

test('a phone in portrait shows the rotate hint past two digits, without covering the count', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-portrait', 'phone-specific — see tablet test below');

  const saleId = testSaleId('orient-phone-3');
  await seedSale(page, saleId, openPileScenario(saleId, 186));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('186');
  await expect(page.getByTestId('rotate-hint')).toBeVisible();

  // Non-blocking: the count itself must still be fully on screen, not
  // obscured or pushed out by the hint. Sub-pixel tolerance: layout engines
  // routinely report a fraction of a CSS pixel over on a flex-centred box.
  const viewport = page.viewportSize()!;
  const count = (await page.getByTestId('count').boundingBox())!;
  expect(count.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(count.y).toBeGreaterThanOrEqual(0);
});

test('a tablet in portrait needs no rotate hint even at three digits', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-portrait', 'tablet-specific — see phone test above');

  const saleId = testSaleId('orient-tablet-3');
  await seedSale(page, saleId, openPileScenario(saleId, 186));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('186');
  await expect(page.getByTestId('rotate-hint')).toHaveCount(0);

  // Not the phone's minHeightRatio — that floor is calibrated to phone
  // points-per-mm density and does not carry over to a tablet's (see the note
  // on tokens.publicNumeral.minHeightRatio). What's checkable here without a
  // real device is that the glyph is substantial relative to the viewport and
  // fully on screen, not that it clears a ratio meant for a different class
  // of device.
  const viewport = page.viewportSize()!;
  const count = (await page.getByTestId('count').boundingBox())!;
  expect(count.height / viewport.height).toBeGreaterThan(0.3);
  expect(count.width).toBeLessThanOrEqual(viewport.width + 2);
});

test('the sale list and settlement screens hold their layout in portrait', async ({ page }, testInfo) => {
  const saleId = testSaleId('orient-list');
  await seedSale(page, saleId, openPileScenario(saleId, 3));
  await page.goto('/');

  const viewport = page.viewportSize()!;
  await expect(page.getByTestId(`sale-${saleId}`)).toBeVisible();
  // No horizontal overflow — a row wider than the viewport is the classic
  // landscape-only-layout regression.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);

  await page.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/sale-list.png` });
});
