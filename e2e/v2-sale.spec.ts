import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { evidence, seedMaster } from './fixtures';

/**
 * The v2 sale flow in the real web build, offline (sale mockup v1.1.0
 * sections 1–4): start a sale, pick a point, check the empty scale, count,
 * a short basket, switch point and fill it up, reload and find it all still
 * there, then check with the buyer, settle shares, round and pay — plus
 * บันทึกย้อนหลัง. Everything is read back from the local event log.
 * Screenshots at 412×915 are evidence for the owner beside the mockup
 * (written to docs/ only with UPDATE_SCREENSHOTS=1).
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/sale';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the sale flow is portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string, fullPage = false) => evidence(page, `${SHOTS}/${name}.png`, { fullPage });

/** The mockup's farm: แดง taps จันทเขลม จุด 1–3, นัด taps จันทเขลม จุด 4 and คลองพลู จุด 1. */
const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'mgr', name: 'อ.สมหวัง', roles: ['manager'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'property_added', propertyId: 'fb', name: 'คลองพลู', crop: 'rubber' },
  { t: 'area_recorded', propertyId: 'fa', entryId: 'ar1', centiRai: 12_500, effective: '2020-01-01' },
  { t: 'area_recorded', propertyId: 'fb', entryId: 'ar2', centiRai: 3_000, effective: '2020-01-01' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'point_added', pointId: 'a2', propertyId: 'fa', name: 'จุด 2' },
  { t: 'point_added', pointId: 'a3', propertyId: 'fa', name: 'จุด 3' },
  { t: 'point_added', pointId: 'a4', propertyId: 'fa', name: 'จุด 4' },
  { t: 'point_added', pointId: 'b1', propertyId: 'fb', name: 'จุด 1' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's2', pointId: 'a2', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's3', pointId: 'a3', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'a4', tapperId: 'nat' },
  { t: 'tapper_assigned', assignmentId: 's5', pointId: 'b1', tapperId: 'nat' },
];

async function hold(page: Page, id = 'hold') {
  const box = (await on(page)(id).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_000);
  await page.mouse.up();
}

test('start → point → empty scale → count → short → switch and fill → reload keeps it, offline', async ({ page, context }) => {
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seedMaster(page, FARM);
  // This device's hold time, pinned so a 1 s hold always clears it with room to spare.
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await context.setOffline(true);

  // ── เริ่มการขาย (page 5), from the home ──
  await id('home-sale-start').click();
  await expect(id('sale-start')).toBeVisible();
  await id('start-buyer').click();
  await id('start-buyer-buyer-a').click();
  await expect(id('start-buyer')).toContainText('คนรับซื้อยาง ก');
  await expect(id('start-manager')).toContainText('อ.สมหวัง');
  await shot(page, '05-start', true);
  await id('start-next').click();

  // ── เลือกจุดชั่ง (page 6) ──
  await expect(id('pick')).toBeVisible();
  await id('pick-farm-fa').click();
  await expect(id('pick-tapper-red')).toContainText('3 จุด');
  await shot(page, '06-point');
  await id('pick-point-a1').click();

  // ── ก่อนชั่ง (page 7) ──
  await expect(id('zero-tare')).toBeVisible();
  await expect(id('expect-kg')).toContainText('52');
  await shot(page, '07-zero-tare');
  await id('start-weigh').click();

  // ── นับเข่ง (page 8) ──
  await expect(id('counter')).toBeVisible();
  for (let i = 0; i < 3; i++) await hold(page);
  await expect(id('current-no')).toHaveText('4');
  await expect(id('fig-done')).toContainText('3');
  await expect(id('fig-kg')).toContainText('150');
  await shot(page, '08-counter');

  // ── เข่งไม่เต็ม (pages 10, 11) ──
  await id('tool-short').click();
  await expect(id('short-sheet')).toBeVisible();
  await expect(id('reading')).toContainText('37');
  await shot(page, '10-short');
  await id('short-save').click();
  await expect(id('open-card')).toContainText('เข่ง 4 เปิดอยู่ · 35 กก.');
  await shot(page, '11-open-short');

  // ── เปลี่ยนจุด → จุด 2 ของคนกรีดยางคนเดิม (page 12) ──
  await id('switch-point').click();
  await id('pick-point-a2').click();
  await expect(id('fill-sheet')).toContainText('เข่ง 4 ยังไม่เต็ม');
  await shot(page, '12-switch-same-tapper');
  await id('fill-full').click();
  await expect(id('zero-tare')).toBeVisible();
  await id('start-weigh').click();

  // ── เติมให้เต็มเข่งที่จุดใหม่ (page 13) ──
  await expect(id('hold')).toContainText('เติมเข่ง 4');
  await shot(page, '13-fill');
  await hold(page);
  await expect(id('current-no')).toHaveText('5');

  // ── back after a switch never opens the old point's counter (review #3) ──
  await page.goBack();
  await expect(page).not.toHaveURL(/point=a1/);
  await expect(id('point-place')).toHaveCount(0);
  await page.goForward();
  await expect(id('point-place')).toContainText('จันทเขลม · จุด 2');
  await expect(id('fig-kg')).toContainText('200');

  // ── reload (the page needs the network; the data does not) ──
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(id('current-no')).toHaveText('5');
  await expect(id('fig-kg')).toContainText('200');
  await expect(id('point-place')).toContainText('จันทเขลม · จุด 2');

  // ── โหมดสาธารณะ (page 9) ──
  await id('tool-public').click();
  await expect(id('public-no')).toHaveText('5');
  await shot(page, '09-public');
  await id('public-exit').click();
  await expect(id('counter')).toBeVisible();

  // ── บันทึกย้อนหลัง (page 14): จุด 3 of แดง, on paper ──
  await id('counter-menu').click();
  await id('menu-backfill').click();
  await expect(id('pick')).toBeVisible();
  await id('pick-point-a3').click();
  await expect(id('backfill')).toBeVisible();
  await id('backfill-full').fill('3');
  await id('backfill-short').fill('20');
  await expect(id('backfill-plan')).toContainText('จะได้ 4 เข่ง');
  await expect(id('backfill-plan')).toContainText('เข่งที่ 5–7');
  await expect(id('backfill-total')).toContainText('170 กก.');
  await shot(page, '14-backfill');
  await id('backfill-save').click();
  await expect(id('counter')).toBeVisible();

  // ── นัด at จันทเขลม จุด 4: another tapper, nothing asked ──
  await id('switch-point').click();
  await id('pick-tapper-nat').click();
  await id('pick-point-a4').click();
  await id('start-weigh').click();
  await expect(id('point-tapper')).toContainText('นัด');
  await expect(id('current-no')).toHaveText('1');
  await hold(page);
  await hold(page);
  await expect(id('fig-kg')).toContainText('100');

  // ── ชั่งครบแล้ว → ตรวจยอด (page 16): the price first, then one tap ──
  await id('counter-menu').click();
  await id('menu-finish').click();
  await expect(id('check')).toBeVisible();
  await id('check-price').fill('48.50');
  await id('check-price-save').click();
  await expect(id('check-total')).toContainText('22,795.00');
  await expect(id('check-weight')).toContainText('470 กก.');
  await shot(page, '16-check');
  await id('check-match').click();
  await expect(id('check-status')).toContainText('ตรงกัน');
  await id('to-settlement').click();

  // ── สรุปยอดส่วนแบ่ง (page 17), ปัดเศษ (page 18) ──
  await expect(id('settlement')).toBeVisible();
  await expect(id('share-amt-red')).toContainText('8,972.50');
  await expect(id('share-amt-nat')).toContainText('2,425.00');
  await expect(id('owner-transfer')).toContainText('11,397.50');
  await shot(page, '17-settlement');
  await id('to-rounding').click();
  await expect(id('rounding-sheet')).toBeVisible();
  await id('round-worker').click();
  await shot(page, '18-rounding');
  await id('round-confirm').click();

  // ── เทียบยอด (page 18a) ──
  await expect(id('tally')).toBeVisible();
  await expect(id('tally-ok')).toBeVisible();
  await expect(id('tally-sum')).toContainText('22,795.00');
  await shot(page, '18a-tally');
  await id('to-payment').click();

  // ── การจ่ายเงิน (page 19): ticks survive a reload; then close ──
  await expect(id('payment')).toBeVisible();
  await expect(id('tick-amt-red')).toContainText('8,973');
  await id('tick-red').click();
  await expect(id('tick-red')).toHaveAttribute('aria-checked', 'true');
  await id('tick-owner').click();
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(id('tick-red')).toHaveAttribute('aria-checked', 'true');
  await expect(id('pay-check')).toContainText('ตรงกัน');
  await shot(page, '19-payment');
  await id('close-sale').click();

  // ── การขายทั้งหมด (page 4) ──
  await expect(id('sales')).toBeVisible();
  await expect(id('sale-rows')).toContainText('470 กก.');
  await expect(id('sale-rows')).toContainText('ปิดแล้ว');
  // ── back after closing finds no live counter (review #2) ──
  await page.goBack();
  await expect(id('hold')).toHaveCount(0);
  await page.goForward();
  await expect(id('sales')).toBeVisible();
  await shot(page, '04-sales');

  expect(errors).toEqual([]);
});
