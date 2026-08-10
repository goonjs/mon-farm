import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';
import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * Verifies the three things no other test tier can:
 *   1. the exported build boots at all
 *   2. the public numeral actually fills the stage — a measurement, and the
 *      constraint the whole cross-check rests on (F-9.7)
 *   3. real pointer press-and-hold through the react-native-web pointer path
 *
 * The hold is shortened via ?holdMs= on web only. Twelve real three-second
 * holds is 36s of wall clock per run and grows with every story.
 *
 * There is no app-side seed any more (S17). Every test seeds its own sale
 * directly into localStorage via `seedSale`, using the app's own event types
 * from `src/core/fixtures.ts` — so a change to the event shape breaks these
 * tests loudly instead of them silently testing something stale.
 */

/**
 * Shortened, but not arbitrarily. Below roughly 100ms the press window becomes
 * comparable to React's render-and-dispatch latency, and holds start missing
 * their own timer — a flaky test that looks like a product bug. 400ms is
 * comfortably clear of that.
 */
const FAST_HOLD = 400;
const SHOTS = 'docs/ux/screenshots';

/**
 * Seeds a fresh sale with `standardBaskets` already counted into its one
 * ready pile, and navigates to its counter screen.
 *
 * Do NOT clear storage in an addInitScript that reruns on reload — `seedSale`
 * is already idempotent for exactly that reason (see its own header).
 */
async function openCounter(page: Page, standardBaskets = 0, holdMs = FAST_HOLD) {
  const saleId = testSaleId('counter');
  await seedSale(page, saleId, openPileScenario(saleId, standardBaskets));
  await page.goto(`/sale/${saleId}/counter?holdMs=${holdMs}`);
  await expect(page.getByTestId('count')).toBeVisible();
  return { count: page.getByTestId('count'), saleId };
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
  const { count } = await openCounter(page, 5);
  await expect(count).toHaveText('5');
  await expect(page.getByTestId('crumb')).toContainText('กอง 1');
});

test('the public numeral fills its share of the viewport (F-9.7)', async ({ page }) => {
  const viewport = page.viewportSize()!;
  const floor = tokens.publicNumeral.minHeightRatio;

  // Two digits.
  const { count: at2count } = await openCounter(page, 5);
  const at2 = (await at2count.boundingBox())!;
  expect(at2.height / viewport.height).toBeGreaterThanOrEqual(floor);

  // Three digits is the binding case — where a naive layout starts shrinking
  // the glyph to fit, silently giving back the millimetres the cross-check
  // depends on. Seeded directly at 186 rather than counted up to: the state
  // under test is the layout, not the interactions needed to reach it.
  const { count: at3count } = await openCounter(page, 186);
  await expect(at3count).toHaveText('186');
  const at3 = (await at3count.boundingBox())!;

  expect(at3.height / viewport.height).toBeGreaterThanOrEqual(floor);
  // And it must not have wrapped or spilled out of the viewport.
  expect(at3.width).toBeLessThanOrEqual(viewport.width);
});

test('a completed hold counts exactly one basket', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await expect(count).toHaveText('5');
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');
});

test('an early release counts nothing and says so', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, Math.round(FAST_HOLD / 4));
  await expect(count).toHaveText('5');
  await expect(page.getByTestId('caption')).toContainText('ไม่นับ');
});

test('a hold cancelled by the pointer leaving does not become a phantom count', async ({ page }) => {
  // react-native-web does not reliably fire onPressOut when the pointer leaves
  // while held. If cancellation missed that path, the hold would complete on
  // its timer and count a basket nobody performed.
  const { count } = await openCounter(page, 5);
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40); // out of the stage
  await page.waitForTimeout(FAST_HOLD + 250);
  await page.mouse.up();

  await expect(count).toHaveText('5');
});

test('undo removes the last basket without erasing the record', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');

  await page.getByTestId('undo').click();
  await expect(count).toHaveText('5');

  // The void and its target are both still in the log.
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('ยกเลิก');
});

test('the count stays visible when another tab is active (F-19)', async ({ page }) => {
  await openCounter(page, 5);
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('mini-count')).toContainText('5');
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('mini-count')).toContainText('5');
});

test('counts survive a reload (NFR-1)', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, FAST_HOLD + 150);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('7');

  await page.reload();
  await expect(page.getByTestId('count')).toHaveText('7');
});

test('screenshots — counter, pile, log', async ({ page }, testInfo) => {
  const dir = `${SHOTS}/${testInfo.project.name}`;
  await openCounter(page, 5);
  await page.screenshot({ path: `${dir}/counter-count.png` });
  await page.getByTestId('tab-pile').click();
  await page.screenshot({ path: `${dir}/counter-pile.png` });
  await page.getByTestId('tab-log').click();
  await page.screenshot({ path: `${dir}/counter-log.png` });
});
