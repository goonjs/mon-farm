import { expect, test, type Page } from '@playwright/test';

import { signedOut } from './session';

/**
 * E02-S01/S02 against the Firebase Auth emulator (Google provider,
 * simulated): sign in through the popup as a brand-new account → no farm
 * group yet, so the group start screen → create one → reload → straight
 * into that group, no login and no start screen.
 *
 * Needs a build pointed at the emulator and the emulator running, so it is
 * skipped in the default run; `npm run test:e2e:auth` does both. The SDK's
 * popup loads https://apis.google.com/js/api.js even against the emulator,
 * so the machine running it needs that host reachable.
 *
 * NOT YET SEEN TO PASS: the sandbox it was written in blocks
 * apis.google.com (proxy 403), so this spec has never run to completion.
 * Nothing else may cite it as proof of signing in until it has.
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

test('login with Google, create the first group, then reload straight into it', async ({ page }) => {
  await page.goto('/');
  const popupOpened = page.waitForEvent('popup');
  await page.getByTestId('signin-google').click();
  await chooseNewGoogleAccount(await popupOpened);

  // A new account has no farm group: only create or join (E02-S02 AC3).
  await expect(page.getByTestId('group-start')).toBeVisible();
  await expect(page.getByTestId('v2-home')).toHaveCount(0);
  await page.getByTestId('group-name').fill('สวนบ้านนา');
  await page.getByTestId('group-create').click();
  await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('v2-home').filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId('signin')).toHaveCount(0);
  await expect(page.getByTestId('group-start')).toHaveCount(0);
});
