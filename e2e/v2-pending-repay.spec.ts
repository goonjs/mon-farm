import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../src/core/fixtures';
import type { FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { evidence, seedEvents, seedMaster } from './fixtures';

/**
 * E06-S08 in the real web build, offline (mockup debt-pending-repay.html):
 * close the E05-S11 example sale without ticking the transfer → the debt list,
 * the worker's account and the home say the repayment money is not in yet →
 * record that the transfer came in short → the buyer owes the farm on the
 * home and the payment page, with ดูที่มา adding up to the sale. Screenshots
 * at 390×844 are evidence for the owner (docs/ only with UPDATE_SCREENSHOTS=1);
 * each screen's height ÷ viewport is reported (phone-form-ux).
 */

const SHOTS = 'docs/ux/screenshots/debt-pending-repay/build';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));
test.use({ viewport: { width: 390, height: 844 } });

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string) => evidence(page, `${SHOTS}/${name}.png`);

/** The tallest scroller on the page against its box (≤ 1.0 = fits one screen). */
const height = (page: Page) =>
  page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('div')].filter((d) => ['auto', 'scroll'].includes(getComputedStyle(d).overflowY) && d.clientHeight > 0);
    return scrollers.length ? Math.max(...scrollers.map((d) => d.scrollHeight / d.clientHeight)) : document.documentElement.scrollHeight / innerHeight;
  });
/** Text sticking out past the screen (PR-11). The home cover drawing bleeds on purpose and holds no text. */
const sideways = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('div')]
      .filter((d) => d.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(d).visibility !== 'hidden' && (d.textContent ?? '').trim() !== '')
      .map((d) => `${d.getAttribute('data-testid') ?? ''} ${Math.round(d.getBoundingClientRect().left)}→${Math.round(d.getBoundingClientRect().right)} ${(d.textContent ?? '').slice(0, 30)}`),
  );
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
const owesNat = (amountSatang: number, date: string): FinancePayload => ({ t: 'expense_created', fields: { amountSatang, date, stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
const seedFinance = (page: Page, events: FinanceEvent[]) => page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), events);

/** The E05-S11 example farm (copied from v2-sale.spec.ts). */
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

test('closed without the transfer ticked → waiting on the ledger and home → received short → buyer owes (E06-S08)', async ({ page, context }) => {
  test.setTimeout(90_000);
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const heights: Record<string, number> = {};
  const measure = async (name: string) => {
    heights[name] = Number((await height(page)).toFixed(2));
    expect(await sideways(page), `${name}: nothing sticks out sideways`).toEqual([]);
  };

  await seedMaster(page, FARM);
  // ขาย 28,875.00 at 52.50: แดง 350 kg (share 9,187.50), นัด 200 kg (share 5,250.00); แดง owes 15,790, นัด 8,350.
  const b = new LogBuilder('sale-rp');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of ['a1', 'a4']) b.sys({ t: 'pile_added', pileId: p, zoneId: 'fa', name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt('a1', n);
  for (let n = 1; n <= 4; n++) b.acceptAt('a4', n);
  const now = Date.now();
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: now })));
  // the farm owes นัด 640 (the E05-S11 example): the owed card stays "ไว้ก่อน".
  await seedFinance(page, [finEvent(1, now, 'd-red-1', loan(RED, 1_579_000, '2026-10-01')), finEvent(2, now, 'd-nat-1', loan(NAT, 835_000, '2026-10-01')), finEvent(3, now, 'exp-nat', owesNat(64_000, '2026-10-25')), finEvent(4, now, 'plan-red', { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 })]);
  // ── close the sale, first-time defaults (โอนรวม), nothing ticked ──
  await page.goto('/v2/sale/sale-rp/settlement');
  await expect(id('co-summary')).toBeVisible();
  await id('co-debt-open').click();
  await id('co-debt-ok').click();
  await id('co-owed-open').click();
  await id('co-owed-ok').click();
  await id('co-confirm').click();
  await expect(id('payment')).toBeVisible();
  await expect(id('tick-amt-owner')).toContainText('22,937');
  await id('close-sale').click();
  await expect(id('sales')).toBeVisible();

  // ── H1: the home says the repayment money is not in yet ──
  await page.goto('/v2');
  await expect(id('home-repay-wait')).toContainText('เงินคืนหนี้ ยังไม่เข้าสวน');
  await expect(id('home-repay-wait')).toContainText('฿ 8,500');
  await shot(page, 'h1-home');
  await measure('h1-home');

  // ── M1: the list ──
  await page.goto('/v2/debts');
  await expect(id('rp-list-sum-total')).toContainText('฿ 8,500');
  await expect(id('rp-list-chip-red')).toContainText('฿ 3,250');
  await expect(id('debt-account-red')).toContainText('12,540.00');
  await shot(page, 'm1-list');
  await measure('m1-list');

  // ── M3: นัด's account, the transfer waits; M5 the sheet with the whole transfer ──
  await id('debt-account-nat').click();
  await expect(id('debt-balance')).toHaveText('3,100.00');
  await expect(id('rp-row-sale-rp-transfer')).toContainText('รอคนซื้อโอน');
  await shot(page, 'm3-account');
  await measure('m3-account');
  // Offline for the writes: the tick is written to the local log only (offline-first).
  await context.setOffline(true);
  await id('rp-row-sale-rp-transfer').click();
  await expect(id('rp-bundle-total')).toHaveText('22,937.00');
  await shot(page, 'm5-sheet');
  await measure('m5-sheet');

  // ── M7: it came in short: 20,000.00 of 22,937.00 ──
  await id('rp-sheet-less').click();
  for (const d of '20000') await id(`rp-amt-pad-key-${d}`).click();
  await expect(id('rp-amt-owes')).toContainText('2,937.00');
  await expect(id('rp-amt-debt')).toContainText('3,100.00');
  await shot(page, 'm7-less');
  await measure('m7-less');
  await id('rp-amt-save').click();
  await expect(id('rp-card')).toHaveCount(0);
  await expect(id('rp-undo')).toContainText('ได้ 20,000.00');
  await expect(id('debt-balance')).toHaveText('3,100.00');
  await shot(page, 'p3-undo');
  await context.setOffline(false);

  // ── H2: the buyer owes the farm, per sale ──
  await page.goto('/v2');
  await expect(id('home-repay-wait')).toHaveCount(0);
  await expect(id('home-owes-sale-rp')).toContainText('คนซื้อค้างสวน');
  await expect(id('home-owes-sale-rp')).toContainText('฿ 2,937');
  await shot(page, 'h2-home');
  await measure('h2-home');

  // ── P2: the payment page shows the chip; ดูที่มา adds up to the sale ──
  await id('home-owes-sale-rp').click();
  await expect(id('payment')).toBeVisible();
  await expect(id('pay-owes-owner')).toContainText('฿ 2,937');
  await shot(page, 'p2-payment');
  await measure('p2-payment');
  await page.getByTestId('pay-sources-open').or(page.getByTestId('co-sources-open')).filter({ visible: true }).first().click();
  await expect(id('co-src-received')).toContainText('25,938.00');
  await expect(id('co-src-owes')).toContainText('2,937.00');
  await shot(page, 'p2-sources');

  test.info().annotations.push({ type: 'heights', description: JSON.stringify(heights) });
  console.log(`E06-S08 heights ÷ 844: ${JSON.stringify(heights)}`);
  expect(errors).toEqual([]);
});

test('the largest text size: the ledger card and the sheet stay on screen, nothing cut (PR-11)', async ({ page }) => {
  test.setTimeout(60_000);
  const id = on(page);
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:text-size', 'l'));
  const now = Date.now();
  const b = new LogBuilder('sale-rp-l');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  b.sys({ t: 'pile_added', pileId: 'a1', zoneId: 'fa', name: 'a1', tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt('a1', n);
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: now })));
  const today = new Date().toISOString().slice(0, 10);
  await seedFinance(page, [
    finEvent(1, now, 'd-red-1', loan(RED, 1_579_000, '2026-10-01')),
    finEvent(2, now, 'dp-red-1', { t: 'debt_payment_recorded', fields: { worker: RED, creditor: FARM_PAYER, amountSatang: 325_000, date: today, note: '', method: 'buyer-split', saleId: 'sale-rp-l' } }),
  ]);
  await page.goto('/v2/debt/red?name=%E0%B9%81%E0%B8%94%E0%B8%87');
  await expect(id('rp-card')).toContainText('รอเงินสดจากคนซื้อ');
  expect(await sideways(page)).toEqual([]);
  await shot(page, 'l-m2-account');
  await id('rp-row-sale-rp-l-cash').click();
  await id('rp-sheet-less').click();
  expect(await sideways(page)).toEqual([]);
  await shot(page, 'l-m9-less');
  const h = await height(page);
  console.log(`E06-S08 largest text, received sheet ÷ 844: ${h.toFixed(2)}`);
});
