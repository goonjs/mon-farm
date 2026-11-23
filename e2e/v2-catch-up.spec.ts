import { expect, test, type Page } from './test';

import type { MasterPayload } from '../src/core/types';
import { evidence, seedMaster } from './fixtures';
import { smallTargets, textFit } from './text-fit';

/**
 * E04-S19: arriving late and catching up from the paper, then counting on —
 * in the real web build, offline. The paper sample from the mockup: แดง
 * weighed จุด 1 (baskets 1–12, 12 short at 30 kg) then จุด 3 (12 topped up by
 * 20, 13–20 full, 21 short at 22 kg and still being weighed): 1,022 kg in 21
 * baskets. Every page is checked at 320 and 360 px with text M and L.
 * Screenshots go to docs/ only with UPDATE_SCREENSHOTS=1.
 */

const SHOTS = 'docs/ux/screenshots/v2/catch-up';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the sale flow is portrait-first'));

const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'mgr', name: 'อ.สมหวัง', roles: ['manager'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'point_added', pointId: 'a2', propertyId: 'fa', name: 'จุด 2' },
  { t: 'point_added', pointId: 'a3', propertyId: 'fa', name: 'จุด 3' },
  { t: 'point_added', pointId: 'b1', propertyId: 'fa', name: 'จุด 4' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'b1', tapperId: 'nat' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's2', pointId: 'a2', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's3', pointId: 'a3', tapperId: 'red' },
];

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });

async function intField(page: Page, field: string, keys: string) {
  const id = on(page);
  await id(field).click();
  for (const k of keys) await id(`${field}-pad-key-${k}`).click();
  await id(`${field}-pad-key-done`).click();
}
async function kgField(page: Page, field: string, keys: string) {
  const id = on(page);
  if (!(await id(`${field}-pad`).count())) await id(field).click();
  for (const k of keys) await id(`${field}-pad-key-${k}`).click();
  await id(`${field}-done`).click();
}

/** Nothing cut, nothing past the edge, every target at least 48; the page itself fits without scrolling. */
async function fits(page: Page, scroll = true) {
  expect(await textFit(page)).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  if (!scroll) {
    const ratio = await page.evaluate(() => {
      // The screen's scroll body carries the screen's testID (ScrollCue).
      const s = document.querySelector('[data-testid="catch-up"]') as HTMLElement | null;
      return s ? s.scrollHeight / s.clientHeight : document.scrollingElement!.scrollHeight / innerHeight;
    });
    expect(ratio).toBeLessThanOrEqual(1.01);
  }
}

for (const width of [320, 360]) {
  for (const size of ['m', 'l'] as const) {
    test(`E04-S19 the paper sample at ${width} px text ${size.toUpperCase()}: 1,022 kg, then counting on (offline)`, async ({ page, context }) => {
      const id = on(page);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedMaster(page, FARM);
      await page.goto('/v2');
      await context.setOffline(true);
      const shot = (name: string) => evidence(page, `${SHOTS}/${width}-${size}-${name}.png`);

      // The sale day row (BF-9): today unless picked.
      await id('home-sale-start').click();
      await expect(id('start-date')).toBeVisible();
      await id('start-date').click();
      await expect(id('start-date-picker-today')).toBeVisible();
      await fits(page);
      await shot('0-day');
      await id('start-date-picker-done').click();
      await id('start-next').click();

      // Owner 2026-11-16: from the point picker, straight into แดง's flow — no point, no empty-scale check first.
      await id('pick-farm-fa').click();
      await id('pick-backfill').click();

      // BF-1: the order of แดง's points, in paper order.
      await expect(id('cu-order')).toBeVisible();
      await id('cu-order-a1').click();
      await id('cu-order-a3').click();
      await fits(page);
      await shot('1-order');
      await id('cu-next').click();

      // BF-2/3: จุด 1, one page.
      await intField(page, 'cu-end', '12');
      await id('cu-short').click();
      await kgField(page, 'cu-short-kg', '30');
      await expect(id('cu-sum-bar')).toContainText('580');
      await fits(page, false);
      await shot('2-point');
      await id('cu-next').click();

      // BF-4: basket 12 at จุด 3.
      await expect(id('cu-topup')).toContainText('เข่ง 12');
      // Owner 2026-11-23 topup-tap-only: one tap answers and moves on; no next button.
      await expect(id('cu-fill')).toContainText('เติมให้เต็ม (+20 กก.)');
      await expect(id('cu-next')).toHaveCount(0);
      await fits(page, false);
      await shot('3-topup');
      // "เติมไม่เท่านี้" opens the kg field; it fits too. A tap on a choice still answers and moves on.
      await id('cu-fill-own').click();
      await kgField(page, 'cu-fill-kg', '20');
      await expect(id('cu-next')).toBeEnabled();
      await fits(page, false);
      await id('cu-fill').click();

      await intField(page, 'cu-end', '21');
      await id('cu-short').click();
      await kgField(page, 'cu-short-kg', '22');
      await fits(page, false);
      await shot('4-last-point');
      await id('cu-next').click();

      // BF-6/7: the summary, checked against the paper.
      await expect(id('cu-total')).toContainText('1,022');
      await kgField(page, 'cu-paper', '1022');
      await expect(id('cu-paper-check')).toContainText('ตรง');
      await fits(page);
      await shot('5-summary');
      await id('cu-save').click();

      // BF-5: counting on at จุด 3, basket 21 open with 22 kg.
      await expect(id('counter')).toBeVisible();
      await expect(id('current-short')).toContainText('22');
      await page.reload();
      await expect(id('current-short')).toContainText('22');
      await shot('6-count-on');
      expect(errors).toEqual([]);
    });
  }
}

// E04-S23: a second tapper arrives late after the first was caught up; counting on needs no scale check.
for (const width of [320, 360]) {
  test(`E04-S23 second tapper at ${width} px: catch up, count on, change point, catch up again (offline)`, async ({ page, context }) => {
    const id = on(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width, height: 844 });
    await seedMaster(page, FARM);
    await page.goto('/v2');
    await context.setOffline(true);
    await id('home-sale-start').click();
    await id('start-next').click();
    await id('pick-farm-fa').click();
    await id('pick-tapper-red').click();
    await id('pick-backfill').click();
    await id('cu-order-a1').click();
    await id('cu-next').click();
    await intField(page, 'cu-end', '4');
    await id('cu-full').click();
    await id('cu-next').click();
    await id('cu-save').click();
    // JB-3: counting on at once, no "check the scale" card.
    await expect(id('counter')).toBeVisible();
    await expect(id('not-ready')).toHaveCount(0);
    // JB-2: change point, pick the other tapper: the late link is still there.
    await id('switch-point').click();
    await id('pick-tapper-nat').click();
    await expect(id('pick-backfill')).toBeVisible();
    await fits(page);
    await evidence(page, `${SHOTS}/${width}-m-7-switch-link.png`);
    await id('pick-backfill').click();
    // นัด has one point: straight to its page (BF-13).
    await intField(page, 'cu-end', '2');
    await id('cu-full').click();
    await id('cu-next').click();
    await expect(id('cu-total')).toContainText('100');
    await id('cu-save').click();
    await expect(id('counter')).toBeVisible();
    await expect(id('not-ready')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

async function hold(page: Page) {
  const box = (await on(page)('hold').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_000);
  await page.mouse.up();
}

// E04-S26: catching up at any time, one point at a time, after counting live — numbered on, never inserted.
test('E04-S26 at 390 px: count 3 live (the last short), catch up one point, top it up, count on, catch up another (offline)', async ({ page, context }) => {
  test.setTimeout(60_000);
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await context.setOffline(true);
  const shot = (name: string) => evidence(page, `${SHOTS}/s26-390-${name}.png`);

  // แดง counts จุด 1 live: 1–2 full, 3 short (35 kg, still open).
  await id('home-sale-start').click();
  await id('start-next').click();
  await id('pick-farm-fa').click();
  await id('pick-point-a1').click();
  await id('start-weigh').click();
  await hold(page);
  await hold(page);
  await id('tool-short').click();
  await id('short-save').click();
  await expect(id('open-card')).toContainText('เข่ง 3');

  // AT-1: from the counter's ⋯ menu the catch-up opens — no "already counted live" stop.
  await id('counter-menu').click();
  await id('menu-backfill').click();
  await expect(id('cu-blocked')).toHaveCount(0);
  await expect(id('cu-order')).toBeVisible();
  // One point only: จุด 2.
  await id('cu-order-a2').click();
  await fits(page);
  await shot('1-order');
  await id('cu-next').click();

  // AT-3: basket 3 is asked about first, nothing chosen.
  await expect(id('cu-topup')).toContainText('เข่ง 3 (35 กก.) เติมที่จุดนี้ไหม');
  await expect(id('cu-next')).toHaveCount(0);
  await fits(page, false);
  await shot('2-topup');
  await id('cu-fill').click();

  // AT-2: จุด 2 starts after the last basket.
  await expect(id('cu-start')).toContainText('4');
  await intField(page, 'cu-end', '5');
  await id('cu-full').click();
  await id('cu-next').click();
  await expect(id('cu-summary')).toContainText('เข่ง 3');
  await expect(id('cu-summary')).toContainText('เข่ง 4–5');
  // Σ: the 15 kg top-up and two full baskets — the 35 kg was counted live.
  await expect(id('cu-total')).toContainText('115');
  await fits(page);
  await shot('3-summary');
  await id('cu-save').click();

  // Counting on at จุด 2: next is 6.
  await expect(id('counter')).toBeVisible();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 6$/);
  await hold(page);
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 7$/);

  // Again, one point: จุด 3 runs on from 7.
  await id('counter-menu').click();
  await id('menu-backfill').click();
  await id('cu-order-a3').click();
  await id('cu-next').click();
  await expect(id('cu-start')).toContainText('7');
  await intField(page, 'cu-end', '8');
  await id('cu-full').click();
  await id('cu-next').click();
  await expect(id('cu-total')).toContainText('100');
  await id('cu-save').click();
  await expect(id('counter')).toBeVisible();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 9$/);
  await page.reload();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 9$/);
  await shot('4-count-on');
  expect(errors).toEqual([]);
});

// E04-S26, for the owner (lead chat 2026-11-21): every screen of a backfill after counting live, in order.
const FLOW = (n: number, name: string) => `${SHOTS}/s26-flow-${n}-${name}.png`;

/** แดง counts จุด 1 live: 1–2 full, 3 short at 35 kg (still open). */
async function countThreeLive(page: Page, perPoint: boolean) {
  const id = on(page);
  await id('home-sale-start').click();
  if (perPoint) await id('start-numbering-per-point').click();
  await id('start-next').click();
  await id('pick-farm-fa').click();
  await id('pick-point-a1').click();
  await id('start-weigh').click();
  await hold(page);
  await hold(page);
  await id('tool-short').click();
  await id('short-save').click();
  await expect(id('open-card')).toContainText('เข่ง 3');
}

test('E04-S26 flow at 390 px: แดง counted 3 live (3 short 35), then backfills จุด 2 only — every screen (offline)', async ({ page, context }) => {
  test.setTimeout(60_000);
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await context.setOffline(true);
  await countThreeLive(page, false);

  await id('counter-menu').click();
  await expect(id('menu-backfill')).toBeVisible();
  await evidence(page, FLOW(1, 'menu'));
  await id('menu-backfill').click();

  await expect(id('cu-order')).toBeVisible();
  await id('cu-order-a2').click();
  await fits(page);
  await evidence(page, FLOW(2, 'order'));
  await id('cu-next').click();

  await expect(id('cu-topup')).toContainText('เข่ง 3 (35 กก.) เติมที่จุดนี้ไหม');
  // Owner 2026-11-23 topup-tap-only: two choices, one tap moves on.
  await expect(id('cu-fill')).toContainText('เติมให้เต็ม (+15 กก.)');
  await expect(id('cu-next')).toHaveCount(0);
  await fits(page, false);
  await evidence(page, FLOW(3, 'topup'));
  // The rare case: "เติมไม่เท่านี้" opens the kg pad; 15 typed by hand, then next.
  await id('cu-fill-own').click();
  await expect(id('cu-fill-kg-pad')).toBeVisible();
  await kgField(page, 'cu-fill-kg', '15');
  await fits(page, false);
  await evidence(page, `${SHOTS}/s26-flow-3b-topup-own.png`);
  await id('cu-next').click();

  await expect(id('cu-point-name')).toContainText('จุด 2');
  await expect(id('cu-start')).toContainText('4');
  await fits(page, false);
  await evidence(page, FLOW(4, 'point-end'));
  await intField(page, 'cu-end', '5');
  await expect(id('cu-full')).toBeVisible();
  await expect(id('cu-short')).toBeVisible();
  await fits(page, false);
  await evidence(page, FLOW(5, 'full-short'));
  await id('cu-full').click();
  await id('cu-next').click();

  await expect(id('cu-row-0')).toContainText('เข่ง 3 (นับเองไว้ 35) + เติมที่จุด 2 อีก 15');
  await expect(id('cu-total')).toContainText('115');
  await fits(page);
  await evidence(page, FLOW(6, 'summary'));
  await id('cu-save').click();

  await expect(id('counter')).toBeVisible();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 6$/);
  await evidence(page, FLOW(7, 'counter'));
  expect(errors).toEqual([]);
});

test('E04-S26 flow at 390 px, per point: จุด 1 counted 3 live (3 short 35), then backfilled at จุด 1 — every screen (offline)', async ({ page, context }) => {
  test.setTimeout(60_000);
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await context.setOffline(true);
  await countThreeLive(page, true);

  await id('counter-menu').click();
  await expect(id('menu-backfill')).toBeVisible();
  await evidence(page, FLOW(11, 'pp-menu'));
  await id('menu-backfill').click();
  await expect(id('cu-order')).toBeVisible();
  await id('cu-order-a1').click();
  await fits(page);
  await evidence(page, FLOW(12, 'pp-order'));
  await id('cu-next').click();

  // Per point, basket 3 is asked about at its own point (review N4).
  await expect(id('cu-topup')).toContainText('เข่ง 3 (35 กก.) เติมที่จุดนี้ไหม');
  await expect(id('cu-next')).toHaveCount(0);
  await fits(page, false);
  await evidence(page, FLOW(13, 'pp-topup'));
  await id('cu-fill').click();

  await expect(id('cu-point-name')).toContainText('จุด 1');
  await expect(id('cu-start')).toContainText('4');
  await fits(page, false);
  await evidence(page, FLOW(14, 'pp-point-end'));
  await intField(page, 'cu-end', '5');
  await expect(id('cu-full')).toBeVisible();
  await fits(page, false);
  await evidence(page, FLOW(15, 'pp-full-short'));
  await id('cu-full').click();
  await id('cu-next').click();

  await expect(id('cu-row-0')).toContainText('เข่ง 3 (นับเองไว้ 35) + เติมที่จุด 1 อีก 15');
  await expect(id('cu-total')).toContainText('115');
  await fits(page);
  await evidence(page, FLOW(16, 'pp-summary'));
  await id('cu-save').click();

  await expect(id('counter')).toBeVisible();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 6$/);
  await evidence(page, FLOW(17, 'pp-counter'));
  expect(errors).toEqual([]);
});
