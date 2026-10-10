import { expect, test, type Page } from '@playwright/test';

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
  if (o.stage) await page.getByTestId(`expense-stage-${o.stage}`).click();
  if (o.unknown) await page.getByTestId('expense-unknown').click();
  if (o.amount) await page.getByTestId('expense-amount').fill(o.amount);
  await page.getByTestId('expense-date').fill(o.date);
  await page.getByTestId(`expense-cat-${o.cat}`).click();
  if (o.newPayer) {
    await page.getByTestId('expense-payer-add').click();
    await page.getByTestId('expense-payer-name').fill(o.newPayer);
    await page.getByTestId('expense-payer-add-save').click();
  } else if (o.payer) {
    await page.getByTestId(`expense-payer-${o.payer}`).click();
  }
}

test('v2 expenses, owed and repay — offline, end to end', async ({ page, context }) => {
  await page.goto('/v2/expenses');
  await context.setOffline(true);
  await expect(page.getByTestId('expenses-empty')).toBeVisible();

  // Nat pays the mower fuel himself → the farm owes Nat 640.
  await addExpense(page, { amount: '640', date: '2026-09-28', cat: 'cat-fuel', newPayer: 'นัด' });
  await expect(page.getByTestId('owed-preview')).toContainText('640.00');
  await page.screenshot({ path: `${SHOTS}/18-expense-form.png`, fullPage: true });
  await page.getByTestId('expense-save').click();

  await addExpense(page, { amount: '400', date: '2026-09-22', cat: 'cat-repair', newPayer: 'อาจารย์สมหวัง' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '800', date: '2026-09-15', cat: 'cat-herbicide', payer: 'none' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '15000', date: '2026-10-31', stage: 'committed', cat: 'cat-salary', payer: 'farm' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { stage: 'planned', unknown: true, date: '2026-11-15', cat: 'cat-fertilizer', payer: 'farm' });
  await page.getByTestId('expense-save').click();

  await expect(page.getByTestId('total-actual')).toContainText('1,840.00');
  await expect(page.getByTestId('total-committed')).toContainText('15,000.00');
  await expect(page.getByTestId('total-planned')).toContainText('ไม่ทราบ');
  await page.screenshot({ path: `${SHOTS}/19-expense-list.png`, fullPage: true });

  // F7: no payer recorded → pick it and set the payer in the sheet.
  await page.getByTestId('filter-payer-missing').click();
  await page.locator('[data-testid^="expense-exp-"]').first().click();
  await expect(page.getByTestId('bulk-payer-save')).toBeVisible();
  await page.getByTestId('bulk-payer-add').click();
  await page.getByTestId('bulk-payer-name').fill('เจ้าของสวน');
  await page.getByTestId('bulk-payer-add-save').click();
  await expect(page.getByTestId('bulk-owed')).toContainText('800.00');
  await page.screenshot({ path: `${SHOTS}/19b-bulk-payer.png`, fullPage: true });
  await page.getByTestId('bulk-payer-save').click();
  await page.getByTestId('filter-payer-missing').click();

  // ค้างใคร, then repay อาจารย์สมหวัง.
  await context.setOffline(false);
  await page.goto('/v2/owed');
  await context.setOffline(true);
  await expect(page.getByTestId('owed-total')).toContainText('1,840.00');
  await page.screenshot({ path: `${SHOTS}/20-owed.png`, fullPage: true });
  await page.locator('[data-testid^="owed-open-"]').filter({ hasText: 'อาจารย์สมหวัง' }).click();
  await page.locator('[data-testid^="owed-repay-"]').click();
  await page.getByTestId('repay-amount').fill('300');
  await expect(page.getByTestId('repay-save')).toContainText('300.00');
  await page.screenshot({ path: `${SHOTS}/21-repay.png`, fullPage: true });
  await page.getByTestId('repay-save').click();
  await expect(page.getByTestId('owed-total')).toContainText('1,540.00');
});
