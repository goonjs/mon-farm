import { expect, test } from '@playwright/test';

/**
 * E01-S13. Thai text renders in the embedded Noto Sans Thai with every
 * external host blocked — the font comes from the app bundle, the way it has
 * to at a farm with no signal. Only the local server is reachable.
 */
test('Thai text uses the embedded Noto Sans Thai with the network blocked', async ({ page, baseURL }, testInfo) => {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL!)) return route.continue();
    external.push(url);
    return route.abort();
  });

  await page.goto('/');
  const button = page.getByTestId('open-settings');
  await expect(button).toBeVisible();

  const family = await button.getByText('ตั้งค่า').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain('NotoSansThai_500Medium');
  expect(await page.evaluate(() => document.fonts.check('16px NotoSansThai_500Medium', 'ตั้งค่า'))).toBe(true);
  expect(external).toEqual([]);

  await page.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/fonts-offline.png` });
});
