import { expect, test } from '@playwright/test';

/**
 * The settlement figures are checked against a hand calculation in
 * `src/core/settle.test.ts` and against the design document in
 * `docs/ux/mvp-screens.html`. What this tier adds is that the numbers actually
 * reach the screen, and that the per-zone rows visibly add up — because that
 * addition happening in front of a buyer is the entire trust mechanism.
 */

test('settlement renders the derivation and each side’s share', async ({ page }, testInfo) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('count')).toBeVisible();

  await page.getByTestId('to-settlement').click();
  await expect(page.getByTestId('owner-share')).toBeVisible();

  // Demo seed: 41 standard × 50 kg + one short (43 − 2 = 41 kg) = 2,091 kg,
  // in zone A, which has no contract of its own — the 60% sale default
  // applies. 2,091 × ฿26.50 = ฿55,411.50 · owner 60% = ฿33,246.90 · zone A's
  // worker share (40%) = ฿22,164.60. Owner total equals zone A's owner share
  // here because it is the only zone with any baskets in it.
  await expect(page.getByTestId('step-net-weight')).toContainText('2,091');
  await expect(page.getByTestId('step-gross')).toContainText('55,411.50');
  await expect(page.getByTestId('owner-share')).toContainText('33,246.90');
  await expect(page.getByTestId('zone-zA')).toContainText('22,164.60');

  await page.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/settlement.png` });
});

test('every step of the money chain is shown, not just the total (FR-7.4)', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByTestId('to-settlement').click();

  for (const key of ['baskets', 'standard-weight', 'short-weight', 'net-weight', 'price', 'gross']) {
    await expect(page.getByTestId(`step-${key}`)).toBeVisible();
  }
});

test('per-zone rows are present for every zone in the sale', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByTestId('to-settlement').click();

  await expect(page.getByTestId('zone-zA')).toContainText('โซน A');
  await expect(page.getByTestId('zone-zB')).toContainText('โซน B');
});
