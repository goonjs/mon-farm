import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * E01-S04 (SYNC-10): deleting a sale hides it — it is not gone. It stays
 * hidden across a reload, shows under "deleted", and restores intact.
 */
test('delete a sale, reload, find it under deleted, restore it intact', async ({ page }) => {
  const saleId = testSaleId('soft-delete');
  await seedSale(page, saleId, openPileScenario(saleId, 3));
  await page.goto('/');
  const row = page.getByTestId(`sale-${saleId}`);
  await expect(row).toBeVisible();

  // Two steps: delete, then confirm. Keeping it is the default.
  await page.getByTestId(`delete-${saleId}`).click();
  await page.getByTestId(`delete-cancel-${saleId}`).click();
  await expect(row).toBeVisible();
  await page.getByTestId(`delete-${saleId}`).click();
  await page.screenshot({ path: 'docs/stories/screenshots/e01-s04/delete-confirm.png' });
  await page.getByTestId(`delete-confirm-${saleId}`).click();
  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId(`sale-${saleId}`)).toHaveCount(0);

  await page.getByTestId('open-deleted').click();
  await expect(page.getByTestId(`deleted-${saleId}`)).toBeVisible();
  await page.screenshot({ path: 'docs/stories/screenshots/e01-s04/deleted-list.png' });
  await page.getByTestId(`restore-${saleId}`).click();
  await expect(page.getByTestId('deleted-empty')).toBeVisible();

  await page.getByTestId('deleted-back').click();
  await page.getByTestId(`sale-${saleId}`).click();
  await expect(page.getByTestId('count')).toHaveText('3');
});
