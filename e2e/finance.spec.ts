import { expect, test } from '@playwright/test';

/**
 * Finance (E11-S01..S03) in the real web build, portrait, offline-first:
 * record expenses, see per-stage totals, set a payer in bulk, see what the
 * farm owes back, and repay oldest first. Screenshots are evidence for the
 * owner (docs/ux/screenshots/overnight/money/).
 */

const SHOTS = 'docs/ux/screenshots/overnight/money';

test.beforeEach((_fixtures, info) => {
  test.skip(info.project.name !== 'phone-portrait', 'finance screens are portrait-first');
});

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
