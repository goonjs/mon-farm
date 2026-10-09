import { expect, test, type Page } from '@playwright/test';

import { signedOut } from './session';

/**
 * E02-S01 against the Firebase Auth emulator (Google provider, simulated):
 * sign in through the popup → the app → reload → still in.
 *
 * Needs a build pointed at the emulator and the emulator running, so it is
 * skipped in the default run; `npm run test:e2e:auth` does both. The SDK's
 * popup loads https://apis.google.com/js/api.js even against the emulator,
 * so the machine running it needs that host reachable.
 */

test.skip(!process.env.E2E_AUTH_EMULATOR, 'needs the Auth emulator: npm run test:e2e:auth');
test.use({ storageState: signedOut, viewport: { width: 390, height: 844 } });

/** Drives the emulator's stand-in for Google's account chooser. */
async function chooseNewGoogleAccount(popup: Page) {
  await popup.locator('#add-account-button button').click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#display-name-input').fill('สมชาย ใจดี');
  await popup.locator('#sign-in').click();
}

test('login with Google through the popup, then reload without logging in again', async ({ page }) => {
  await page.goto('/');
  const popupOpened = page.waitForEvent('popup');
  await page.getByTestId('login-google').click();
  await chooseNewGoogleAccount(await popupOpened);
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('login-screen')).toHaveCount(0);
});
