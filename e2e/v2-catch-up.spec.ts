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
      await id('cu-fill').click();
      await fits(page, false);
      await shot('3-topup');
      await id('cu-next').click();

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
