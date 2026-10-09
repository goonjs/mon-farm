import { expect, test } from '@playwright/test';

import { BASE_URL, signedIn, signedOut } from './session';

/**
 * E02-S01 without a backend: the login gate, the first-launch-offline
 * message, and reopening on a device that has signed in before while every
 * request off this origin fails. Nothing here signs in through Google: the
 * popup is written up in `auth-emulator.spec.ts`, which has not yet been
 * seen to pass (apis.google.com is blocked where it was written), so a
 * successful sign-in is so far proven only by the gate's component tests.
 */

const SHOTS = 'docs/ux/screenshots/overnight/e02';

test.describe('not signed in', () => {
  test.use({ storageState: signedOut, viewport: { width: 390, height: 844 } });

  test('only the login screen; offline, the first sign-in says it needs the internet', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByText('ครั้งแรกต้องต่ออินเทอร์เน็ต หลังจากนั้นใช้ได้แม้ไม่มีเน็ต')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/s01-login.png` });

    // A deep link to a recording screen still lands on the login screen.
    await page.goto('/settings');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    await context.setOffline(true);
    await page.getByTestId('login-google').click();
    await expect(page.getByText('ต้องต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบครั้งแรก — ต่อเน็ตแล้วกดอีกครั้ง')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/s01-login-offline.png` });
  });
});

test.describe('signed in before', () => {
  test.use({ storageState: signedIn, viewport: { width: 390, height: 844 } });

  test('reopens straight into the app with no auth backend reachable', async ({ page, context }) => {
    // Everything off this origin fails, as in airplane mode. (A reload under
    // `setOffline` cannot load the page itself — no service worker yet.)
    await context.route(
      (url) => url.origin !== BASE_URL,
      (route) => route.abort('internetdisconnected'),
    );
    await page.goto('/');
    await context.setOffline(true);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/s01-reopen-offline.png` });
  });
});
