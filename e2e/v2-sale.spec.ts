import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../src/core/fixtures';
import type { FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { evidence, seedEvents, seedMaster } from './fixtures';

/**
 * The v2 sale flow in the real web build, offline (sale mockup v1.1.0
 * sections 1–4): start a sale, pick a point, check the empty scale, count,
 * a short basket, switch point and fill it up, reload and find it all still
 * there, then check with the buyer, the close-out summary (E05-S11), the
 * cash step and pay — plus
 * บันทึกย้อนหลัง. Everything is read back from the local event log.
 * Screenshots at 412×915 are evidence for the owner beside the mockup
 * (written to docs/ only with UPDATE_SCREENSHOTS=1).
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/sale';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the sale flow is portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

test('one open sale: เริ่มการขาย goes back to it; the ⋯ menu adds the price, shows the info and deletes it (owner 2026-10-11)', async ({ page }) => {
  const id = on(page);
  await seedMaster(page, FARM);
  await page.goto('/v2');
  await id('home-sale-start').click();
  await id('start-buyer').click();
  await id('start-buyer-buyer-a').click();
  await id('start-next').click();
  await expect(id('pick')).toBeVisible();

  // The agreed price, added from the menu of the point picker.
  await id('pick-menu').click();
  await expect(id('menu-price')).toContainText('ใส่ราคาที่ตกลง');
  await id('menu-price').click();
  await id('option-price').fill('52.50');
  await shot(page, '20-option-price');
  await id('option-price-save').click();
  await id('pick-menu').click();
  await expect(id('menu-price')).toContainText('52.50');
  await id('menu-info').click();
  await expect(id('info-buyer')).toContainText('คนรับซื้อยาง ก');
  await expect(id('info-price')).toContainText('52.50');
  await shot(page, '21-sale-info');
  await id('info-done').click();

  // Home → เริ่มการขาย opens the sale still open, not a second one.
  await page.goto('/v2');
  await id('home-sale-start').click();
  await expect(id('pick')).toBeVisible();
  await expect(id('sale-start')).toHaveCount(0);
  await page.goto('/v2/sales');
  await expect(id('sale-rows').locator('[data-testid^="sale-row-"]')).toHaveCount(1);

  // A stray open sale can be deleted; then เริ่มการขาย starts a new one.
  await id('sale-rows').locator('[data-testid^="sale-row-"]').first().click();
  await id('pick-menu').click();
  await id('menu-delete').click();
  await shot(page, '22-delete-sale');
  await id('delete-confirm').click();
  await expect(id('v2-home')).toBeVisible();
  await id('home-sale-start').click();
  await expect(id('sale-start')).toBeVisible();
});

/** A finance event as the device stores it (localStorage `mon-farm:finance-events`). */
const finEvent = (n: number, ts: number, targetId: string, payload: FinancePayload): FinanceEvent => ({
  id: `e2e-fin-${n}`,
  groupId: FIXTURE_GROUP_ID,
  deviceSeq: n,
  ts,
  actor: { userId: 'pre-login', deviceId: 'dev-seed' },
  source: 'app',
  targetId,
  baseEventId: null,
  payload,
});
const FARM_PAYER = { id: 'farm', name: 'เงินสวน' };
const RED = { id: 'red', name: 'แดง' };
const NAT = { id: 'nat', name: 'นัด' };
const loan = (worker: typeof RED, amountSatang: number, date: string): FinancePayload => ({ t: 'debt_added', fields: { worker, kind: 'loan', amountSatang, date, note: '', lender: FARM_PAYER, fertilizer: null, carriedForward: false } });
const fert = (worker: typeof RED, amountSatang: number, date: string): FinancePayload => ({
  t: 'debt_added',
  fields: { worker, kind: 'fertilizer', amountSatang, date, note: '', lender: null, fertilizer: { totalSatang: amountSatang * 2, workerPct: 50 }, carriedForward: false },
});
const owesNat = (amountSatang: number, date: string): FinancePayload => ({ t: 'expense_created', fields: { amountSatang, date, stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
const seedFinance = (page: Page, events: FinanceEvent[]) => page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), events);
/** Clear the close-out number pad, then type. */
async function padType(page: Page, digits: string) {
  for (let i = 0; i < 10; i++) await on(page)('co-pad-key-back').click();
  for (const d of digits) await on(page)(`co-pad-key-${d}`).click();
}

test('close-out: netting the money the farm owes back against a debt (E06-S04)', async ({ page }) => {
  const id = on(page);
  await seedMaster(page, FARM);
  // นัด: two full baskets at จุด 4 (share ฿2,625 at 52.50), owes the farm ฿3,000, and the farm owes นัด ฿640.
  const b = new LogBuilder('sale-net');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  b.sys({ t: 'pile_added', pileId: 'a4', zoneId: 'fa', name: 'a4', tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt('a4', 1).acceptAt('a4', 2);
  const now = Date.now();
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: now })));
  await seedFinance(page, [finEvent(1, now, 'debt-nat', loan(NAT, 300_000, '2026-09-01')), finEvent(2, now, 'exp-nat', owesNat(64_000, '2026-09-28'))]);
  await page.goto('/v2/sale/sale-net/settlement');
  await expect(id('co-summary')).toBeVisible();
  // the proposal never nets by itself (D-60)
  await expect(id('co-deduct-nat')).toContainText('−2,625.00');
  await expect(id('co-net-nat')).toHaveCount(0);
  await id('co-deduct-nat').click();
  await id('co-net-link').click();
  await expect(id('co-net-on')).toBeVisible();
  await shot(page, '23-netting');
  await id('co-deduct-ok').click();
  // ↗ the farm repays นัด by netting; the deduct ✓ counts as checking his debt and the owed card (A22, CO-26)
  await expect(id('co-net-nat')).toContainText('หักกลบ');
  await expect(id('co-tally')).toContainText('ตรงถึงสตางค์');

  // ── ดูที่มา (was เทียบยอด, page 18a): ② the debt moves add up to 0, with the ↗ netting pair ──
  await id('co-sources-open').click();
  await expect(id('co-src-debt')).toContainText('หนี้ลด = สวนได้คืน');
  await expect(id('co-src-debt')).toContainText('หักกลบ');
  await expect(id('co-src-paid')).toContainText('5,250.00');
  await shot(page, '18a-tally', true);
  await id('co-sources-sheet-scrim').click({ position: { x: 10, y: 10 } });
  await id('co-cash-card').click();
  await id('cop-ok').click();
  await id('co-confirm').click();
  await expect(id('payment')).toBeVisible();
  await expect(id('pay-tally')).toContainText('ยอดตรงกันแล้ว');
});

test('a sale for an earlier day takes part of a later-dated debt as separate cash (E05-S10)', async ({ page }) => {
  const id = on(page);
  await seedMaster(page, FARM);
  // The owner's case (2026-10-27): the sale is dated 13 Oct, นัด's fertilizer debt 27 Oct and recorded first.
  const b = new LogBuilder('sale-13');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  b.sys({ t: 'pile_added', pileId: 'a4', zoneId: 'fa', name: 'a4', tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt('a4', 1).acceptAt('a4', 2);
  const day = Date.parse('2026-10-13T08:00:00+07:00');
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: day })));
  await seedFinance(page, [finEvent(1, Date.now(), 'debt-nat', fert(NAT, 150_000, '2026-10-27'))]);
  await page.goto('/v2/sale/sale-13/settlement');
  await expect(id('co-summary')).toBeVisible();
  await id('co-deduct-nat').click();
  await padType(page, '500');
  // 1,500 − 500: what the sale did not take is still owed, not 0.
  await expect(id('co-res-left')).toContainText('1,000.00');
  await shot(page, '17-debt-left-e05s10');
  await id('co-deduct-ok').click();
  await id('co-owed-none').click();
  await id('co-cash-card').click();
  await id('cop-route-nat-buyer-split').click();
  await expect(id('cop-split-nat')).toContainText('เงินสดคืนหนี้นัด');
  await expect(id('cop-split-nat')).toContainText('500.00');
  await shot(page, '17-cash-today-e05s10');
  await id('cop-ok').click();
  await id('co-confirm').click();

  // The farm ticks that it got the separate cash.
  await expect(id('payment')).toBeVisible();
  await expect(id('tick-debt-cash-nat')).toContainText('รับเงินสดคืนหนี้แล้ว · นัด');
  await expect(id('tick-amt-debt-cash-nat')).toContainText('500.00');
  await id('tick-debt-cash-nat').click();
  await expect(id('tick-debt-cash-nat')).toHaveAttribute('aria-checked', 'true');
  await shot(page, '19-payment-debt-cash-e05s10', true);
  // Back on the summary: 1,000 still owed.
  await page.goto('/v2/sale/sale-13/settlement');
  await id('co-debt-open').click();
  await expect(id('co-debt-row-nat')).toContainText('คงเหลืออีก 1,000.00');
});

test.describe('the story example at 390×844 (E05-S11)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('2 tappers with debt: debt ถูกต้อง → owed ไว้ก่อน ถูกต้อง → cash ตกลง → ยืนยันยอด → pay → close', async ({ page }) => {
    const id = on(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await seedMaster(page, FARM);
    // ขาย 28,875.00 at 52.50: แดง 350 kg (share 9,187.50), นัด 200 kg (share 5,250.00).
    const b = new LogBuilder('sale-story');
    b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
    for (const p of ['a1', 'a4']) b.sys({ t: 'pile_added', pileId: p, zoneId: 'fa', name: p, tareG: 2_000, stdNetG: 50_000 });
    for (let n = 1; n <= 7; n++) b.acceptAt('a1', n);
    for (let n = 1; n <= 4; n++) b.acceptAt('a4', n);
    const now = Date.now();
    await seedEvents(page, b.build().map((e) => ({ ...e, ts: now })));
    await seedFinance(page, [
      finEvent(1, now, 'd-red-1', loan(RED, 600_000, '2026-09-01')),
      finEvent(2, now, 'd-red-2', fert(RED, 579_000, '2026-09-28')),
      finEvent(3, now, 'd-red-3', fert(RED, 400_000, '2026-10-05')),
      finEvent(4, now, 'plan-red', { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 }),
      finEvent(5, now, 'd-nat-1', fert(NAT, 735_000, '2026-10-05')),
      finEvent(6, now, 'd-nat-2', loan(NAT, 100_000, '2026-10-20')),
      finEvent(7, now, 'exp-nat', owesNat(64_000, '2026-10-25')),
    ]);
    await page.goto('/v2/sale/sale-story/settlement');
    await expect(id('co-summary')).toBeVisible();
    await expect(id('co-cash-red')).toHaveText('5,938.00');
    await expect(id('co-cash-nat')).toHaveText('0.00');
    await expect(id('co-tally')).toContainText('ตรงถึงสตางค์');
    // How tall the page is against the screen (CO-1: 2 tappers ≤ 1.0 screen), for the report.
    const height = await page.evaluate(() => Math.max(...[...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).overflowY === 'auto' || getComputedStyle(d).overflowY === 'scroll').map((d) => d.scrollHeight / d.clientHeight)));
    test.info().annotations.push({ type: 'summary-screens', description: height.toFixed(2) });
    await shot(page, 'co-01-summary');

    let taps = 0;
    const tap = async (testId: string) => {
      await id(testId).click();
      taps += 1;
    };
    await tap('co-debt-open');
    await tap('co-debt-ok');
    await tap('co-owed-open');
    await expect(id('co-owed-hold-nat')).toBeVisible();
    await tap('co-owed-ok');
    // ไว้ก่อน is the default (CO-26)
    await expect(id('co-owed-card')).toContainText('ไว้ก่อน');
    await expect(id('co-confirm')).toContainText('จัดเงินสดกับคนรับซื้อยางก่อน');
    await tap('co-cash-card');
    await expect(id('cop-transfer')).toContainText('22,937.00');
    await expect(id('cop-total')).toContainText('28,875.00');
    await tap('cop-ok');
    await expect(id('co-confirm')).toContainText('ยืนยันยอด · ไปจ่ายเงิน');
    await tap('co-confirm');
    await expect(id('payment')).toBeVisible();
    await expect(id('tick-amt-red')).toContainText('5,938.00');
    await expect(id('pay-info-nat')).toContainText('นัดไม่มีเงินสดต้องจ่ายวันนี้');
    await expect(id('tick-amt-owner')).toContainText('22,937.00');
    await expect(id('pay-tally')).toContainText('ยอดตรงกันแล้ว');
    await shot(page, 'co-09-payment');
    await tap('close-sale');
    await expect(id('sales')).toBeVisible();
    await expect(id('sale-rows')).toContainText('ปิดแล้ว');
    test.info().annotations.push({ type: 'taps', description: String(taps) });
    console.log(`E05-S11 story example: ${taps} taps, summary ${height.toFixed(2)} screens`);
    // story target ≤ 7 for summary → pay; the close is the 8th
    expect(taps).toBeLessThanOrEqual(8);
    expect(errors).toEqual([]);
  });
});

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
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 4$/);
  await expect(id('fig-done')).toContainText('3');
  await expect(id('fig-kg')).toContainText('150');
  await shot(page, '08-counter');

  // ── เข่งไม่เต็ม (pages 10, 11) ──
  await id('tool-short').click();
  await expect(id('short-sheet')).toBeVisible();
  await expect(id('reading-scale-input')).toHaveValue('37');
  await expect(id('reading-net-input')).toHaveValue('35');
  await shot(page, '10-short');
  // The dial mode (device setting, E04-S16) follows the net rubber when asked, then back to typing.
  await id('short-cancel').click();
  await page.evaluate(() => localStorage.setItem('mon-farm:weigh-mode', 'dial'));
  await id('tool-short').click();
  await id('basis-net').click();
  await expect(id('reading')).toContainText('35');
  await shot(page, '10b-short-dial-net');
  await id('basis-scale').click();
  await expect(id('reading')).toContainText('37');
  await id('short-cancel').click();
  await page.evaluate(() => localStorage.removeItem('mon-farm:weigh-mode'));
  await id('tool-short').click();
  await expect(id('reading-scale-input')).toHaveValue('37');
  await id('short-save').click();
  await expect(id('open-card')).toContainText('เข่ง 4 · 35 / 50 กก.');
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
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 5$/);

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
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 5$/);
  await expect(id('fig-kg')).toContainText('200');
  await expect(id('point-place')).toContainText('จันทเขลม · จุด 2');

  // ── รายการเข่ง (page 8d): every basket so far, the time to the second ──
  await id('tool-history').click();
  await expect(id('history')).toBeVisible();
  await expect(id('hist-summary')).toContainText('รวม 200 กก.');
  await expect(page.locator('[data-testid^="hist-row-"]').first()).toContainText(/\d\d:\d\d:\d\d/);
  await shot(page, '8d-history');
  await id('v2-back').click();
  await expect(id('counter')).toBeVisible();

  // ── ย้อนกลับ is a hold: a tap does nothing, a full hold gives the number back ──
  await id('tool-undo').click();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 5$/);
  await hold(page, 'tool-undo');
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 4$/);
  await expect(id('undo-notice')).toContainText('ยกเลิกส่วนที่เติมของเข่ง 4 แล้ว');
  await hold(page);
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 5$/);
  await expect(id('count-notice')).toContainText('บันทึกเข่ง 4');

  // ── the list says what was done: the basket taken back stays, marked, out of the totals ──
  await id('tool-history').click();
  await expect(page.getByText(/ถูกย้อนกลับ \d\d:\d\d:\d\d/)).toHaveCount(1);
  await expect(id('hist-numbers-ok')).toBeVisible();
  await expect(id('hist-summary')).toContainText('รวม 200 กก.');
  await shot(page, '8e-history-undone');
  await id('v2-back').click();
  await expect(id('counter')).toBeVisible();

  // ── โหมดสาธารณะ (page 9): in the ⋯ menu ──
  await id('counter-menu').click();
  await id('menu-public').click();
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
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 1$/);
  await hold(page);
  await hold(page);
  await expect(id('fig-kg')).toContainText('100');

  // ── ชั่งครบแล้ว → ตรวจยอด (page 16): the price first, then one tap ──
  await id('counter-menu').click();
  await shot(page, '08m-menu');
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

  // ── สรุปจ่ายเงิน (E05-S11): no debt recorded, the farm owes no one — both cards ask ──
  await expect(id('co-summary')).toBeVisible();
  await expect(id('co-worker-red')).toContainText('ส่วนแบ่ง 8,972.50');
  await expect(id('co-worker-nat')).toContainText('ส่วนแบ่ง 2,425.00');
  await expect(id('co-cash-red')).toHaveText('8,973.00');
  await expect(id('co-confirm')).toContainText('ตอบการ์ดด้านบนทั้ง 2 ใบก่อน');
  await id('co-debt-none').click();
  await id('co-owed-none').click();
  await expect(id('co-tally')).toContainText('ตรงถึงสตางค์');
  await shot(page, '17-settlement');
  // ── จัดเงินสด (CO-19): the fraction is rounded to the tapper, first time ──
  await id('co-cash-card').click();
  await expect(id('cop-cash')).toBeVisible();
  await expect(id('cop-round-worker')).toHaveAttribute('aria-checked', 'true');
  await expect(id('cop-transfer')).toContainText('11,397.00');
  await expect(id('cop-total')).toContainText('22,795.00');
  await shot(page, '18-rounding');
  await id('cop-ok').click();
  await expect(id('co-summary')).toBeVisible();
  await id('co-confirm').click();

  // ── จ่ายเงิน · ปิดการขาย (CO-10): ticks survive a reload; then close ──
  await expect(id('payment')).toBeVisible();
  await expect(id('tick-amt-red')).toContainText('8,973.00');
  await id('tick-red').click();
  await expect(id('tick-red')).toHaveAttribute('aria-checked', 'true');
  await id('tick-owner').click();
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(id('tick-red')).toHaveAttribute('aria-checked', 'true');
  await expect(id('pay-tally')).toContainText('ยอดตรงกันแล้ว');
  await shot(page, '19-payment');
  await id('close-sale').click();

  // ── การขายทั้งหมด (page 4) ──
  await expect(id('sales')).toBeVisible();
  await expect(id('sale-rows')).toContainText('470 กก.');
  await expect(id('sale-rows')).toContainText('ปิดแล้ว');
  // ── back after closing finds no live counter (review #2) ──
  // However far back the browser goes, every page of the closed sale is read-only.
  // (Online for this: going back past the earlier reload loads that document again.)
  await context.setOffline(false);
  for (let i = 0; i < 6; i++) {
    await page.goBack();
    await page.waitForLoadState();
    await page.waitForTimeout(400);
    await expect(id('hold')).toHaveCount(0);
  }
  await page.goto('/v2/sales');
  await expect(id('sales')).toBeVisible();
  await shot(page, '04-sales');

  expect(errors).toEqual([]);
});

test('back to a point already weighed: straight to its counter, the count goes on (owner 2026-10-10)', async ({ page, context }) => {
  const id = on(page);
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await context.setOffline(true);
  await id('home-sale-start').click();
  await id('start-next').click();
  await id('pick-farm-fa').click();
  await id('pick-point-a1').click();
  // The empty scale reads +1: accept the skew, so every move checks a new point (D-76).
  await id('zero-not0').click();
  await id('choose-skew').click();
  await id('start-weigh').click();
  for (let i = 0; i < 3; i++) await hold(page);
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 4$/);

  // จุด 2 is new to the sale: its empty scale is checked.
  await id('switch-point').click();
  await id('pick-point-a2').click();
  await expect(id('zero-tare')).toBeVisible();
  await id('zero-zero').click();
  await id('start-weigh').click();
  await expect(id('point-place')).toContainText('จุด 2');

  // Back to จุด 1: no check, its counter at once, and the count goes on.
  await id('switch-point').click();
  await id('pick-point-a1').click();
  await expect(id('point-place')).toContainText('จันทเขลม · จุด 1');
  await expect(id('zero-tare')).toHaveCount(0);
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 4$/);
  await hold(page);
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 5$/);
});

test('last point: one full-width review button, no next-point tile (E04-S18)', async ({ page }) => {
  const id = on(page);
  await seedMaster(page, FARM);
  const b = new LogBuilder('sale-last');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  b.sys({ t: 'zone_added', zoneId: 'fa', name: 'จันทเขลม' });
  b.sys({ t: 'zone_added', zoneId: 'fb', name: 'คลองพลู' });
  for (const p of ['a1', 'a2', 'a3', 'a4', 'b1']) {
    b.sys({ t: 'pile_added', pileId: p, zoneId: p.startsWith('a') ? 'fa' : 'fb', name: p, tareG: 2_000, stdNetG: 50_000 });
    b.sys({ t: 'zero_check', pileId: p, ok: true, readingG: 0 });
    b.sys({ t: 'tare_confirmed', pileId: p, tareG: 2_000 });
    b.sys({ t: 'ready', pileId: p });
    b.acceptAt(p, 1).acceptAt(p, 2);
  }
  b.shortAt('a1', 3, 24_000);
  const now = Date.now();
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: now })));
  await page.goto('/v2/sale/sale-last/counter?point=a1');
  await expect(id('open-card')).toContainText('เข่ง 3 · 22 / 50 กก.');
  await expect(id('next-point')).toHaveCount(0);
  await expect(id('to-summary')).toContainText('ชั่งครบแล้ว → ตรวจยอด');
  const wide = await id('to-summary').boundingBox();
  expect(wide!.width).toBeGreaterThan(300);
  await shot(page, '11b-last-point');
});
