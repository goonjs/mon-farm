import { expect, test, type Page } from './test';

import type { MasterPayload } from '../src/core/types';
import { evidence, seedMaster } from './fixtures';
import { smallTargets, textFit } from './text-fit';

/**
 * E15-S01: getting ready for the next sale (owner 2026-11-17 "ก · ก · โอเค ทำตามนี้"), in the real web build,
 * offline. From home: the buyer on a full page, the day then a time, the agreed price on the app pad; with no
 * fertilizer left to split the page says ✓ พร้อมขาย and so does home. Checked at 320 and 360 px with text M and L.
 * Screenshots go to docs/ only with UPDATE_SCREENSHOTS=1.
 */

const SHOTS = 'docs/ux/screenshots/v2/prepare';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));

const FARM: MasterPayload[] = [
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'buyer_added', buyerId: 'buyer-b', name: 'สหกรณ์บ้านนา' },
];

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });

/** Nothing cut, nothing past the edge, every target at least 48; the page fits one screen. */
async function fits(page: Page, screenId?: string) {
  expect(await textFit(page)).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  if (screenId) {
    const ratio = await page.evaluate((sid) => {
      const s = document.querySelector(`[data-testid="${sid}"]`) as HTMLElement | null;
      return s ? s.scrollHeight / innerHeight : 0;
    }, screenId);
    expect(ratio).toBeLessThanOrEqual(1.01);
  }
}

for (const width of [320, 360]) {
  for (const size of ['m', 'l'] as const) {
    test(`E15-S01 prepare the next sale at ${width} px text ${size.toUpperCase()} (offline)`, async ({ page, context }) => {
      const id = on(page);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedMaster(page, FARM);
      await page.goto('/v2');
      await context.setOffline(true);
      const shot = (name: string) => evidence(page, `${SHOTS}/${width}-${size}-${name}.png`);

      // PREP-1: nothing prepared yet.
      await expect(id('home-prep')).toHaveCount(0);
      await expect(id('home-prepare-badge')).toHaveCount(0);
      await id('home-prepare').click();
      await expect(id('prep')).toBeVisible();
      await fits(page, 'prep');
      await shot('1-empty');

      // PREP-3: the buyer, on a full page.
      await id('prep-buyer').click();
      await expect(id('prep-buyers')).toBeVisible();
      await fits(page);
      await shot('2-buyer');
      await expect(id('prep-buyer-buyer-b')).toHaveAttribute('role', 'checkbox');
      await id('prep-buyer-buyer-b').click();
      await expect(id('prep-buyer')).toContainText('สหกรณ์บ้านนา');

      // PREP-4: a day on the in-app calendar, then a time.
      await id('prep-date').click();
      await expect(id('prep-date-picker-yesterday')).toHaveCount(0);
      await shot('2b-date');
      await id('prep-date-picker-tomorrow').click();
      await id('prep-date-picker-done').click();
      await expect(id('prep-time')).toBeVisible();
      await fits(page);
      await id('prep-time-08:00').click();
      await expect(id('prep-date')).toContainText('08:00');

      // PREP-5: the agreed price on the app pad.
      await id('prep-price').click();
      for (const k of '52.50') await id(`prep-price-input-pad-key-${k}`).click();
      await id('prep-price-input-done').click();
      await expect(id('prep-price')).toContainText('52.50');

      // All four: no fertilizer left to split here.
      await expect(id('prep-ready')).toBeVisible();
      await fits(page, 'prep');
      await shot('3-ready');

      // เสร็จ goes back home; the tile says so and it stays after a reload.
      await id('prep-done').click();
      await expect(id('home-prepare-badge')).toHaveAttribute('aria-label', 'ครบแล้ว');
      await expect(id('home-sale-start-badge')).toHaveAttribute('aria-label', 'รอเริ่มขาย');
      await page.reload();
      await expect(id('home-prepare-badge')).toHaveAttribute('aria-label', 'ครบแล้ว');
      await fits(page);
      await shot('4-home');
      expect(errors).toEqual([]);
    });
  }
}

/**
 * E15-S02: the start-sale page takes the buyer and the price from the prep (owner 2026-11-18 03:01 "ก · ก · ตกลง AC ตาม
 * mockup A–D เริ่มเขียนโค้ดได้ (แนะนำ)"), offline, in the real build. A: a prep with no day fills at once, the price is
 * still editable, ถัดไป goes on to the point page and home no longer shows the prep. B: a prep for a later day asks first.
 */
const START_SHOTS = 'docs/ux/screenshots/v2/prepare/start';

async function prepareBuyerAndPrice(page: Page, withDay: boolean) {
  const id = on(page);
  await id('home-prepare').click();
  await id('prep-buyer').click();
  await id('prep-buyer-buyer-b').click();
  if (withDay) {
    await id('prep-date').click();
    await id('prep-date-picker-tomorrow').click();
    await id('prep-date-picker-done').click();
    await id('prep-time-08:00').click();
  }
  await id('prep-price').click();
  for (const k of '52.50') await id(`prep-price-input-pad-key-${k}`).click();
  await id('prep-price-input-done').click();
  await expect(id('prep-price')).toContainText('52.50');
  await id('prep-done').click();
}

test('E15-S02 A: start the sale from a prep with no day — buyer and price filled, price editable (offline)', async ({ page, context }) => {
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seedMaster(page, FARM);
  await page.goto('/v2');
  await context.setOffline(true);
  await prepareBuyerAndPrice(page, false);

  await id('home-sale-start').click();
  await expect(id('sale-start')).toBeVisible();
  await expect(id('start-prep-ask')).toHaveCount(0);
  await expect(id('start-buyer')).toContainText('สหกรณ์บ้านนา');
  await expect(id('start-buyer')).toContainText('ที่นัดไว้ · แก้ได้');
  await expect(id('start-price-row')).toContainText('52.50');
  await expect(id('start-price-row')).toContainText('ราคาที่ตกลงไว้ · แก้ได้');
  await fits(page);
  await evidence(page, `${START_SHOTS}/a-filled.png`);

  // Every field can still be changed: the price on the app pad.
  await id('start-price-row').click();
  for (const k of '48') await id(`start-price-pad-key-${k}`).click();
  await id('start-price-done').click();
  await expect(id('start-price-row')).toContainText('48');
  await id('start-next').click();
  await expect(page).toHaveURL(/\/point/);

  // The prep was used by the sale: home shows no prep any more.
  await page.goto('/v2');
  await expect(id('home-prepare-badge')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('E15-S02 B: a prep for a later day asks first; ใช้ที่เตรียมไว้ fills it (offline)', async ({ page, context }) => {
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seedMaster(page, FARM);
  await page.goto('/v2');
  await context.setOffline(true);
  await prepareBuyerAndPrice(page, true);

  await id('home-sale-start').click();
  await expect(id('start-prep-ask')).toBeVisible();
  await expect(id('start-prep-ask')).toContainText('ใช้ที่เตรียมไว้ไหม');
  await expect(id('start-buyer')).not.toContainText('ที่นัดไว้');
  await expect(id('start-price-row')).not.toContainText('52.50');
  await fits(page);
  await evidence(page, `${START_SHOTS}/b-ask.png`);

  await id('start-prep-use').click();
  await expect(id('start-prep-ask')).toHaveCount(0);
  await expect(id('start-buyer')).toContainText('สหกรณ์บ้านนา');
  await expect(id('start-price-row')).toContainText('52.50');
  await evidence(page, `${START_SHOTS}/b-used.png`);
  expect(errors).toEqual([]);
});
