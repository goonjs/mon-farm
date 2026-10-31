import { expect, test, type Page } from '@playwright/test';

import { evidence } from './fixtures';

/**
 * E01-S19 DS-2 on the real web build: every device setting on the device
 * screen survives a reload, under the localStorage keys it always used, and a
 * value saved before the update is read as it was. Android (DS-3) needs a
 * device or emulator and is not covered here.
 */

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the device screen is portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

const checked = (page: Page, id: string) => expect(page.getByTestId(id)).toHaveAttribute('aria-checked', 'true');

test('device settings survive a reload under the same keys', async ({ page }) => {
  await page.goto('/v2/device');
  await page.getByTestId('device-count-mode-tap').click();
  await page.getByTestId('device-weigh-mode-dial').click();
  await page.getByTestId('device-speech-off').click();
  await page.getByTestId('device-era-ce').click();
  await page.getByTestId('device-language-en').click();
  await checked(page, 'device-language-en');

  await page.reload();
  for (const id of ['device-count-mode-tap', 'device-weigh-mode-dial', 'device-speech-off', 'device-era-ce', 'device-language-en']) {
    await checked(page, id);
  }
  const stored = await page.evaluate(() =>
    Object.fromEntries(
      ['mon-farm:count-mode', 'mon-farm:weigh-mode', 'mon-farm:speech-on', 'mon-farm:era', 'mon-farm:locale'].map((k) => [k, localStorage.getItem(k)]),
    ),
  );
  expect(stored).toEqual({
    'mon-farm:count-mode': 'tap',
    'mon-farm:weigh-mode': 'dial',
    'mon-farm:speech-on': 'false',
    'mon-farm:era': 'ce',
    'mon-farm:locale': 'en',
  });
  await evidence(page, 'docs/ux/screenshots/e01-s19/web-after-reload.png');
});

test('a hold time saved before the update is still read', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('mon-farm:hold-ms', '900');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/v2/device');
  await expect(page.getByText('0.9', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('0.9', { exact: true })).toBeVisible();
});
