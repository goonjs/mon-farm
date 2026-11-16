import type { Page } from './test';

/**
 * Pick `iso` in the calendar of DateField `testID` (E01-S22): open it, step months until the day shows, tap it,
 * confirm. Dates are never typed any more.
 */
export async function pickDate(page: Page, testID: string, iso: string): Promise<void> {
  await page.getByTestId(testID).click();
  const tid = `${testID}-picker`;
  for (let i = 0; i < 600 && !(await page.getByTestId(`${tid}-day-${iso}`).count()); i++) {
    const first = await page.locator(`[data-testid^="${tid}-day-"]`).first().getAttribute('data-testid');
    const shown = (first ?? '').slice(`${tid}-day-`.length);
    await page.getByTestId(`${tid}-${iso < shown ? 'prev' : 'next'}`).click();
  }
  await page.getByTestId(`${tid}-day-${iso}`).click();
  await page.getByTestId(`${tid}-done`).click();
}
