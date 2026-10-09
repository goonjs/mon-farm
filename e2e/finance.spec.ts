import { expect, test } from '@playwright/test';

import { seedPeople, seedSale, testSaleId } from './fixtures';
import { workedExample } from '../src/core/fixtures';

/**
 * Finance (E11-S01..S03) in the real web build, portrait, offline-first:
 * record expenses, see per-stage totals, set a payer in bulk, see what the
 * farm owes back, and repay oldest first. Screenshots are evidence for the
 * owner (docs/ux/screenshots/overnight/money/).
 */

const SHOTS = 'docs/ux/screenshots/overnight/money';

// Finance screens are portrait-first: run only where the viewport is portrait.
test.skip(({ viewport }) => !viewport || viewport.width > viewport.height, 'finance screens are portrait-first');

async function addExpense(
  page: import('@playwright/test').Page,
  o: { amount?: string; date: string; stage?: 'committed' | 'planned'; unknown?: boolean; cat: string; payer?: string; newPayer?: string },
) {
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
  return page;
}

test('expenses, money owed back and repayment — offline, end to end', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);

  await page.getByTestId('open-expenses').click();
  await expect(page.getByTestId('expenses-empty')).toBeVisible();

  // Nat pays the mower fuel himself → farm owes Nat 640.
  await addExpense(page, { amount: '640', date: '2026-09-28', cat: 'cat-fuel', newPayer: 'นัด' });
  await expect(page.getByTestId('owed-preview')).toContainText('640.00');
  await page.screenshot({ path: `${SHOTS}/01-expense-form.png`, fullPage: true });
  await page.getByTestId('expense-save').click();

  await addExpense(page, { amount: '800', date: '2026-09-15', cat: 'cat-herbicide', newPayer: 'อาจารย์สมหวัง' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '400', date: '2026-09-22', cat: 'cat-repair' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '2000', date: '2026-09-20', cat: 'cat-fertilizer', payer: 'none' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { amount: '15000', date: '2026-10-31', stage: 'committed', cat: 'cat-salary', payer: 'farm' });
  await page.getByTestId('expense-save').click();
  await addExpense(page, { date: '2026-11-15', stage: 'planned', unknown: true, cat: 'cat-fertilizer', payer: 'farm' });
  await page.screenshot({ path: `${SHOTS}/02-expense-planned-unknown.png`, fullPage: true });
  await page.getByTestId('expense-save').click();

  // The repair was paid by the same person as last time (default payer).
  await expect(page.getByTestId('total-actual')).toContainText('3,840.00');
  await expect(page.getByTestId('total-committed')).toContainText('15,000.00');
  await expect(page.getByTestId('total-planned')).toContainText('1');
  await page.screenshot({ path: `${SHOTS}/03-expense-list.png`, fullPage: true });

  // F7: no payer recorded → set it in bulk.
  await page.getByTestId('filter-payer-missing').click();
  const rows = page.locator('[data-testid^="expense-exp-"]');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await page.getByTestId('bulk-payer-add').click();
  await page.getByTestId('bulk-payer-name').fill('เจ้าของสวน');
  await page.getByTestId('bulk-payer-add-save').click();
  await expect(page.getByTestId('bulk-owed')).toContainText('2,000.00');
  await page.screenshot({ path: `${SHOTS}/04-bulk-payer.png`, fullPage: true });
  await page.getByTestId('bulk-payer-save').click();
  await page.getByTestId('filter-clear').click();

  await page.getByTestId('open-owed').click();
  await expect(page.getByTestId('owed-total')).toContainText('3,840.00');
  await page.screenshot({ path: `${SHOTS}/05-owed.png`, fullPage: true });

  // Repay อาจารย์สมหวัง 1,000 — oldest first: herbicide 800 full, repair 200 of 400.
  await page.locator('[data-testid^="owed-"]', { hasText: 'อาจารย์สมหวัง' }).first().locator('[data-testid^="owed-repay-"]').click();
  await page.getByTestId('repay-amount').fill('1300');
  await expect(page.getByTestId('repay-over')).toContainText('1,200.00');
  await page.getByTestId('repay-amount').fill('1000');
  await page.screenshot({ path: `${SHOTS}/06-repay.png`, fullPage: true });
  await page.getByTestId('repay-save').click();
  await expect(page.getByTestId('owed-total')).toContainText('2,840.00');
  await page.screenshot({ path: `${SHOTS}/07-owed-after-repay.png`, fullPage: true });

  // Survives a reload — the log is on the device. Back online only so the
  // page itself can load: the web build has no offline app-shell cache yet.
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('owed-total')).toContainText('2,840.00');
});

test('worker debt ledger — fertilizer split, loan from someone else, reconciliation', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await page.getByTestId('open-expenses').click();
  await page.getByTestId('open-debts').click();
  await expect(page.getByTestId('debts-empty')).toBeVisible();

  // Workers come from the shared people list; add แดง and นัด through a payer picker.
  await page.getByTestId('debts-back').click();
  for (const name of ['แดง', 'นัด', 'อาจารย์สมหวัง']) {
    await page.getByTestId('expense-new').click();
    await page.getByTestId('expense-payer-add').click();
    await page.getByTestId('expense-payer-name').fill(name);
    await page.getByTestId('expense-payer-add-save').click();
    await page.getByTestId('expense-back').click();
  }
  await page.getByTestId('open-debts').click();
  await page.locator('[data-testid^="debt-person-"]', { hasText: 'แดง' }).click();

  // Loan 3,000 from farm funds.
  await page.getByTestId('debt-add').click();
  await page.getByTestId('debt-amount').fill('3000');
  await page.getByTestId('debt-date').fill('2026-09-10');
  await page.getByTestId('debt-save').click();

  // Fertilizer 4,000 at 50% → debt 2,000, owner-share expense 2,000.
  await page.getByTestId('debt-add').click();
  await page.getByTestId('debt-kind-fertilizer').click();
  await page.getByTestId('debt-amount').fill('4000');
  await page.getByTestId('debt-date').fill('2026-09-20');
  await page.getByTestId('debt-note').fill('ปุ๋ยรอบ ก.ย.');
  await expect(page.getByTestId('debt-owner-share')).toContainText('2,000.00');
  await page.screenshot({ path: `${SHOTS}/08-debt-add-fertilizer.png`, fullPage: true });
  await page.getByTestId('debt-save').click();

  await page.getByTestId('debt-plan-edit').click();
  await page.getByTestId('debt-plan-amount').fill('2000');
  await page.getByTestId('debt-plan-save').click();
  await expect(page.getByTestId('debt-balance')).toContainText('5,000.00');
  await expect(page.getByTestId('debt-summary-balance')).toContainText('5,000.00 ✓');
  await page.screenshot({ path: `${SHOTS}/09-debt-account.png`, fullPage: true });

  // นัด borrowed 1,000 from อาจารย์สมหวัง: shown, not deductible; pays 500 back himself.
  await page.getByTestId('debt-back').click();
  await page.locator('[data-testid^="debt-person-"]', { hasText: 'นัด' }).click();
  await page.getByTestId('debt-add').click();
  await page.locator('[data-testid^="debt-lender-"]', { hasText: 'อาจารย์สมหวัง' }).click();
  await page.getByTestId('debt-amount').fill('1000');
  await expect(page.getByTestId('debt-lender-note')).toBeVisible();
  await page.getByTestId('debt-save').click();
  await expect(page.getByTestId('debt-balance')).toContainText('0.00');
  await page.getByTestId('debt-pay').click();
  await page.locator('[data-testid^="debt-pay-to-"]', { hasText: 'อาจารย์สมหวัง' }).click();
  await page.getByTestId('debt-pay-amount').fill('500');
  await page.screenshot({ path: `${SHOTS}/10-debt-pay-other.png`, fullPage: true });
  await page.getByTestId('debt-pay-save').click();
  await expect(page.locator('[data-testid^="debt-other-"]')).toContainText('500.00');
  await page.screenshot({ path: `${SHOTS}/11-debt-account-other-lender.png`, fullPage: true });
});

test('deduct debt at settlement — instalment proposed, capped, recorded against the sale', async ({ page }) => {
  const saleId = testSaleId('money-deduct');
  await seedPeople(page, [{ id: 'person-prayuth', name: 'ประยุทธ' }]);
  await seedSale(page, saleId, workedExample(saleId));

  await page.goto('/finance/expenses');
  await page.getByTestId('open-debts').click();
  await page.getByTestId('debt-person-person-prayuth').click();
  await page.getByTestId('debt-add').click();
  await page.getByTestId('debt-amount').fill('5000');
  await page.getByTestId('debt-date').fill('2026-09-10');
  await page.getByTestId('debt-save').click();
  await page.getByTestId('debt-plan-edit').click();
  await page.getByTestId('debt-plan-amount').fill('2000');
  await page.getByTestId('debt-plan-save').click();
  await expect(page.getByTestId('debt-balance')).toContainText('5,000.00');

  await page.goto(`/sale/${saleId}/settlement`);
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
  await page.getByTestId('deduct-open-person-prayuth').click();
  await expect(page.getByTestId('deduct-amount-person-prayuth')).toHaveValue('2000.00');
  await page.getByTestId('deduct-route-cash-from-share-person-prayuth').click();
  await page.getByTestId('deduct-save-person-prayuth').click();
  await expect(page.getByTestId('deduct-cash-person-prayuth')).toContainText('98,342.25');
  // The owner's share does not move because of a worker's deduction.
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
  await page.getByTestId('deduct-person-prayuth').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/12-settlement-deduct.png`, fullPage: true });

  await page.goto('/finance/expenses');
  await page.getByTestId('open-debts').click();
  await page.getByTestId('debt-account-person-prayuth').click();
  await expect(page.getByTestId('debt-balance')).toContainText('3,000.00');
  await expect(page.getByTestId('debt-summary-balance')).toContainText('3,000.00 ✓');
});

test('salary, leases with unknowns, cashflow and reserve (E11-S04..S08, offline)', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await page.getByTestId('open-expenses').click();

  // Salary: rule from this month; months committed; mark one paid.
  await page.getByTestId('open-salary').click();
  await page.getByTestId('salary-add').click();
  await page.getByTestId('salary-recipient-add').click();
  await page.getByTestId('salary-recipient-name').fill('อาจารย์สมหวัง');
  await page.getByTestId('salary-recipient-add-save').click();
  await page.getByTestId('salary-payer-add').click();
  await page.getByTestId('salary-payer-name').fill('เจ้าของสวน');
  await page.getByTestId('salary-payer-add-save').click();
  const month = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  await page.getByTestId('salary-start').fill(month);
  await page.getByTestId('salary-save').click();
  await page.getByTestId(`salary-pay-${month}`).click();
  await expect(page.getByTestId(`salary-undo-${month}`)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/19-salary.png`, fullPage: true });
  await page.getByTestId('salary-back').click();

  // A planned expense with an unknown amount next month.
  await page.getByTestId('expense-new').click();
  await page.getByTestId('expense-stage-planned').click();
  await page.getByTestId('expense-unknown').click();
  const next = await page.evaluate(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 15);
    return d.toISOString().slice(0, 10);
  });
  await page.getByTestId('expense-date').fill(next);
  await page.getByTestId('expense-cat-cat-fertilizer').click();
  await page.getByTestId('expense-save').click();

  // A lease whose rent is not known yet.
  await page.getByTestId('open-income').click();
  await page.getByTestId('lease-add').click();
  await page.getByTestId('lease-farm').fill('สวนตัวอย่าง');
  await page.getByTestId('lease-rent-unknown').click();
  await page.getByTestId('lease-start').fill('2029-01-01');
  await page.getByTestId('lease-note').fill('คาดว่าเริ่มปี 2029');
  await page.getByTestId('lease-save').click();
  await expect(page.locator('[data-testid^="lease-lease-"]')).toContainText('ไม่ทราบ');
  await page.getByTestId('income-add').click();
  await page.getByTestId('income-amount').fill('5000');
  await page.getByTestId('income-tag-reserve').click();
  await page.getByTestId('income-save').click();
  await page.screenshot({ path: `${SHOTS}/20-income-leases.png`, fullPage: true });
  await page.getByTestId('income-back').click();

  // Cashflow: this month shows salary paid; next month is incomplete; enter the reserve.
  await page.getByTestId('open-cashflow').click();
  await expect(page.getByTestId(`cf-out-actual-${month}`)).toContainText('15,000.00');
  await expect(page.getByTestId(`cf-in-actual-${month}`)).toContainText('5,000.00');
  await expect(page.getByTestId(`cf-incomplete-${next.slice(0, 7)}`)).toBeVisible();
  await expect(page.getByTestId('reserve-none')).toBeVisible();
  await page.getByTestId('reserve-edit').click();
  await page.getByTestId('reserve-input').fill('500000');
  await page.getByTestId('reserve-assumption').fill('ค่าใช้จ่าย 6 เดือน');
  await page.getByTestId('reserve-source').fill('บัญชีออมทรัพย์');
  await page.getByTestId('reserve-save').click();
  await expect(page.getByTestId('reserve-amount')).toContainText('500,000.00');
  await page.getByTestId(`cf-sources-${month}`).click();
  await page.screenshot({ path: `${SHOTS}/21-cashflow.png`, fullPage: true });
});
