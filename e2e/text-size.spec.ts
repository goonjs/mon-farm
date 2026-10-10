import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';
import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * E03-S08: text size S / M / L on a portrait phone. Text scales; the
 * primary action stays on screen; the public count is sized by the viewport
 * and does not follow the setting.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

for (const size of ['s', 'm', 'l'] as const) {
  test(`text size ${size.toUpperCase()}: home and counter`, async ({ page }, info) => {
    await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
    const saleId = testSaleId(`text-${size}`);
    await seedSale(page, saleId, openPileScenario(saleId, 3));

    await page.goto('/');
    const newSale = page.getByTestId('new-sale');
    await expect(newSale).toBeInViewport({ ratio: 1 });
    if (info.project.name === 'phone-landscape') {
      await page.screenshot({ path: `docs/ux/screenshots/overnight/farm/e03-s08-home-${size}.png` });
    }

    await page.goto(`/sale/${saleId}/counter`);
    const numeral = page.getByTestId('count');
    await expect(numeral).toBeVisible();
    if (info.project.name === 'phone-landscape') {
      await page.screenshot({ path: `docs/ux/screenshots/overnight/farm/e03-s08-counter-${size}.png` });
    }
  });
}

test('the public count is the same size at S and L', async ({ page }) => {
  const saleId = testSaleId('text-numeral');
  await seedSale(page, saleId, openPileScenario(saleId, 3));
  const sizeAt = async (s: string) => {
    await page.evaluate((v) => localStorage.setItem('mon-farm:text-size', v), s);
    await page.goto(`/sale/${saleId}/counter`);
    const el = page.getByTestId('count');
    await expect(el).toBeVisible();
    return el.evaluate((n) => getComputedStyle(n).fontSize);
  };
  expect(await sizeAt('s')).toBe(await sizeAt('l'));
});
