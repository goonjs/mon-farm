import { expect, test } from '@playwright/test';

import { seedSale, testSaleId, unreadyPileScenario } from './fixtures';

/**
 * The pre-count wizard (F-21, FR-3). `unreadyPileScenario` seeds a genuinely
 * not-started pile — no zero check, no tare, no ready — so these tests exist
 * to prove the gate itself, not to route around it the way `openPileScenario`
 * (used by the counting tests) deliberately does.
 */

test('the stage shows the gate, not the counter, before a pile is ready', async ({ page }) => {
  const saleId = testSaleId('gate');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('zero-tare-gate')).toBeVisible();
  await expect(page.getByTestId('stage')).toHaveCount(0); // HoldStage isn't mounted yet
});

test('a failed zero check flags and continues rather than blocking', async ({ page }) => {
  const saleId = testSaleId('gate-notzero');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);

  await page.getByTestId('zero-no').click();
  await page.getByTestId('zero-reading').fill('0.3');
  await page.getByTestId('zero-flag-confirm').click();

  // Non-blocking: it moves straight to step 2, not a dead end.
  await expect(page.getByTestId('tare-input')).toBeVisible();
});

test('the full gate — zero, tare, read-back — reaches a countable pile', async ({ page }) => {
  const saleId = testSaleId('gate-full');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);

  await page.getByTestId('zero-yes').click();
  await expect(page.getByTestId('tare-input')).toBeVisible();

  await page.getByTestId('tare-input').fill('2');
  await page.getByTestId('tare-confirm').click();

  await expect(page.getByTestId('read-back')).toContainText('2');
  await expect(page.getByTestId('read-back')).toContainText('50');
  await expect(page.getByTestId('read-back')).toContainText('52');

  await page.getByTestId('ready-button').click();

  // The gate is gone; the real stage with the count is in its place.
  await expect(page.getByTestId('zero-tare-gate')).toHaveCount(0);
  await expect(page.getByTestId('count')).toHaveText('0');
  await expect(page.getByTestId('caption')).toContainText('52');
});

test('gate progress survives a reload', async ({ page }) => {
  const saleId = testSaleId('gate-reload');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);

  await page.getByTestId('zero-yes').click();
  await expect(page.getByTestId('tare-input')).toBeVisible();

  await page.reload();
  // Still on step 2 — zero_check was persisted, not lost.
  await expect(page.getByTestId('tare-input')).toBeVisible();
});
