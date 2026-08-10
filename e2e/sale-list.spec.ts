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

test('starting a new sale navigates to a fresh, unrecorded setup screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-sale').click();

  await expect(page).toHaveURL(/\/sale\/sale-[a-z0-9]+\/setup$/);
  await expect(page.getByTestId('setup-stub-note')).toBeVisible();

  // Nothing was written for it — going back to the list must not show it.
  await page.getByText(/กลับไปรายการ/).click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
