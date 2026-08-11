import { expect, test, type Page } from '@playwright/test';

/**
 * The real sale setup screen (S6), replacing S17's stub. Each save button
 * writes one event immediately — these tests verify that write actually
 * lands (by reading the effect back through the UI, not by inspecting
 * localStorage directly) and that "start counting" stays disabled until
 * FR-8.5's requirement is genuinely met: a price, a split resolvable for
 * every zone, and at least one pile.
 */

async function openSetup(page: Page) {
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await expect(page.getByTestId('start-counting')).toBeVisible();
  return page;
}

async function fillAndSave(page: Page, testId: string, value: string, saveTestId: string) {
  await page.getByTestId(testId).fill(value);
  await page.getByTestId(saveTestId).click();
}

test('start counting is disabled until price, split and a pile all exist', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByTestId('start-counting')).toBeDisabled();
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่ได้ตั้งราคา');

  await fillAndSave(page, 'price-baht', '26.5', 'save-price');
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่มีโซน'); // price set, no zone yet

  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();
  await expect(page.getByTestId('start-blocker')).toContainText('บางโซนยังไม่มีส่วนแบ่ง'); // zone exists, no split resolvable yet

  await page.getByTestId('save-split').click(); // default 50/50, gross
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่มีกอง'); // split resolved, still no pile

  const zoneEditor = page.locator('[data-testid^="zone-editor-"]');
  await zoneEditor.getByTestId(/^pile-name-/).fill('กอง 1');
  await zoneEditor.getByTestId(/^add-pile-/).click();

  await expect(page.getByTestId('start-counting')).toBeEnabled();
  await expect(page.getByTestId('start-blocker')).toContainText('ทุกอย่างพร้อม');
});

test('saving parties, price and a zone contract actually persists (survives a reload)', async ({ page }) => {
  await openSetup(page);

  // Buyer is still empty at this point — save must stay disabled rather than
  // writing an incomplete `sale_started`. Not clicking it: Playwright's
  // .click() waits for an element to become enabled, so clicking a
  // deliberately-disabled button here would just hang until timeout.
  await page.getByTestId('farm-name').fill('ไร่ทดสอบ');
  await expect(page.getByTestId('save-parties')).toBeDisabled();

  await page.getByTestId('buyer').fill('ล้งทดสอบ');
  await expect(page.getByTestId('save-parties')).toBeEnabled();
  await page.getByTestId('save-parties').click();

  await page.reload();
  await expect(page.getByTestId('farm-name')).toHaveValue('ไร่ทดสอบ');
  await expect(page.getByTestId('buyer')).toHaveValue('ล้งทดสอบ');
});

test('saving shows a confirmation, which clears the moment the form is edited again', async ({ page }) => {
  // A real bug, found by clicking through the app: every save button wrote
  // its event correctly but gave zero visible feedback, so a working save
  // and a no-op looked identical.
  await openSetup(page);

  await expect(page.getByTestId('saved-price')).toHaveCount(0);
  await fillAndSave(page, 'price-baht', '26.5', 'save-price');
  await expect(page.getByTestId('saved-price')).toBeVisible();

  // Touching the form again means the saved event no longer describes what's
  // on screen — the badge must go away, not keep claiming it's saved.
  await page.getByTestId('price-baht').fill('27');
  await expect(page.getByTestId('saved-price')).toHaveCount(0);

  await page.getByTestId('save-price').click();
  await expect(page.getByTestId('saved-price')).toBeVisible();
});

test('a zone with its own worker picked from the people list overrides the default', async ({ page }) => {
  await openSetup(page);

  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();

  const picker = page.locator('[data-testid^="zone-worker-"]');
  await picker.getByTestId(/-add$/).click();
  await picker.getByTestId(/-new-name$/).fill('ประยุทธ');
  await picker.getByTestId(/-confirm-new$/).click();

  // Picking a worker reveals the per-zone percentage and its own save button.
  const zoneEditor = page.locator('[data-testid^="zone-editor-"]');
  await expect(zoneEditor.getByTestId(/^save-contract-/)).toBeVisible();
  await zoneEditor.getByTestId(/^save-contract-/).click();

  await page.reload();
  await expect(page.locator('[data-testid^="zone-worker-"]').getByTestId(/-selected$/)).toContainText('ประยุทธ');
});
