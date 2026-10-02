import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';
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
  // Record whether the hint EVER appeared, not just its final state: a hint
  // that flashes for a frame on first paint and then vanishes is a flicker.
  await page.addInitScript(() => {
    const w = window as unknown as { hintSeen: boolean };
    w.hintSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="rotate-hint"]')) w.hintSeen = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('186');

  // E01-S13: whether three digits clear the floor depends on the face. When
  // width binds, size ÷ short edge = 1 ÷ (digits × advance), whatever the
  // phone. The old system face (0.656em) gave ~0.54 → hint. Noto Sans Thai
  // ExtraBold with tight tracking (0.538em) gives ~0.620 — on the 0.62 floor.
  // So assert the rule itself: the hint shows exactly when the measured
  // ratio is under the floor. (Finding raised: 3 digits now sit on the floor.)
  const ratio = await page.getByTestId('count').evaluate(
    (el) => parseFloat(getComputedStyle(el).fontSize) / Math.min(innerWidth, innerHeight),
  );
  const needsHint = ratio < tokens.publicNumeral.minHeightRatio;
  await expect(page.getByTestId('rotate-hint')).toHaveCount(needsHint ? 1 : 0);
  // No flicker (lead condition, 2026-10-03): if the final answer is "no
  // hint", it must never have shown at all.
  if (!needsHint) expect(await page.evaluate(() => (window as unknown as { hintSeen: boolean }).hintSeen)).toBe(false);

  // Non-blocking: the count itself must still be fully on screen, not
  // obscured or pushed out by the hint. Sub-pixel tolerance: layout engines
  // routinely report a fraction of a CSS pixel over on a flex-centred box.
  const viewport = page.viewportSize()!;
  const count = (await page.getByTestId('count').boundingBox())!;
  expect(count.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(count.y).toBeGreaterThanOrEqual(0);
});

test('a phone in portrait shows the rotate hint when the count is too small to read', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-portrait', 'phone-specific');
  // Four digits put any face well under the floor (≈0.46 with Noto Sans
  // Thai), so this keeps the hint's positive path covered now that three
  // digits sit on the floor (E01-S13).
  const saleId = testSaleId('orient-phone-4');
  await seedSale(page, saleId, openPileScenario(saleId, 1186));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('1186');
  await expect(page.getByTestId('rotate-hint')).toBeVisible();
  const viewport = page.viewportSize()!;
  const count = (await page.getByTestId('count').boundingBox())!;
  expect(count.width).toBeLessThanOrEqual(viewport.width + 1);
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
