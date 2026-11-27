import { expect, test, type Page } from './test';

import { evidence, seedMaster, seedPeople } from './fixtures';
import { smallTargets, textFit } from './text-fit';
import { tileSpill } from './tile-spill';
import { pickDate } from './pick-date';

/**
 * v2 money screens (D-82) in the real web build, portrait, offline: the
 * v1.1.0 farm mockup section 7 — record expenses, see totals by stage, set a
 * payer for several at once, see what the farm owes back and repay it oldest
 * first. Screenshots are evidence for the owner, side by side with the
 * mockup frames.
 */

const SHOTS = 'docs/ux/screenshots/v2/money';

test.skip(({ viewport }) => !viewport || viewport.width > viewport.height, 'money screens are portrait-first');

async function addExpense(page: Page, o: { amount?: string; date: string; stage?: 'committed' | 'planned'; unknown?: boolean; cat: string; payer?: string; newPayer?: string }) {
  await page.getByTestId('expense-new').click();
  await expect(page.getByTestId('expense-save')).toBeVisible();
  // The amount is typed on the app's number pad (E01-S20), then ตกลง.
  if (o.amount) {
    await typeOnPad(page, 'expense-amount', o.amount);
    await page.getByTestId('expense-amount-done').click();
  }
  // Simple design (owner 2026-10-23): five category tiles, the rest under "อื่น ๆ".
  const tile = page.getByTestId(`expense-cat-${o.cat}`);
  if (await tile.count()) await tile.click();
  else {
    await page.getByTestId('expense-cat-more').click();
    await page.getByTestId(`expense-catall-${o.cat}`).click();
  }
  // Date and stage sit behind "เพิ่มรายละเอียด".
  await page.getByTestId('expense-details').click();
  if (o.stage) await page.getByTestId(`expense-stage-${o.stage}`).click();
  await pickDate(page, 'expense-date', o.date);
  await page.getByTestId('expense-details-done').click();
  if (o.unknown) await page.getByTestId('expense-unknown').click();
  if (o.newPayer || o.payer) {
    await page.getByTestId('expense-payer-row').click();
    if (o.newPayer) {
      await page.getByTestId('expense-payer-add').click();
      await page.getByTestId('expense-payer-name').fill(o.newPayer);
      await page.getByTestId('expense-payer-add-save').click();
    } else {
      await page.getByTestId(`expense-payer-${o.payer}`).click();
    }
  }
}

/** Taps digits on a NumberPad field: opens its sheet, presses the keys (testID `<field>-pad-key-<k>`). */
async function typeOnPad(page: Page, field: string, digits: string) {
  await page.getByTestId(field).click();
  await expect(page.getByTestId(`${field}-pad`)).toBeVisible();
  for (const k of digits) await page.getByTestId(`${field}-pad-key-${k}`).click();
}

/** The payer sheet is open after `addExpense` with a payer: its owed preview, then close it. */
async function closePayer(page: Page) {
  if (await page.getByTestId('expense-payer-done').count()) await page.getByTestId('expense-payer-done').click();
}

test('v2 expenses, owed and repay — offline, end to end', async ({ page, context }) => {
  await page.goto('/v2/expenses');
  await context.setOffline(true);
  await expect(page.getByTestId('expenses-empty')).toBeVisible();

  // Nat pays the mower fuel himself → the farm owes Nat 640.
  await addExpense(page, { amount: '640', date: '2026-09-28', cat: 'cat-fuel', newPayer: 'นัด' });
  await expect(page.getByTestId('owed-preview')).toContainText('640.00');
  await closePayer(page);
  await evidence(page, `${SHOTS}/18-expense-form.png`, { fullPage: true });
  await page.getByTestId('expense-save').click();

  await addExpense(page, { amount: '400', date: '2026-09-22', cat: 'cat-repair', newPayer: 'อาจารย์สมหวัง' });
  await closePayer(page);
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '800', date: '2026-09-15', cat: 'cat-herbicide', payer: 'none' });
  await closePayer(page);
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '15000', date: '2026-10-31', stage: 'committed', cat: 'cat-salary', payer: 'farm' });
  await closePayer(page);
  await page.getByTestId('expense-save').click();
  // ปุ๋ย opens the shop order screen now (E11-S11); a planned unknown amount is shown with another category.
  await addExpense(page, { stage: 'planned', unknown: true, date: '2026-11-15', cat: 'cat-labour', payer: 'farm' });
  await closePayer(page);
  await page.getByTestId('expense-save').click();

  await expect(page.getByTestId('total-actual')).toContainText('1,840.00');
  await expect(page.getByTestId('total-committed')).toContainText('15,000.00');
  await expect(page.getByTestId('total-planned')).toContainText('ไม่ทราบ');
  await evidence(page, `${SHOTS}/19-expense-list.png`, { fullPage: true });

  // F7: no payer recorded → pick it and set the payer in the sheet.
  await page.getByTestId('filter-payer-missing').click();
  await page.locator('[data-testid^="expense-exp-"]').first().click();
  await expect(page.getByTestId('bulk-payer-save')).toBeVisible();
  await page.getByTestId('bulk-payer-add').click();
  await page.getByTestId('bulk-payer-name').fill('เจ้าของสวน');
  await page.getByTestId('bulk-payer-add-save').click();
  await expect(page.getByTestId('bulk-owed')).toContainText('800.00');
  await evidence(page, `${SHOTS}/19b-bulk-payer.png`, { fullPage: true });
  await page.getByTestId('bulk-payer-save').click();
  await page.getByTestId('filter-payer-missing').click();

  // ค้างใคร, then repay อาจารย์สมหวัง.
  await context.setOffline(false);
  await page.goto('/v2/owed');
  await context.setOffline(true);
  await expect(page.getByTestId('owed-total')).toContainText('1,840.00');
  await evidence(page, `${SHOTS}/20-owed.png`, { fullPage: true });
  await page.locator('[data-testid^="owed-open-"]').filter({ hasText: 'อาจารย์สมหวัง' }).click();
  await page.locator('[data-testid^="owed-repay-"]').click();
  await typeOnPad(page, 'repay-amount', '300');
  await page.getByTestId('repay-amount-done').click();
  await expect(page.getByTestId('repay-save')).toContainText('300.00');
  await evidence(page, `${SHOTS}/21-repay.png`, { fullPage: true });
  await page.getByTestId('repay-save').click();
  await expect(page.getByTestId('owed-total')).toContainText('1,540.00');
});

test('v2 worker debts — fertilizer via the shop order, account reconciliation, pay back outside a sale (offline)', async ({ page, context }) => {
  await seedPeople(page, [{ id: 'person-daeng', name: 'แดง' }]);
  await page.goto('/v2/debts');
  await context.setOffline(true);
  await page.getByTestId('debt-person-person-daeng').click();
  await page.getByTestId('debt-add').click();

  await evidence(page, `${SHOTS}/23-debt-add.png`, { fullPage: true });
  // Kind ปุ๋ย opens the shop order screen (E11-S11); who taps is told later, on the order's detail page.
  await page.getByTestId('debt-kind-fertilizer').click();
  await expect(page.getByTestId('ordc-empty')).toBeVisible();
  await page.getByTestId('ordc-add').click();
  await page.getByTestId('ordc-pick-new').click();
  await page.getByTestId('ordc-formula').fill('ปุ๋ยรอบ ก.ย.');
  await page.getByTestId('ordc-new-done').click();
  // Numbers go in on the on-screen pad: 2 sacks, a typed total of 4,000 for the item.
  await typeOnPad(page, 'ordc-qty', '2');
  await page.getByTestId('ordc-qty-pad-key-done').click();
  await page.getByTestId('ordc-price-mode-total').click();
  await typeOnPad(page, 'ordc-price', '4000');
  await page.getByTestId('ordc-price-done').click();
  await expect(page.getByTestId('ordc-line-total-amount')).toContainText('4,000.00');
  await page.getByTestId('ordc-item-done').click();
  await page.getByTestId('ordc-stage-actual').click();
  await expect(page.getByTestId('ordc-total')).toContainText('4,000.00');
  await page.getByTestId('ordc-save').click();
  await expect(page.getByTestId('ordc-saved')).toBeVisible();
  // E11-S17 / E16: the split is on the fertilizing, not the order. From the received order, "ใส่ปุ๋ยจากใบนี้"
  // opens fertilizing with this order's fertilizer picked; แดง takes both sacks (default 50%, deducted at the sale).
  await page.getByTestId('ordc-saved-details').click();
  await expect(page.locator('[data-testid^="ordd-"][data-testid$="-tappers"]')).toHaveCount(0);
  await page.getByTestId('ordd-fertilize').click();
  await expect(page.getByTestId('fz-ferts')).toContainText('ยังไม่แบ่ง');
  await page.getByTestId('fz-ferts').click();
  await page.getByTestId('fz-card-0-expand').click();
  await typeOnPad(page, 'fz-card-0-take-person-daeng', '2');
  await page.getByTestId('fz-card-0-take-person-daeng-pad-key-done').click();
  await expect(page.getByTestId('fz-card-0-debt-person-daeng')).toContainText('2,000');
  await page.getByTestId('fz-apply').click();
  await expect(page.getByTestId('fz-ferts')).toContainText('แบ่งครบ');
  await page.getByTestId('fz-save').click();
  // Back to the order, then the tapper's account (the order replaced the add form): one fertilizing lump is there.
  await expect(page.getByTestId('ordd-back')).toBeVisible();
  await page.getByTestId('ordd-back').click();
  await expect(page.getByTestId('debt-balance')).toContainText('2,000.00');
  // Reloaded (the web build has no offline page cache, so the network is back for the page load only),
  // the lump is still there: it was written offline to the local log (E16-S03 e2e).
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByTestId('debt-balance')).toContainText('2,000.00');
  await expect(page.locator('[data-testid^="debt-line-fz-"]')).toContainText('ใส่ปุ๋ย');

  await page.getByTestId('debt-add').click();
  await typeOnPad(page, 'debt-amount', '3000');
  await page.getByTestId('debt-amount-done').click();
  await pickDate(page, 'debt-date', '2026-09-10');
  await page.getByTestId('debt-save').click();

  await expect(page.getByTestId('debt-balance')).toContainText('5,000.00');
  await expect(page.getByTestId('debt-summary-balance')).toContainText('5,000.00');
  await evidence(page, `${SHOTS}/22-debt-account.png`, { fullPage: true });

  await page.getByTestId('debt-pay').click();
  await typeOnPad(page, 'debt-pay-amount', '500');
  await page.getByTestId('debt-pay-amount-done').click();
  await expect(page.getByTestId('debt-pay-after')).toContainText('4,500.00');
  await evidence(page, `${SHOTS}/24-debt-pay.png`, { fullPage: true });
  await page.getByTestId('debt-pay-save').click();
  await expect(page.getByTestId('debt-balance')).toContainText('4,500.00');
});

test('a saved fertilizer never bought: picking it fills its name, one tap puts it on the order (offline)', async ({ page, context }) => {
  await page.goto('/v2/order');
  await context.setOffline(true);
  // Remember "ดีเกลือ" from "ปุ๋ยใหม่" (ticked by default), then close the item sheet without adding it: saved, never bought.
  await page.getByTestId('ordc-add').click();
  await page.getByTestId('ordc-pick-new').click();
  await page.getByTestId('ordc-formula').fill('ดีเกลือ');
  await page.getByTestId('ordc-new-done').click();
  await expect(page.getByTestId('ordc-item-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ordc-item-sheet')).toHaveCount(0);

  await page.getByTestId('ordc-add').click();
  await expect(page.getByTestId('ordc-pick-sheet')).toContainText('ยังไม่เคยซื้อ');
  await page.locator('[data-testid^="ordc-pick-option|"]').filter({ hasText: 'ดีเกลือ' }).click();
  await expect(page.getByTestId('ordc-formula')).toHaveValue('ดีเกลือ');
  await evidence(page, `${SHOTS}/31-pick-saved-never-bought.png`);
  await page.getByTestId('ordc-new-done').click();
  await expect(page.getByTestId('ordc-item-name')).toHaveText('ดีเกลือ');
});

test('E11-S13 a misspelt fertilizer name is fixed on a saved order, in the saved list too (offline)', async ({ page, context }) => {
  await page.goto('/v2/order');
  await context.setOffline(true);
  await page.getByTestId('ordc-add').click();
  await page.getByTestId('ordc-pick-new').click();
  await page.getByTestId('ordc-formula').fill('ดีกลือ');
  await page.getByTestId('ordc-new-done').click();
  await typeOnPad(page, 'ordc-qty', '38');
  await page.getByTestId('ordc-qty-pad-key-done').click();
  await typeOnPad(page, 'ordc-price', '270');
  await page.getByTestId('ordc-price-done').click();
  await page.getByTestId('ordc-item-done').click();
  await page.getByTestId('ordc-save').click();
  await page.getByTestId('ordc-saved-details').click();

  await page.locator('[data-testid^="ordd-"][data-testid$="-edit"]').first().click();
  await page.getByTestId('ordd-edit-rename').click();
  await expect(page.getByTestId('ordd-edit-name')).toHaveValue('ดีกลือ');
  await expect(page.getByTestId('ordd-edit-fix-list')).toHaveCount(0);
  await page.getByTestId('ordd-edit-name').fill('ดีเกลือ');
  await expect(page.getByTestId('ordd-edit-fix-list')).toBeVisible();
  await evidence(page, `${SHOTS}/30-order-item-rename.png`);
  await page.getByTestId('ordd-edit-save').click();
  await expect(page.getByTestId('ordd-edit-sheet')).toHaveCount(0);
  await expect(page.getByText('ดีเกลือ', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('ordd-total')).toContainText('10,260.00');

  // Kept across a reload (the local event log; the page itself is fetched, then offline again), and the saved list now offers the fixed name only.
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByText('ดีเกลือ', { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
  await page.goto('/v2/order');
  await context.setOffline(true);
  await page.getByTestId('ordc-add').click();
  await expect(page.getByTestId('ordc-pick-sheet')).toContainText('ดีเกลือ');
  await expect(page.getByTestId('ordc-pick-sheet')).not.toContainText('ดีกลือ');
});

test('a sack of 2.5 กก. can be typed with a decimal point and is kept as 2.5 (offline)', async ({ page, context }) => {
  await page.goto('/v2/order');
  await context.setOffline(true);
  await page.getByTestId('ordc-add').click();
  await page.getByTestId('ordc-pick-new').click();
  await page.getByTestId('ordc-formula').fill('ปุ๋ยเกล็ด');
  await page.getByTestId('ordc-kg-other').click();
  await typeOnPad(page, 'ordc-kg-value', '2.5');
  await expect(page.getByTestId('ordc-kg-value-display')).toContainText('2.5');
  await evidence(page, `${SHOTS}/32-sack-kg-decimal-pad.png`);
  await page.getByTestId('ordc-kg-value-done').click();
  await expect(page.getByTestId('ordc-kg-value')).toContainText('2.5');
  await page.getByTestId('ordc-new-done').click();
  await expect(page.getByTestId('ordc-item-sheet')).toContainText('2.5 กก.');
  await typeOnPad(page, 'ordc-qty', '4');
  await page.getByTestId('ordc-qty-pad-key-done').click();
  await expect(page.getByTestId('ordc-item-sheet')).toContainText('รวม 10 กก.');
  await evidence(page, `${SHOTS}/33-sack-kg-decimal-item.png`);
});

/** E01-S21 PK-5 and E01-S22 DP-6 kept as a guard (review of PR 193 N4): pickers and dates fit at 320/360, text M and L. */
for (const width of [320, 360]) {
  for (const size of ['m', 'l'] as const) {
    test(`pickers and dates: nothing cut, targets ≥ 48, at ${width} px text ${size.toUpperCase()}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedPeople(page, [{ id: 'p-long', name: 'สมหวังผู้ช่วยกรีดยางแปลงหลังบ้านริมคลองใหญ่' }]);
      await page.goto('/v2/expense/new');
      await page.getByTestId('expense-details').click();
      await page.getByTestId('expense-date').click();
      for (const id of ['prevYear', 'prev', 'next', 'nextYear']) expect((await page.getByTestId(`expense-date-picker-${id}`).boundingBox())!.width).toBeGreaterThanOrEqual(48);
      expect(await textFit(page)).toEqual([]);
      await page.getByTestId('expense-date-picker-done').click();
      expect((await page.getByTestId('expense-date').boundingBox())!.height).toBeGreaterThanOrEqual(48);
      expect(await textFit(page)).toEqual([]);
      await page.goto('/v2/order');
      const [shop, date] = await Promise.all(['ordc-shop', 'ordc-date'].map((id) => page.getByTestId(id).boundingBox()));
      expect(date!.y).toBeGreaterThan(shop!.y);
      expect(await textFit(page)).toEqual([]);
    });
  }
}


/**
 * E01-S28 round 1, in the real web build at 390×844, offline. The finance scope arrives as a pull would
 * store it (already synced, `kind` this build's event union does not carry): it is no sale, and a group
 * minimum above this build closes the money screens with "อัปเดตแอปก่อนใช้หน้าเงิน". A money write stays
 * in the local finance log: nothing enters the outbox (round 2 moves finance into the event log).
 */
const FIN_SHOTS = 'docs/ux/screenshots/e01-s28';

/** Rows as a pull stores them (`pending: 0`), into the app's IndexedDB like `seedEvents`. */
async function seedPulled(page: Page, rows: readonly Record<string, unknown>[]) {
  await page.goto('/v2');
  await expect(page.getByTestId('sync-pill').first()).toBeVisible();
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('events', 'readwrite');
          for (const event of rows) tx.objectStore('events').put({ id: event.id, saleId: event.saleId, ts: event.ts, deviceSeq: event.deviceSeq, pending: 0, event });
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
    rows as Record<string, unknown>[],
  );
}

/** Every row of the app's event log, with its outbox flag. */
function eventRows(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ saleId: string; pending: number }[]>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('events', 'readonly').objectStore('events').getAll();
          req.onsuccess = () => (open.result.close(), resolve(req.result as { saleId: string; pending: number }[]));
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

const scopeRow = (id: string, kind: string, payload: unknown) => ({
  id,
  groupId: 'group-1',
  saleId: 'farm-finance',
  seq: 1,
  deviceSeq: 1,
  ts: Date.now() + 60_000,
  mono: 1,
  actor: { userId: 'user-other', deviceId: 'dev-other' },
  source: 'app',
  kind,
  payload,
});

test('E01-S28 r1: the finance scope is no sale, and a higher group minimum closes the money screens (offline)', async ({ page, context }) => {
  await seedPulled(page, [scopeRow('fin-1', 'finance', { t: 'category_added', name: 'ค่าไฟ' }), scopeRow('min-1', 'app_min', { minApp: 99 })]);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('v2-home')).toBeVisible();
  // No "การขายที่ยังไม่ปิด" row for the finance scope (S28-AC12 ข 2). The home shows "nothing to know" while it
  // still reads too, so give the read time to land (on dev the row is there by then); the start check below is exact.
  await expect(page.getByTestId('home-to-know')).toContainText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ');
  await page.waitForTimeout(1_500);
  await expect(page.getByTestId('home-open-sale')).toHaveCount(0);
  await evidence(page, `${FIN_SHOTS}/after-home.png`);

  // The sales list is empty, not one blank row (S28-AC12 ข 5).
  await page.goto('/v2/sales');
  await expect(page.getByTestId('sales-start')).toBeVisible();
  await expect(page.getByTestId('sale-row-farm-finance')).toHaveCount(0);

  await page.goto('/v2/sale/start');
  await expect(page.getByTestId('sale-start')).toBeVisible();
  expect(page.url()).toContain('/v2/sale/start');

  for (const path of ['/v2/expenses', '/v2/debts', '/v2/owed', '/v2/expense/new']) {
    await page.goto(path);
    await expect(page.getByTestId('money-update-app')).toBeVisible();
    await expect(page.getByText('อัปเดตแอปก่อนใช้หน้าเงิน')).toBeVisible();
    await expect(page.getByTestId('expenses-empty')).toHaveCount(0);
  }
  await page.goto('/v2/expenses');
  await expect(page.getByTestId('money-update-app')).toBeVisible();
  expect(await textFit(page)).toEqual([]);
  await evidence(page, `${FIN_SHOTS}/after-money-gate.png`);
});

test('E01-S28 r1: with no group minimum a money write stays local — nothing enters the outbox (offline)', async ({ page, context }) => {
  await page.goto('/v2/expenses');
  await context.setOffline(true);
  await expect(page.getByTestId('expenses-empty')).toBeVisible();
  await expect(page.getByTestId('money-update-app')).toHaveCount(0);
  await addExpense(page, { amount: '250', date: '2026-11-20', cat: 'cat-fuel', payer: 'none' });
  await closePayer(page);
  await page.getByTestId('expense-save').click();
  await expect(page.getByTestId('expenses-empty')).toHaveCount(0);
  expect(await eventRows(page)).toEqual([]);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('mon-farm:finance-events') ?? '[]') as unknown[]);
  expect(local.length).toBeGreaterThan(0);
});

/**
 * E01-S25 (choice tiles, round 2) on the real build: the shared tiles fit and
 * keep ≥ 48 targets at 320/360 px with text M and L (CT-13), and the picks
 * behave as the owner answered (CT-6: another payer switches at once, on a
 * full page (CT-15); CT-8: date quick picks are plain links on one line).
 *
 * SHOT_DIR=<folder> also saves 390×844 pictures for the side-by-side with the
 * mockup (evidence for the dashboard card; nothing is written to docs/).
 */
const LONG = { id: 'p-long', name: 'สมหวังผู้ช่วยกรีดยางแปลงหลังบ้านริมคลองใหญ่' };
const shots = process.env.SHOT_DIR;
const choiceShot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

async function checkChoiceFit(page: Page) {
  expect(await textFit(page)).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
}

// 390 px and text S added 2026-11-28: CT-13 names 320/360/390 × S/M/L (the 320/360 × M/L cases are unchanged).
for (const width of [320, 360, 390]) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`choice tiles fit at ${width} px text ${size.toUpperCase()} (E01-S25 CT-13)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedPeople(page, [LONG, { id: 'p-nat', name: 'นัด' }]);
      await page.goto('/v2/expense/new');
      await page.getByTestId('expense-payer-row').click();
      await expect(page.getByTestId(`expense-payer-${LONG.id}`)).toBeVisible();
      await checkChoiceFit(page);
      await page.getByTestId('expense-payer-done').click();
      await page.getByTestId('expense-cat-more').click();
      await expect(page.getByTestId('expense-catall-cat-fertilizer')).toBeVisible();
      await checkChoiceFit(page);
      // Picking a category closes the sheet (at 320 px text L it covers the backdrop).
      await page.getByTestId('expense-catall-cat-other').click();
      await page.getByTestId('expense-details').click();
      await page.getByTestId('expense-date').click();
      await expect(page.getByTestId('expense-date-picker-yesterday')).toBeVisible();
      await checkChoiceFit(page);
      await page.goto('/v2/order');
      await page.getByTestId('ordc-add').click();
      await page.getByTestId('ordc-pick-new').click();
      await expect(page.getByTestId('ordc-kg-other')).toBeVisible();
      await checkChoiceFit(page);
    });

    // CT-13 on the other callers of the shared pieces: the expense form and its details sheet (B stage, F farms
    // with a long farm name).
    test(`more choice callers fit at ${width} px text ${size.toUpperCase()} (E01-S25 CT-13)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedPeople(page, [LONG, { id: 'p-nat', name: 'นัด' }]);
      await seedMaster(page, [
        { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
        { t: 'property_added', propertyId: 'fb', name: 'บ้านบนริมคลองใหญ่หลังวัด', crop: 'rubber' },
      ]);
      await page.goto('/v2/expense/new');
      await expect(page.getByTestId('expense-details')).toBeVisible();
      await checkChoiceFit(page);
      expect(await tileSpill(page), 'every tile holds its text').toEqual([]);
      await page.getByTestId('expense-details').click();
      await page.getByTestId('expense-stage-planned').click();
      await page.getByTestId('expense-farm-fb').click();
      await expect(page.getByTestId('expense-farm-fb')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('expense-stage')).toBeVisible();
      await checkChoiceFit(page);
      expect(await tileSpill(page), 'every tile holds its text').toEqual([]);
    });
  }
}

test('payer is style I: another person switches at once; date picks are links (E01-S25 CT-6, CT-8)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPeople(page, [{ id: 'p-nat', name: 'นัด' }, { id: 'p-daeng', name: 'แดง' }]);
  await seedMaster(page, [
    { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'property_added', propertyId: 'fb', name: 'บ้านบน', crop: 'rubber' },
  ]);
  await page.goto('/v2/expense/new');
  await page.getByTestId('expense-payer-row').click();
  // A full page, not a sheet over the form (owner rv245-07, 2026-11-23).
  await expect(page.getByTestId('expense-payer-page')).toBeVisible();
  await expect(page.getByTestId('expense-amount')).toHaveCount(0);
  const nat = page.getByTestId('expense-payer-p-nat');
  const daeng = page.getByTestId('expense-payer-p-daeng');
  const before = await nat.boundingBox();
  await nat.click();
  await expect(nat).toHaveAttribute('aria-selected', 'true');
  await choiceShot(page, 'b25-payer-i');
  await daeng.click();
  await expect(daeng).toHaveAttribute('aria-selected', 'true');
  await expect(nat).toHaveAttribute('aria-selected', 'false');
  // Picking never changes a tile's size (owner r2-cc-form: "ขนาดปุ่มต้องไม่เปลี่ยน").
  const after = await nat.boundingBox();
  expect({ w: after!.width, h: after!.height }).toEqual({ w: before!.width, h: before!.height });
  await page.getByTestId('expense-payer-done').click();

  await page.getByTestId('expense-cat-more').click();
  await choiceShot(page, 'b25-category-f');
  await page.getByTestId('expense-catall-cat-other').click();

  await page.getByTestId('expense-details').click();
  await page.getByTestId('expense-stage-planned').click();
  await page.getByTestId('expense-farm-fa').click();
  await expect(page.getByTestId('expense-farm-fa')).toHaveAttribute('aria-selected', 'true');
  await choiceShot(page, 'b25-details-f');
  await page.getByTestId('expense-date').click();
  const links = await Promise.all(['today', 'yesterday', 'twodays'].map((id) => page.getByTestId(`expense-date-picker-${id}`).boundingBox()));
  // Several on one line (owner 2026-11-21).
  expect(new Set(links.map((b) => Math.round(b!.y))).size).toBe(1);
  // No underline and no ✓: one-shot actions, nothing held (owner rv245-11, 2026-11-23).
  for (const id of ['today', 'yesterday', 'twodays']) {
    const link = page.getByTestId(`expense-date-picker-${id}`);
    expect(await link.evaluate((el) => [el, ...el.querySelectorAll('*')].map((n) => getComputedStyle(n).textDecorationLine).filter((d) => d !== 'none'))).toEqual([]);
    await expect(page.getByTestId(`expense-date-picker-${id}-tick`)).toHaveCount(0);
  }
  await choiceShot(page, 'b25-date-links');
});

test('order: sack sizes are style A (E01-S25 CT-7)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/v2/order');
  await page.getByTestId('ordc-add').click();
  await page.getByTestId('ordc-pick-new').click();
  await page.getByTestId('ordc-kg-25').click();
  await expect(page.getByTestId('ordc-kg-25')).toHaveAttribute('aria-selected', 'true');
  await choiceShot(page, 'b25-order-kg-a');
  await checkChoiceFit(page);
});
