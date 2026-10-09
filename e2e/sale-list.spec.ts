import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId } from './fixtures';
import { workedExample } from '../src/core/fixtures';

/**
 * The sale list is the app's front door now that nothing is seeded (S17).
 * These tests verify it shows only what genuinely exists in the store —
 * never a fabricated placeholder — and that both "resume" and "start new"
 * actually navigate.
 */

test('shows the empty state with no sales seeded', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('an open sale appears and resumes into the counter screen', async ({ page }) => {
  const saleId = testSaleId('list-open');
  await seedSale(page, saleId, openPileScenario(saleId, 3));
  await page.goto('/');

  const row = page.getByTestId(`sale-${saleId}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('ไร่คุณพ่อ');
  await expect(row).toContainText('เปิดอยู่'); // open, not closed

  await row.click();
  await expect(page.getByTestId('count')).toHaveText('3');
});

test('a closed sale resumes into settlement, not the counter', async ({ page }) => {
  const saleId = testSaleId('list-closed');
  await seedSale(page, saleId, workedExample(saleId));
  await page.goto('/');

  const row = page.getByTestId(`sale-${saleId}`);
  await expect(row).toContainText('ปิดแล้ว'); // closed

  await row.click();
  await expect(page.getByTestId('owner-share')).toBeVisible();
});

test('settlement has a way back to the list — and from there, to a new sale', async ({ page }) => {
  // A real gap, found from testing: after closing a sale there was no path
  // off the settlement screen except "reopen" or a browser back button —
  // no way to reach the list, and so no way to start a new sale.
  const saleId = testSaleId('list-from-settlement');
  await seedSale(page, saleId, workedExample(saleId));
  await page.goto(`/sale/${saleId}/settlement`);
  await expect(page.getByTestId('owner-share')).toBeVisible();

  await page.getByTestId('to-sale-list').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId(`sale-${saleId}`)).toBeVisible();

  await page.getByTestId('new-sale').click();
  // E04-S02: a new sale starts from master data.
  await expect(page).toHaveURL(/\/sale\/sale-[0-9a-f-]{36}\/start$/);
});

test('the old setup screen opens fresh and unrecorded', async ({ page }) => {
  // Since E04-S02 the home button opens the start screen; setup stays reachable by URL.
  await page.goto('/sale/sale-00000000-0000-7000-8000-000000000001/setup');

  // Nothing has been saved for it yet, so start-counting is disabled.
  await expect(page.getByTestId('start-counting')).toBeDisabled();

  // Nothing was written for it either — leaving without saving anything must
  // not make it appear on the list (see src/app/sale/[id]/setup.tsx's header:
  // a sale that never gets a `sale_started` event never existed as far as the
  // store is concerned).
  // Opened by URL there is no history to go back to, so leave by URL.
  await page.goto('/');
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
