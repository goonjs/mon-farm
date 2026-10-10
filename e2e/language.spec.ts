import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId, unreadyPileScenario } from './fixtures';

/**
 * S24. The language switch, and the three properties that make it safe.
 *
 * Deliberately at this tier rather than the component tier: what is being
 * verified is that a preference written on one screen survives a reload and
 * reaches every other screen. Testing Library mounts one component with a
 * provider handed to it, so it cannot see any of that — it would be asserting
 * that the provider it was given works, which is not the claim.
 */

test('opens in Thai with no stored preference', async ({ page }) => {
  await page.goto('/');
  // Not `toContainText('sales')` inverted — assert the Thai is actually there,
  // so a blank render cannot pass by failing to contain English.
  // Settings live in the ☰ menu since E01-S17 (v1.1.0 farm screen 1).
  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('open-settings')).toHaveText('ตั้งค่า');
});

test('switching to English changes the screen, and back again', async ({ page }, testInfo) => {
  await page.goto('/settings');
  await expect(page.getByTestId('settings-back')).toHaveAccessibleName('รายการ');

  await page.getByTestId('language-en').click();
  await expect(page.getByTestId('settings-back')).toHaveAccessibleName('list');

  await page.getByTestId('language-th').click();
  await expect(page.getByTestId('settings-back')).toHaveAccessibleName('รายการ');

  await page.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/settings.png` });
});

test('the choice survives a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('language-en').click();
  await expect(page.getByTestId('settings-back')).toHaveAccessibleName('list');

  await page.reload();
  await expect(page.getByTestId('settings-back')).toHaveAccessibleName('list');

  // And it is the whole app, not just the screen it was set on.
  await page.goto('/');
  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('open-settings')).toHaveText('settings');
});

/**
 * FR-11.12. The spoken register does not follow the UI locale — see the note
 * at the foot of src/i18n/messages.ts. Nothing speaks yet (S10), so what is
 * checkable today is the on-screen quotation of the spoken phrase: the gate's
 * ready button says พร้อมค่ะ in English too.
 */
test('the spoken phrase stays Thai when the UI is English', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('language-en').click();

  const saleId = testSaleId('lang-gate');
  // unready, not open: the gate is the point, and openPileScenario has
  // already walked through it.
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);

  // Step through the gate to the read-back, where the phrase is quoted.
  await page.getByTestId('zero-yes').click();
  await page.getByTestId('tare-confirm').click();

  const ready = page.getByTestId('ready-button');
  await expect(ready).toContainText('พร้อมค่ะ');
  // The half that is a label, not a quotation, did translate.
  await expect(ready).toContainText('start counting');
});

/**
 * The counter is a working screen. A control touched once ever does not belong
 * on the bar next to ปิดกอง — see the header of src/app/settings.tsx.
 */
test('the language switch is not on the counter screen', async ({ page }) => {
  const saleId = testSaleId('lang-absent');
  await seedSale(page, saleId, openPileScenario(saleId, 3));
  await page.goto(`/sale/${saleId}/counter`);

  await expect(page.getByTestId('count')).toHaveText('3');
  await expect(page.getByTestId('language-th')).toHaveCount(0);
  await expect(page.getByTestId('language-en')).toHaveCount(0);
});
