import { expect, test } from '@playwright/test';

import { seedPeople, seedSale, testSaleId } from './fixtures';
import { workedExample } from '../src/core/fixtures';

/**
 * S29 — worker deductions, off each worker's own share. Reuses the same
 * `workedExample()` fixture `settle.test.ts` and `settlement.spec.ts` check
 * to the satang, so these figures cannot drift from what is already proven
 * correct: zone A's ประยุทธ (`person-prayuth`) shares ฿100,342.25 at 50%.
 *
 * The whole story is offline: no network call exists anywhere in the app, so
 * "reload; both events survive" is the reconnect/manual-sync path there is —
 * see the story's "Offline / sync behavior" section.
 */

async function openSettlement(page: import('@playwright/test').Page) {
  const saleId = testSaleId('deductions');
  await seedPeople(page, [{ id: 'person-prayuth', name: 'ประยุทธ' }]);
  await seedSale(page, saleId, workedExample(saleId));
  await page.goto(`/sale/${saleId}/settlement`);
  await expect(page.getByTestId('owner-share')).toBeVisible();
  return saleId;
}

test('adding a deduction moves the payout, not the owner total or zone rows', async ({ page }) => {
  const saleId = await openSettlement(page);

  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
  await expect(page.getByTestId('zone-zA')).toContainText('100,342.25');
  await expect(page.getByTestId('step-gross')).toContainText('298,734.50');

  await page.getByTestId('deduction-person-option-person-prayuth').click();
  await page.getByTestId('deduction-amount').fill('50');
  await page.getByTestId('deduction-reason').fill('ค่าปุ๋ย');
  await page.getByTestId('deduction-agreed-by').fill('สมชาย');
  await page.getByTestId('deduction-add').click();

  // The property the whole design exists to preserve: unaffected.
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
  await expect(page.getByTestId('zone-zA')).toContainText('100,342.25');
  await expect(page.getByTestId('step-gross')).toContainText('298,734.50');

  // What DOES move: the payout. ฿100,342.25 − ฿50.00 = ฿100,292.25
  const worker = page.getByTestId('worker-person-prayuth');
  await expect(worker).toContainText('ค่าปุ๋ย');
  await expect(worker).toContainText('สมชาย');
  await expect(page.getByTestId('worker-payout-person-prayuth')).toContainText('100,292.25');

  // Screenshots are evidence for a human (see playwright.config.ts): park the
  // view on the payout card, not on the empty form below it.
  await worker.scrollIntoViewIfNeeded();
  await worker.screenshot({
    path: `docs/ux/screenshots/${test.info().project.name}/deduction-payout.png`,
  });

  // Voiding: back to the share, exactly.
  await worker.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.getByTestId(/^deduction-void-reason-/).fill('จ่ายผิดคน');
  await page.getByTestId(/^deduction-void-confirm-/).click();

  await expect(page.getByTestId('worker-payout-person-prayuth')).toContainText('100,342.25');
  await expect(worker).not.toContainText('ค่าปุ๋ย');

  await worker.scrollIntoViewIfNeeded();
  await worker.screenshot({
    path: `docs/ux/screenshots/${test.info().project.name}/deduction-voided.png`,
  });

  // Reload — both events (add and void) survive; the projection is identical.
  await page.reload();
  await expect(page.getByTestId('owner-share')).toBeVisible();
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
  await expect(page.getByTestId('worker-payout-person-prayuth')).toContainText('100,342.25');
  await expect(worker).not.toContainText('ค่าปุ๋ย');

  // Both events are still in the log, in Thai, not as a raw payload type.
  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('tab-log').click();
  await expect(page.getByText(/หักเงิน.*ค่าปุ๋ย/)).toBeVisible();
  await expect(page.getByText(/ยกเลิกรายการหัก.*จ่ายผิดคน/)).toBeVisible();
});

test('a deduction against someone with no zone contract in this sale is shown, not dropped', async ({ page }) => {
  await openSettlement(page);

  // Create a new person inline via the picker — nobody with this id holds a
  // zone contract in workedExample().
  await page.getByTestId('deduction-person-add').click();
  await page.getByTestId('deduction-person-new-name').fill('คนนอกโซน');
  await page.getByTestId('deduction-person-confirm-new').click();

  await page.getByTestId('deduction-amount').fill('30');
  await page.getByTestId('deduction-reason').fill('ค่าปรับ');
  await page.getByTestId('deduction-agreed-by').fill('สมชาย');
  await page.getByTestId('deduction-add').click();

  const outsiderRow = page.locator('[data-testid^="worker-"]').filter({ hasText: 'คนนอกโซน' });
  await expect(outsiderRow).toBeVisible();
  await expect(outsiderRow).toContainText('ค่าปรับ');
  // share ฿0.00, deduction ฿30.00 -> payout −฿30.00, negative, not clamped.
  await expect(outsiderRow).toContainText('−฿ 30.00');

  // Edge case the story names explicitly: a negative payout, shown rather than
  // clamped or dropped. Captured because a human has to agree it reads right.
  await outsiderRow.scrollIntoViewIfNeeded();
  await outsiderRow.screenshot({
    path: `docs/ux/screenshots/${test.info().project.name}/deduction-negative-payout.png`,
  });

  // Sale-level figures are still untouched.
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');
});
