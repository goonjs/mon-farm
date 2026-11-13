import { expect, test, type Page } from './test';

import { FIXTURE_GROUP_ID } from '../src/core/fixtures';
import type { ExpenseFields, FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { evidence, seedPeople } from './fixtures';
import { textFit } from './text-fit';

/**
 * E16-S02/S03 on the real web build, offline: the main page, the fertilizer page with the split inside a
 * card (mockup v3 screens 1–8), at text size M and L (S03 test plan: 7 tappers, nothing cut at the largest
 * size). The main page must fit one screen (phone-form-ux rule 1, FZ-1 test plan); the fertilizer page may
 * scroll by design but nothing may be cut off. Screenshots go to docs/ when UPDATE_SCREENSHOTS=1.
 */

test.skip(({ viewport }) => !viewport || viewport.width > viewport.height, 'fertilizing screens are portrait-first');

const SHOTS = 'docs/ux/screenshots/v2/care/fertilizing';
const TAPPERS = ['แดง', 'ดำ', 'สมชาย', 'สมหญิง', 'บุญมี', 'ประเสริฐ', 'ทองดี'].map((name, i) => ({ id: `t${i + 1}`, name }));

const finEvent = (n: number, targetId: string, payload: FinancePayload): FinanceEvent => ({
  id: `e2e-fz-${n}`,
  groupId: FIXTURE_GROUP_ID,
  deviceSeq: n,
  ts: Date.now(),
  actor: { userId: 'pre-login', deviceId: 'dev-seed' },
  source: 'app',
  targetId,
  baseEventId: null,
  payload,
});

const item = (o: { formula: string; sacks: number; perSack: number; shop: string; date: string; stage?: 'actual' | 'committed' }): FinancePayload => {
  const net = o.sacks * o.perSack * 100;
  const fields: ExpenseFields = {
    amountSatang: net,
    date: o.date,
    stage: o.stage ?? 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: o.formula,
    note: '',
    payer: { id: 'farm', name: 'เงินสวน' },
    orderId: `ord-${o.formula}-${o.perSack}`,
    discountSatang: 0,
    line: { qty: o.sacks, unit: 'กระสอบ', grossSatang: net, itemDiscountSatang: 0 },
    fertilizer: { type: 'chemical', formula: o.formula, brand: '', sackKg: 50, reasons: [], zones: [], shop: o.shop, orderedBy: '', sacks: o.sacks },
  };
  return { t: 'expense_created', fields };
};

async function seed(page: Page, size: 'm' | 'l', tappers = TAPPERS.slice(0, 3)) {
  await seedPeople(page, tappers);
  await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), [
    finEvent(1, 'ord-a-1', item({ formula: 'ดีเกลือ', sacks: 60, perSack: 300, shop: 'ร้าน ก.', date: '2026-10-02' })),
    finEvent(2, 'ord-b-1', item({ formula: 'ดีเกลือ', sacks: 20, perSack: 320, shop: 'ร้าน ข.', date: '2026-10-09' })),
    finEvent(3, 'ord-c-1', item({ formula: '46-0-0', sacks: 20, perSack: 780, shop: 'ร้าน ก.', date: '2026-10-09' })),
    finEvent(4, 'ord-d-1', item({ formula: 'ขี้ไก่', sacks: 50, perSack: 100, shop: 'ร้าน ค.', date: '2026-11-01', stage: 'committed' })),
    // Before the cutoff (D-96): counts as used up, never a card.
    finEvent(5, 'ord-e-1', item({ formula: 'ยูเรีย', sacks: 10, perSack: 700, shop: 'ร้าน ก.', date: '2026-09-30' })),
  ]);
  await page.evaluate((s) => localStorage.setItem('mon-farm:text-size', s), size);
}

const ratio = (page: Page) => page.evaluate(() => {
  // The main page's own ScrollView: content height over its visible height.
  const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter((el) => getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll');
  const main = scrollers.sort((a, b) => b.clientHeight - a.clientHeight)[0];
  return main ? main.scrollHeight / main.clientHeight : document.scrollingElement!.scrollHeight / innerHeight;
});

async function pad(page: Page, field: string, digits: string) {
  await page.getByTestId(field).click();
  for (const k of digits) await page.getByTestId(`${field}-pad-key-${k}`).click();
  await page.getByTestId(`${field}-pad-key-done`).click();
}

for (const size of ['m', 'l'] as const) {
  test(`E16 fertilizing at text size ${size.toUpperCase()}: one-screen main page, split in the card, nothing cut (offline)`, async ({ page, context }) => {
    await seed(page, size);
    await page.goto('/v2/fertilizing');
    await context.setOffline(true);
    const fits: Record<string, string[]> = {};

    await expect(page.getByTestId('fz-ferts')).toContainText('เลือกปุ๋ยที่ใส่ · แบ่งคนกรีด');
    expect(await ratio(page)).toBeLessThanOrEqual(1);
    fits.main = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-1-main.png`);

    await page.getByTestId('fz-ferts').click();
    await expect(page.locator('[data-testid^="fz-card-"][data-testid$="-stock"]')).toHaveCount(3);
    await expect(page.getByTestId('fz-ordered')).toContainText('ขี้ไก่ 50 ถุง');
    fits.cards = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-2-cards.png`);

    await page.getByTestId('fz-card-0').click();
    fits.open = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-3-open.png`);
    await pad(page, 'fz-card-0-take-t1', '25');
    await pad(page, 'fz-card-0-take-t2', '20');
    await expect(page.getByTestId('fz-card-0-auto-t3')).toBeVisible();
    await expect(page.getByTestId('fz-card-0-given')).toContainText('แบ่งให้คนกรีดรวม 60 ถุง');
    fits.split = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-4-split.png`);

    await page.getByTestId('fz-card-2').click();
    await expect(page.getByTestId('fz-card-0-expand')).toContainText('แบ่งครบ');
    await page.getByTestId('fz-card-2-collapse').click();
    fits.collapsed = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-5-two-cards.png`);

    // Part split → the three-way question (screen 8).
    await page.getByTestId('fz-card-2-expand').click();
    await pad(page, 'fz-card-2-take-t1', '5');
    await page.getByTestId('fz-apply').click();
    await expect(page.getByTestId('fz-partial-sheet')).toContainText('เหลือ 15 ถุง ไม่มีใครรับ');
    fits.partial = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-8-partial.png`);
    await page.getByTestId('fz-partial-farm').click();

    await expect(page.getByTestId('fz-ferts')).toContainText('ดีเกลือ 300฿ · 60 ถุง · แบ่งครบ');
    await expect(page.getByTestId('fz-ferts')).toContainText('46-0-0 780฿ · 20 ถุง · แบ่งครบ');
    expect(await ratio(page)).toBeLessThanOrEqual(1);
    fits.chosen = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-6-chosen.png`);

    await page.getByTestId('fz-where').click();
    fits.where = await textFit(page);
    await evidence(page, `${SHOTS}/${size}-z2-where.png`);
    await page.getByTestId('fz-where-done').click();

    await page.getByTestId('fz-save').click();
    expect(fits).toEqual({ main: [], cards: [], open: [], split: [], collapsed: [], partial: [], chosen: [], where: [] });
  });
}

test('E16 seven tappers at the largest text size: two per line, the card grows and scrolls, nothing cut (offline)', async ({ page, context }) => {
  await seed(page, 'l', TAPPERS);
  await page.goto('/v2/fertilizing');
  await context.setOffline(true);
  await page.getByTestId('fz-ferts').click();
  await page.getByTestId('fz-card-0').click();
  const top = await Promise.all(TAPPERS.slice(0, 2).map((p) => page.getByTestId(`fz-card-0-take-${p.id}`).boundingBox()));
  expect(Math.abs((top[0]?.y ?? 0) - (top[1]?.y ?? 1))).toBeLessThan(2);
  await page.getByTestId(`fz-card-0-take-${TAPPERS[6].id}`).scrollIntoViewIfNeeded();
  expect(await textFit(page)).toEqual([]);
  await evidence(page, `${SHOTS}/l-7-tappers.png`, { fullPage: true });
});

test('E16 empty stock says when fertilizer shows up and links to orders not yet received (offline)', async ({ page, context }) => {
  await seedPeople(page, TAPPERS.slice(0, 3));
  await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), [
    finEvent(1, 'ord-d-1', item({ formula: 'ขี้ไก่', sacks: 50, perSack: 100, shop: 'ร้าน ค.', date: '2026-11-01', stage: 'committed' })),
  ]);
  await page.goto('/v2/fertilizing');
  await context.setOffline(true);
  await page.getByTestId('fz-ferts').click();
  await expect(page.getByTestId('fz-empty')).toContainText('ไม่มีปุ๋ยในสต็อก');
  await expect(page.getByTestId('fz-apply')).toBeDisabled();
  expect(await textFit(page)).toEqual([]);
  await evidence(page, `${SHOTS}/m-7-empty.png`);
});
