import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';

/** E03-S07: sale settings changed offline survive a reload; hold time stays on this device. */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

test('sale settings: group choices and device hold time persist offline', async ({ page, context }, info) => {
  await page.goto('/sale-settings');
  await expect(page.getByTestId('pair-builtin-50')).toContainText('ค่าเริ่มต้น');
  await context.setOffline(true);
  await page.getByTestId('zero-first-per-farm').click();
  await page.getByTestId('numbering-per-point').click();
  await page.getByTestId('dup-more').click();
  await page.getByTestId('hold-more').click();
  await page.getByTestId('add-pair').click();
  await page.getByTestId('new-net-more').click();
  await page.getByTestId('save-pair').click();
  await expect(page.getByText('น้ำหนักยางสุทธิ 51 กก. · น้ำหนักเข่ง 2 กก.')).toBeVisible();
  await expect(page.getByTestId('dup-value')).toContainText('9');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('dup-value')).toContainText('9');
  await expect(page.getByTestId('hold-value')).toContainText('0.8');
  await expect(page.getByTestId('zero-first-per-farm')).toContainText('✓');
  await expect(page.getByText('น้ำหนักยางสุทธิ 51 กก. · น้ำหนักเข่ง 2 กก.')).toBeVisible();
  if (info.project.name === 'phone-landscape') {
    await page.screenshot({ path: 'docs/ux/screenshots/overnight/farm/e03-s07-sale-settings.png', fullPage: true });
  }
});
