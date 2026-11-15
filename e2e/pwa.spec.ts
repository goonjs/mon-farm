import { expect, test } from './test';

/**
 * E01-S23 on the real web build: installable (a manifest link the browser can fetch) and, once opened
 * online, the home opens again with the network gone (PW-2) — the service worker serves the app's files.
 */
test('the web app is installable and opens again offline (E01-S23 PW-1, PW-2)', async ({ page, context }) => {
  // The v2 home is portrait-first; this spec runs in the landscape projects, so it turns the phone itself.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/v2');
  await expect(page.getByTestId('v2-home')).toBeVisible();
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = await page.evaluate(async (u) => (await fetch(u)).json(), href!);
  expect(manifest.start_url).toBe('/v2');

  // The worker takes the page; then the network goes and the app still opens.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
  // ... and has kept the app's bundle from this first visit (the page hands its loaded files over).
  await expect
    .poll(() => page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)))).flat().some((u) => u.includes('/_expo/static/'))))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('v2-home')).toBeVisible();
});
