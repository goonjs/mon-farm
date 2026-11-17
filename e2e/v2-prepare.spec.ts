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
      await expect(id('home-prep')).toContainText('เตรียมการขายครั้งถัดไป');
      await id('home-prep').click();
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
      await expect(id('home-prep')).toContainText('พร้อมขาย');
      await page.reload();
      await expect(id('home-prep')).toContainText('สหกรณ์บ้านนา');
      await fits(page);
      await shot('4-home');
      expect(errors).toEqual([]);
    });
  }
}
