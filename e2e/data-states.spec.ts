import { expect, test } from '@playwright/test';

import { FIELD_DATA_STATES } from '../src/core/field-state';

/**
 * E01-S15: the six data-state badges side by side, for the owner to review.
 * The preview route is unlinked; real screens use the badge in their own
 * stories.
 */
test('all six data-state badges render with their words', async ({ page }) => {
  // Android-first, portrait: the owner reviews them at phone size.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/preview/data-states');
  for (const s of FIELD_DATA_STATES) {
    await expect(page.getByTestId(`data-state-${s}`)).toBeVisible();
  }
  await expect(page.getByTestId('data-state-estimated')).toContainText('≈ ประมาณ');
  await page.screenshot({ path: 'docs/stories/screenshots/e01-s15/data-state-badges.png' });
});

/** E01-S15 / D-74 F14: tapping a date switches every date between พ.ศ. and ค.ศ., remembered after a reload. */
test('dates switch era app-wide on tap and keep it after reload', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/preview/data-states');
  await expect(page.getByTestId('date-a')).toHaveText('9 ต.ค. 2569');
  await page.screenshot({ path: 'docs/ux/screenshots/overnight/infra/date-be.png' });

  await page.getByTestId('date-b').click();
  await expect(page.getByTestId('date-a')).toHaveText('9 ต.ค. 2026');
  await expect(page.getByTestId('date-b')).toHaveText('1 ม.ค. 2026');
  await page.screenshot({ path: 'docs/ux/screenshots/overnight/infra/date-ce.png' });

  await page.reload();
  await expect(page.getByTestId('date-a')).toHaveText('9 ต.ค. 2026');
});
