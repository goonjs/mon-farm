import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';

/**
 * Verifies the three things no other test tier can:
 *   1. the exported build boots at all
 *   2. the public numeral actually fills the stage — a measurement, and the
 *      constraint the whole cross-check rests on (F-9.7)
 *   3. real pointer press-and-hold through the react-native-web pointer path
 *
 * The hold is shortened via ?holdMs= on web only. Twelve real three-second
 * holds is 36s of wall clock per run and grows with every story.
 */

/**
 * Shortened, but not arbitrarily. Below roughly 100ms the press window becomes
 * comparable to React's render-and-dispatch latency, and holds start missing
 * their own timer — a flaky test that looks like a product bug. 400ms is
 * comfortably clear of that; 120ms (used for the digit-growth test, which needs
 * 58 of them) is the practical floor.
 */
const FAST_HOLD = 400;
const SHOTS = 'docs/ux/screenshots';

/**
 * Playwright already gives each test a fresh browser context, so localStorage
 * starts empty and the demo seed writes itself once.
 *
 * Do NOT clear storage in an addInitScript here: init scripts run on every
 * navigation, including reloads, which silently wipes the very state the
 * persistence test is trying to prove survived.
 */
async function openCounter(page: Page, holdMs = FAST_HOLD) {
  await page.goto(`/?holdMs=${holdMs}`);
  await expect(page.getByTestId('count')).toBeVisible();
  return page.getByTestId('count');
}

async function hold(page: Page, ms: number) {
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('the exported build boots and shows the seeded count', async ({ page }) => {
  const count = await openCounter(page);
  // 41 standard + 1 short from the demo seed.
  await expect(count).toHaveText('42');
  await expect(page.getByTestId('crumb')).toContainText('กอง 1');
});

test('the public numeral fills its share of the viewport (F-9.7)', async ({ page }) => {
  const viewport = page.viewportSize()!;
  const floor = tokens.publicNumeral.minHeightRatio;

  // Two digits.
  const count = await openCounter(page);
  const at2 = (await count.boundingBox())!;
  expect(at2.height / viewport.height).toBeGreaterThanOrEqual(floor);

  // Three digits is the binding case — where a naive layout starts shrinking
  // the glyph to fit, silently giving back the millimetres the cross-check
  // depends on. Seeded directly rather than counted up to: the state under
  // test is the layout, not the sixty interactions needed to reach it.
  // The provider seeds only into an empty store, so the sale written above has
  // to go before a differently-sized one can take its place.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/?baskets=186');
  await expect(page.getByTestId('count')).toHaveText('187');
  const at3 = (await page.getByTestId('count').boundingBox())!;

  expect(at3.height / viewport.height).toBeGreaterThanOrEqual(floor);
  // And it must not have wrapped or spilled out of the viewport.
  expect(at3.width).toBeLessThanOrEqual(viewport.width);
});

test('a completed hold counts exactly one basket', async ({ page }) => {
  const count = await openCounter(page);
  await expect(count).toHaveText('42');
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('43');
});

test('an early release counts nothing and says so', async ({ page }) => {
  const count = await openCounter(page);
  await hold(page, Math.round(FAST_HOLD / 4));
  await expect(count).toHaveText('42');
  await expect(page.getByTestId('caption')).toContainText('ไม่นับ');
});

test('a hold cancelled by the pointer leaving does not become a phantom count', async ({ page }) => {
  // react-native-web does not reliably fire onPressOut when the pointer leaves
  // while held. If cancellation missed that path, the hold would complete on
  // its timer and count a basket nobody performed.
  const count = await openCounter(page);
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40); // out of the stage
  await page.waitForTimeout(FAST_HOLD + 250);
  await page.mouse.up();

  await expect(count).toHaveText('42');
});

test('undo removes the last basket without erasing the record', async ({ page }) => {
  const count = await openCounter(page);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('43');

  await page.getByTestId('undo').click();
  await expect(count).toHaveText('42');

  // The void and its target are both still in the log.
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('ยกเลิก');
});

test('the count stays visible when another tab is active (F-19)', async ({ page }) => {
  await openCounter(page);
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('mini-count')).toContainText('42');
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('mini-count')).toContainText('42');
});

test('counts survive a reload (NFR-1)', async ({ page }) => {
  const count = await openCounter(page);
  await hold(page, FAST_HOLD + 150);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('44');

  await page.reload();
  await expect(page.getByTestId('count')).toHaveText('44');
});

test('screenshots — counter, pile, log', async ({ page }, testInfo) => {
  const dir = `${SHOTS}/${testInfo.project.name}`;
  await openCounter(page);
  await page.screenshot({ path: `${dir}/counter-count.png` });
  await page.getByTestId('tab-pile').click();
  await page.screenshot({ path: `${dir}/counter-pile.png` });
  await page.getByTestId('tab-log').click();
  await page.screenshot({ path: `${dir}/counter-log.png` });
});
