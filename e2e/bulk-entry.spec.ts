import { expect, test, type Page } from '@playwright/test';

import {
  bulkParityScenario,
  closedPileScenario,
  openPileScenario,
  seedSale,
  testSaleId,
  unreadyPileScenario,
} from './fixtures';

/**
 * S23 — bulk entry for a pile nobody counted live.
 *
 * The seeded pile in `unreadyPileScenario` is genuinely `not-started`: no
 * zero check, no tare, no ready. That is the only status bulk entry is
 * offered on, and these tests exercise the form the same way the field does
 * — from the Pile tab, through the two fields and the typed reason, into the
 * log that has to say afterwards where the numbers came from.
 */

/**
 * Story evidence, not assertions — the golden path and both blocked states as
 * a human sees them.
 *
 * Phone landscape by default: the floor project re-runs every test, and
 * saving each shot twice would just be two near-identical files. `floor:
 * true` opts a shot into being taken on the 740×360 floor as well, under a
 * `-floor` suffix — worth it only where clearance is the actual question,
 * which for this story is the form itself (three fields, a summary and two
 * buttons in 360px of height).
 */
const SHOTS = 'docs/stories/screenshots/s23';
async function shot(
  page: Page,
  testInfo: { project: { name: string } },
  name: string,
  { floor = false }: { floor?: boolean } = {},
) {
  if (testInfo.project.name === 'phone-landscape') {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  } else if (floor && testInfo.project.name === 'phone-landscape-floor') {
    await page.screenshot({ path: `${SHOTS}/${name}-floor.png` });
  }
}

async function pileTab(page: Page, saleId: string) {
  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('tab-pile').click();
}

async function fillBulk(page: Page, baskets: string, leftover: string, reason: string) {
  await page.getByTestId('bulk-count').click();
  await expect(page.getByTestId('bulk-entry-form')).toBeVisible();
  if (baskets) await page.getByTestId('bulk-baskets').fill(baskets);
  if (leftover) await page.getByTestId('bulk-leftover').fill(leftover);
  if (reason) await page.getByTestId('bulk-reason').fill(reason);
}

test('bulk count is offered on a not-started pile only', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-offered');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);
  await expect(page.getByTestId('bulk-count')).toBeVisible();
  await shot(page, testInfo, '00-pile-tab-bulk-offered');
});

test('bulk count is not offered on a counting pile', async ({ page }) => {
  const saleId = testSaleId('bulk-counting');
  await seedSale(page, saleId, openPileScenario(saleId, 2));
  await pileTab(page, saleId);
  await expect(page.getByTestId('bulk-count')).toHaveCount(0);
});

test('bulk count is not offered on a closed pile', async ({ page }) => {
  const saleId = testSaleId('bulk-closed');
  await seedSale(page, saleId, closedPileScenario(saleId));
  await pileTab(page, saleId);
  await expect(page.getByTestId('bulk-count')).toHaveCount(0);
});

test('a bulk submit writes the skip, the baskets, the leftover, and closes the pile', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-golden');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);

  await page.getByTestId('bulk-count').click();
  await expect(page.getByTestId('bulk-entry-form')).toBeVisible();
  await shot(page, testInfo, '01-bulk-form-empty');
  await page.getByTestId('bulk-baskets').fill('12');
  await page.getByTestId('bulk-leftover').fill('8.4');
  await page.getByTestId('bulk-reason').fill('นับไว้ในกระดาษ ไม่ได้เปิดแอป');
  await shot(page, testInfo, '02-bulk-form-filled', { floor: true });
  await page.getByTestId('bulk-confirm').click();

  // The pile is a finished record: the closed-pile decision point, not the
  // counting stage.
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();
  await shot(page, testInfo, '03-pile-closed-after-bulk');

  await page.getByTestId('tab-log').click();
  const log = page.getByTestId('log');
  await expect(log).toContainText('นับไว้ในกระดาษ ไม่ได้เปิดแอป');
  await expect(log).toContainText('ปิดกอง');
  // 12 bulk-labelled baskets, told apart from a counted one without decoding
  // the raw event, plus exactly one leftover line.
  await expect(page.getByTestId('log').getByText('กรอกย้อนหลัง', { exact: false })).toHaveCount(12);
  await expect(log).toContainText('8.4');
  await shot(page, testInfo, '04-log-skip-bulk-baskets-leftover');

  // And the numbers landed in the pile's own totals.
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('pile-weight-breakdown')).toContainText('608.4');
  await expect(page.getByTestId('pile-bulk-badge')).toBeVisible();
  await shot(page, testInfo, '05-pile-tab-bulk-badge-and-totals');
});

test('a blank reason blocks the submit and writes nothing', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-noreason');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);

  await fillBulk(page, '12', '8.4', '');
  await page.getByTestId('bulk-confirm').click({ force: true });

  // Still on the form, nothing written.
  await expect(page.getByTestId('bulk-entry-form')).toBeVisible();
  await expect(page.getByTestId('bulk-reason-error')).toBeVisible();
  await shot(page, testInfo, '06-blocked-reason-required', { floor: true });
  await page.getByTestId('bulk-cancel').click();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).not.toContainText('กรอกย้อนหลัง');
});

test('baskets and leftover both zero is blocked before confirm', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-bothzero');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);

  await fillBulk(page, '0', '0', 'ไม่มีอะไรเลย');
  await page.getByTestId('bulk-confirm').click({ force: true });
  await expect(page.getByTestId('bulk-entry-form')).toBeVisible();
  await expect(page.getByTestId('bulk-empty-error')).toBeVisible();
  await shot(page, testInfo, '07-blocked-nothing-to-enter');
});

test('cancel leaves the pile not-started with nothing in the log', async ({ page }) => {
  const saleId = testSaleId('bulk-cancel');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);
  await fillBulk(page, '12', '8.4', 'เปลี่ยนใจ');
  await page.getByTestId('bulk-cancel').click();

  // Back to the gate — the pile never left `not-started`.
  await expect(page.getByTestId('zero-tare-gate')).toBeVisible();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).not.toContainText('กรอกย้อนหลัง');
  await expect(page.getByTestId('log')).not.toContainText('เปลี่ยนใจ');
});

test('a zero leftover writes no short line; zero baskets writes no accept lines', async ({ page }) => {
  const noLeftover = testSaleId('bulk-noleftover');
  await seedSale(page, noLeftover, unreadyPileScenario(noLeftover));
  await pileTab(page, noLeftover);
  await fillBulk(page, '3', '0', 'ไม่มีเศษ');
  await page.getByTestId('bulk-confirm').click();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log').getByText('กรอกย้อนหลัง', { exact: false })).toHaveCount(3);
  await expect(page.getByTestId('log')).not.toContainText('เข่งไม่เต็ม');

  const allLeftover = testSaleId('bulk-allleftover');
  await seedSale(page, allLeftover, unreadyPileScenario(allLeftover));
  await pileTab(page, allLeftover);
  await fillBulk(page, '0', '20', 'เหลือกองเดียว');
  await page.getByTestId('bulk-confirm').click();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('เข่งไม่เต็ม');
  await expect(page.getByTestId('log').getByText('กรอกย้อนหลัง', { exact: false })).toHaveCount(0);
});

test('a bulk pile and a live pile carrying the same numbers total identically', async ({ page }) => {
  const saleId = testSaleId('bulk-parity');
  await seedSale(page, saleId, bulkParityScenario(saleId));
  await pileTab(page, saleId);

  await fillBulk(page, '12', '8.4', 'นับไว้ในกระดาษ');
  await page.getByTestId('bulk-confirm').click();

  await page.getByTestId('tab-pile').click();
  const bulkTotal = await page.getByTestId('pile-weight-breakdown').textContent();

  // The same twelve baskets and the same leftover, counted live into กอง 2.
  await page.getByTestId('open-switcher').click();
  await page.getByTestId('switcher-pile-p2').click();
  await page.getByTestId('tab-pile').click();
  expect(await page.getByTestId('pile-weight-breakdown').textContent()).toBe(bulkTotal);
});

test('a bulk pile carries a marker in the switcher, apart from an ordinary close', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-marker');
  await seedSale(page, saleId, bulkParityScenario(saleId));
  await pileTab(page, saleId);
  await fillBulk(page, '4', '0', 'นับไว้ในกระดาษ');
  await page.getByTestId('bulk-confirm').click();

  await page.getByTestId('open-switcher').click();
  await expect(page.getByTestId('switcher-pile-p1')).toContainText('กรอกย้อนหลัง');
  // p2 was closed the ordinary way, after live counting.
  await expect(page.getByTestId('switcher-pile-p2')).not.toContainText('กรอกย้อนหลัง');
  await shot(page, testInfo, '08-switcher-bulk-marker');
});

test('a reopened bulk pile counts live, both kinds of basket in one log', async ({ page }, testInfo) => {
  const saleId = testSaleId('bulk-reopen');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);
  await fillBulk(page, '2', '0', 'นับไว้ในกระดาษ');
  await page.getByTestId('bulk-confirm').click();

  await page.getByTestId('tab-pile').click();
  await page.getByTestId('reopen-pile').click();
  await page.getByTestId('reopen-prompt-reason').fill('ตกไปเข่งหนึ่ง');
  await page.getByTestId('reopen-prompt-next').click();
  await page.getByTestId('reopen-prompt-confirm').click();

  // Back to counting, with no gate in the way — one live basket on top.
  await page.goto(`/sale/${saleId}/counter?holdMs=400`);
  await expect(page.getByTestId('stage')).toBeVisible();
  const box = (await page.getByTestId('stage').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.getByTestId('count')).toHaveText('3');

  await page.getByTestId('tab-log').click();
  // Two bulk-labelled baskets and one plain one, side by side in one log.
  await expect(page.getByTestId('log').getByText('กรอกย้อนหลัง', { exact: false })).toHaveCount(2);
  await expect(page.getByTestId('log').getByText('เข่งมาตรฐาน 50 กก.', { exact: true })).toHaveCount(1);
  await shot(page, testInfo, '09-reopened-bulk-and-live-in-one-log');
});

test('switching pile closes the bulk form — coming back shows the gate, not the form', async ({ page }) => {
  const saleId = testSaleId('bulk-switch');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await pileTab(page, saleId);

  // Open the form on กอง 1, then walk away to กอง 2 without confirming.
  await fillBulk(page, '12', '8.4', 'นับไว้ในกระดาษ');
  await page.getByTestId('open-switcher').click();
  await page.getByTestId('switcher-pile-p2').click();
  await expect(page.getByTestId('zero-tare-gate')).toBeVisible();

  // Coming back to กอง 1 must show its own gate — the bulk form is a thing
  // the operator opened for one pile, not a mode the screen stays in.
  await page.getByTestId('open-switcher').click();
  await page.getByTestId('switcher-pile-p1').click();
  await expect(page.getByTestId('zero-tare-gate')).toBeVisible();
  await expect(page.getByTestId('bulk-entry-form')).toHaveCount(0);
});
