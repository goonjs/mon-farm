import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../src/core/fixtures';
import type { FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { evidence, seedEvents, seedMaster } from './fixtures';
import { multiplyFonts, smallTargets, textFit } from './text-fit';

/**
 * E03-S08 ขนาดตัวอักษร on the real web build, 390×844.
 *
 * TS-1..TS-4: the setting on เครื่องนี้ changes the whole app at once, is kept
 * across a reload, and leaves the public counting numeral alone.
 * TS-8: at the largest size every screen left open by E04-S15, E05-S11,
 * E06-S08, E01-S20 and E11-S11 shows nothing cut, nothing "…", nothing past
 * the screen edge. TS-6/TS-7: the header and the Banner also at ×1.3 (a
 * phone's own font scale on top of L). Before this story the stored size was
 * never read, so the earlier "largest text" checks did not scale anything.
 * Screenshots are evidence (docs/ only with UPDATE_SCREENSHOTS=1).
 */

const SHOTS = 'docs/ux/screenshots/e03-s08';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));
test.use({ viewport: { width: 390, height: 844 } });

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string) => evidence(page, `${SHOTS}/${name}.png`);
/** A weighing point ready to count: added, empty scale checked, basket weight confirmed. */
const ready = (b: LogBuilder, p: string) => {
  b.sys({ t: 'pile_added', pileId: p, zoneId: 'fa', name: p, tareG: 2_000, stdNetG: 50_000 });
  b.sys({ t: 'zero_check', pileId: p, ok: true, readingG: 0 });
  b.sys({ t: 'tare_confirmed', pileId: p, tareG: 2_000 });
  b.sys({ t: 'ready', pileId: p });
};
const fontPx = (page: Page, id: string) => page.getByTestId(id).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

test('เครื่องนี้: เล็ก / กลาง / ใหญ่ changes the app at once and stays after a reload (TS-1..TS-4)', async ({ page }) => {
  const id = on(page);
  await page.goto('/v2/device');
  await expect(id('device-text-size-m')).toHaveAttribute('aria-checked', 'true');
  expect(await fontPx(page, 'screen-title')).toBe(20);
  await shot(page, 'device-m');

  await id('device-text-size-s').click();
  expect(await fontPx(page, 'screen-title')).toBe(18);
  await shot(page, 'device-s');

  await id('device-text-size-l').click();
  expect(await fontPx(page, 'screen-title')).toBe(23);
  expect(await textFit(page)).toEqual([]);
  await shot(page, 'device-l');

  await page.reload();
  await expect(id('device-text-size-l')).toHaveAttribute('aria-checked', 'true');
  expect(await fontPx(page, 'screen-title')).toBe(23);
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:text-size'))).toBe('l');

  // The home screen follows without a restart.
  await page.goto('/v2');
  expect(await fontPx(page, 'screen-title')).toBe(23);
});

test('the public counting numeral is the same size at L as at M (TS-4)', async ({ page }) => {
  await seedMaster(page, FARM);
  const b = new LogBuilder('sale-pub');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'zone_added', zoneId: 'fa', name: 'จันทเขลม' });
  ready(b, 'a1');
  for (let n = 1; n <= 12; n++) b.acceptAt('a1', n);
  await seedEvents(page, b.build());
  // The largest font on the public screen is the count.
  const numeral = async () => {
    await page.goto('/v2/sale/sale-pub/counter?point=a1');
    await page.getByTestId('counter-menu').filter({ visible: true }).click();
    await page.getByTestId('menu-public').filter({ visible: true }).click();
    const no = page.getByTestId('public-no').filter({ visible: true });
    await expect(no).toHaveText('13');
    return no.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  };
  const exit = () => page.getByTestId('public-exit').filter({ visible: true }).evaluate((e) => parseFloat(getComputedStyle(e.querySelector('div[dir]') ?? e).fontSize));
  const m = await numeral();
  const exitM = await exit();
  await page.evaluate(() => localStorage.setItem('mon-farm:text-size', 'l'));
  const l = await numeral();
  // L is really on: the exit button's words grew while the count did not.
  expect(await exit()).toBeGreaterThan(exitM);
  expect(m).toBeGreaterThan(100);
  expect(l).toBe(m);
});

// ── The open checks (TS-8): the E05-S11 example farm and sale, with debts ──

const RED = { id: 'red', name: 'แดง' };
const NAT = { id: 'nat', name: 'นัด' };
const FARM_PAYER = { id: 'farm', name: 'เงินสวน' };
const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'area_recorded', propertyId: 'fa', entryId: 'ar1', centiRai: 12_500, effective: '2020-01-01' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'point_added', pointId: 'a4', propertyId: 'fa', name: 'จุด 4' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'a4', tapperId: 'nat' },
];
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
const owesNat = (amountSatang: number): FinancePayload => ({ t: 'expense_created', fields: { amountSatang, date: '2026-10-25', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
const loan = (worker: typeof RED, amountSatang: number): FinancePayload => ({ t: 'debt_added', fields: { worker, kind: 'loan', amountSatang, date: '2026-10-01', note: '', lender: FARM_PAYER, fertilizer: null, carriedForward: false } });

/** E05-S11 example: 28,875.00 at 52.50 (แดง 350 kg, นัด 200 kg); and one 2,345,678.00 sale (CO-20). */
async function seed(page: Page, size: 's' | 'm' | 'l') {
  await seedMaster(page, FARM);
  const now = Date.now();
  const b = new LogBuilder('sale-ts');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  b.sys({ t: 'zone_added', zoneId: 'fa', name: 'จันทเขลม' });
  for (const p of ['a1', 'a4']) ready(b, p);
  for (let n = 1; n <= 7; n++) b.acceptAt('a1', n);
  for (let n = 1; n <= 4; n++) b.acceptAt('a4', n);
  const big = new LogBuilder('sale-big');
  big.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  big.sys({ t: 'price_set', satangPerKg: 4_691_356, indexRef: '' });
  big.sys({ t: 'pile_added', pileId: 'a1', zoneId: 'fa', name: 'a1', tareG: 2_000, stdNetG: 50_000 });
  big.acceptAt('a1', 1);
  await seedEvents(page, [...b.build(), ...big.build()].map((e) => ({ ...e, ts: now })));
  await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), [
    finEvent(1, now, 'd-red', loan(RED, 1_579_000)),
    finEvent(2, now, 'd-nat', loan(NAT, 835_000)),
    finEvent(3, now, 'exp-nat', owesNat(64_000)),
    finEvent(4, now, 'plan-red', { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 }),
  ]);
  await page.evaluate((size) => localStorage.setItem('mon-farm:text-size', size), size);
}

/** Pixel sizes on the tour at each text size: the header title (20), the typed short reading (40) and the check total (26), × textScale. */
const AT = { s: { title: 18, reading: 35, total: 23 }, m: { title: 20, reading: 40, total: 26 }, l: { title: 23, reading: 45, total: 29 } } as const;

/**
 * The open screens of TS-8, at one text size. At L: nothing cut, "…" or past the screen, and every target ≥ 48.
 * At S and M only the targets are asserted (2026-11-07: short name chips were 39–47 wide below L); the fit
 * findings at S/M are logged, not asserted — those sizes were not part of TS-8.
 */
async function tour(page: Page, size: keyof typeof AT) {
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seed(page, size);
  const problems: Record<string, string[]> = {};
  const targets: Record<string, string[]> = {};
  const check = async (name: string) => {
    await page.waitForTimeout(300);
    // L must really be on (the earlier large-text checks passed at M): the header title is 20 × 1.125.
    expect(await fontPx(page, 'screen-title'), `${name}: at ${size}`).toBe(AT[size].title);
    problems[name] = await textFit(page);
    targets[name] = await smallTargets(page);
    if (size === 'l') await shot(page, `l-${name}`);
  };
  const open = async (path: string, ready: string, name: string) => {
    await page.goto(path);
    await expect(id(ready)).toBeVisible();
    await check(name);
  };

  await page.goto('/v2');
  await expect(id('screen-title')).toBeVisible();
  await check('home');
  await id('open-menu').click();
  await check('home-menu');
  await open('/v2/device', 'device', 'device');
  // E04-S15: the counter and the basket history.
  await open('/v2/sale/sale-ts/counter?point=a1', 'counter', 'counter');
  // E01-S20 NP-8: the short-basket sheet with its pad, typed figure scaled; save and cancel stay on screen.
  await id('tool-short').click();
  await expect(id('reading-pad')).toBeVisible();
  expect(await fontPx(page, 'reading-scale-value')).toBe(AT[size].reading);
  await expect(id('short-save')).toBeInViewport();
  await check('short-sheet');
  await open('/v2/sale/sale-ts/history?point=a1', 'history', 'history');
  // E05-S11: the close-out summary (A1) and its sheets, the payment, the buyer's page at 2,345,678.00 (CO-16, CO-20).
  // A size passed as a number prop (the sale totals) follows the setting too: 26 × 1.125.
  await open('/v2/sale/sale-ts/check', 'check-card', 'sale-check');
  expect(await fontPx(page, 'check-total')).toBe(AT[size].total);
  await open('/v2/sale/sale-ts/settlement', 'co-summary', 'a1-summary');
  await id('co-sale-open').click();
  await check('a4-sale-sheet');
  await page.keyboard.press('Escape');
  await page.goto('/v2/sale/sale-ts/settlement');
  await id('co-debt-open').click();
  await check('a2-debt-sheet');
  await id('co-debt-ok').click();
  await id('co-owed-open').click();
  await check('a26-owed-sheet');
  await id('co-owed-ok').click();
  await check('a3-summary-ready');
  await id('co-confirm').click();
  await expect(id('payment')).toBeVisible();
  await check('a6-payment');
  await id('close-sale').click();
  await expect(id('sales')).toBeVisible();
  // E06-S08: นัด's account with the transfer waiting, the sheet (M5) and "got less" on the pad (M7).
  await page.goto('/v2/debt/nat?name=%E0%B8%99%E0%B8%B1%E0%B8%94');
  await expect(id('rp-row-sale-ts-transfer')).toBeVisible();
  await id('rp-row-sale-ts-transfer').click();
  await check('m5-sheet');
  await id('rp-sheet-less').click();
  await check('m7-less');
  await open('/v2/sale/sale-big/buyer-view', 'buyer-view', 'a7-buyer-view-big');
  await open('/v2/sale/sale-big/settlement', 'co-summary', 'a1-summary-big');
  // E06-S08: the debt list and an account (PR-11).
  await open('/v2/debts', 'debt-account-red', 'm1-debts');
  await page.goto('/v2/debt/red?name=%E0%B9%81%E0%B8%94%E0%B8%87');
  await expect(id('debt-balance')).toBeVisible();
  await check('m3-account');
  // E01-S20: the number fields and their pads (NP-9).
  await open('/v2/dev/number-fields', 'qty', 'np-fields');
  await id('price').click();
  await check('np-money-pad');
  // E11-S11: the fertilizer order (UI-4: the main button stays on screen).
  await open('/v2/order', 'ordc-empty', 'fert-order');
  await expect(id('ordc-add')).toBeInViewport();
  await id('ordc-add').click();
  await id('ordc-pick-new').click();
  await check('fert-new-item');

  console.log(`E03-S08 touch targets under 48 at ${size}: ${JSON.stringify(targets)}`);
  test.info().annotations.push({ type: 'targets', description: JSON.stringify(targets) });
  const none = (r: Record<string, string[]>) => Object.fromEntries(Object.keys(r).map((k) => [k, []]));
  if (size === 'l') expect(problems).toEqual(none(problems));
  else console.log(`text fit at ${size}: ${JSON.stringify(problems)}`);
  expect(targets, `touch targets ≥ 48 at ${size} (§12.10 #6)`).toEqual(none(targets));
  expect(errors).toEqual([]);
}

test('the largest text size: nothing cut, "…" or past the screen on the open screens (TS-8)', async ({ page }) => {
  test.setTimeout(180_000);
  await tour(page, 'l');
});

for (const size of ['m', 's'] as const) {
  test(`text size ${size}: every touch target on the open screens is at least 48 wide and tall`, async ({ page }) => {
    test.setTimeout(180_000);
    await tour(page, size);
  });
}

test('×1.3 on top of L: the header title and the Banner still fit (TS-6, TS-7)', async ({ page }) => {
  const id = on(page);
  await seed(page, 'l');
  for (const [path, ready, name] of [
    ['/v2/sale/sale-ts/settlement', 'co-summary', 'x130-a1-summary'],
    ['/v2/sales', 'sales', 'x130-sales-banner'],
    ['/v2/fertilizer-settings', 'screen-title', 'x130-fert-settings'],
  ] as const) {
    await page.goto(path);
    await expect(id(ready)).toBeVisible();
    await page.waitForTimeout(300);
    expect(await fontPx(page, 'screen-title'), `${name}: at L`).toBe(23);
    await multiplyFonts(page, 1.3 / 1.125);
    expect(await textFit(page), name).toEqual([]);
    await shot(page, name);
  }
});
