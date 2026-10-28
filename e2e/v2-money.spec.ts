import { expect, test, type Page } from '@playwright/test';

import { evidence, seedPeople } from './fixtures';

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
  if (o.amount) await page.getByTestId('expense-amount').fill(o.amount);
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
  await page.getByTestId('expense-date').fill(o.date);
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
  await page.getByTestId('repay-amount').fill('300');
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
  // Details later: tell แดง takes both sacks (default 50%, deducted when the rubber is sold).
  await page.getByTestId('ordc-saved-details').click();
  await page.locator('[data-testid^="ordd-"][data-testid$="-tappers"]').click();
  await page.getByTestId('ordd-tap-add').click();
  await page.getByTestId('ordd-pick-person-daeng').click();
  await expect(page.getByTestId('ordd-tap-person-daeng-part')).toContainText('2,000.00');
  await page.getByTestId('ordd-tap-done').click();
  // Back to the tapper's account (the order replaced the add form): the fertilizer debt is there.
  await page.getByTestId('ordd-back').click();
  await expect(page.getByTestId('debt-balance')).toContainText('2,000.00');

  await page.getByTestId('debt-add').click();
  await page.getByTestId('debt-amount').fill('3000');
  await page.getByTestId('debt-date').fill('2026-09-10');
  await page.getByTestId('debt-save').click();

  await expect(page.getByTestId('debt-balance')).toContainText('5,000.00');
  await expect(page.getByTestId('debt-summary-balance')).toContainText('5,000.00');
  await evidence(page, `${SHOTS}/22-debt-account.png`, { fullPage: true });

  await page.getByTestId('debt-pay').click();
  await page.getByTestId('debt-pay-amount').fill('500');
  await expect(page.getByTestId('debt-pay-after')).toContainText('4,500.00');
  await evidence(page, `${SHOTS}/24-debt-pay.png`, { fullPage: true });
  await page.getByTestId('debt-pay-save').click();
  await expect(page.getByTestId('debt-balance')).toContainText('4,500.00');
});
