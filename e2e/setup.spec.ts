import { expect, test, type Page } from '@playwright/test';

/**
 * The real sale setup screen (S6), replacing S17's stub. Parties, price,
 * split and each zone's contract auto-save (debounced, no Save button) —
 * these tests verify the write actually lands, by reading the effect back
 * through the UI rather than inspecting localStorage directly, and that
 * "start counting" stays disabled until FR-8.5's requirement is genuinely
 * met: a price, a split resolvable for every zone, and at least one pile.
 *
 * `expect(...).toContainText(...)` / `toBeVisible()` already retry for up to
 * Playwright's default timeout, which comfortably covers the auto-save
 * debounce (300ms on web, where this suite runs) — no manual
 * `waitForTimeout` needed anywhere here.
 */

async function openSetup(page: Page) {
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await expect(page.getByTestId('start-counting')).toBeVisible();
  return page;
}

test('start counting is disabled until price, split and a pile all exist', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByTestId('start-counting')).toBeDisabled();
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่ได้ตั้งราคา');

  // The default split (50/50, gross) is always a valid value — it auto-saves
  // on its own from the moment the setup screen mounts, with no decoy click
  // needed to "confirm" a value that already shows as selected. By the time
  // a zone exists below, the split is already resolved for it.
  await expect(page.getByTestId('saved-split')).toContainText('บันทึกแล้ว');

  await page.getByTestId('price-baht').fill('26.5');
  await expect(page.getByTestId('saved-price')).toContainText('บันทึกแล้ว');
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่มีโซน'); // price set, no zone yet

  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();
  await expect(page.getByTestId('start-blocker')).toContainText('ยังไม่มีกอง'); // zone + split resolved, still no pile

  const zoneEditor = page.locator('[data-testid^="zone-editor-"]');
  await zoneEditor.getByTestId(/^pile-name-/).fill('กอง 1');
  await zoneEditor.getByTestId(/^add-pile-/).click();

  await expect(page.getByTestId('start-counting')).toBeEnabled();
  await expect(page.getByTestId('start-blocker')).toContainText('ทุกอย่างพร้อม');
});

test('the default split saves on its own, with no click required (field report)', async ({ page }) => {
  // A real bug: the split card only ever wrote `split_set` from inside a
  // Segmented onChange, so an owner happy with 50/50 gross — which is
  // already showing as selected — had no way to actually persist it short
  // of clicking a different option and clicking back. `splitResolvable`
  // requires that event to exist, so this silently blocked "start counting"
  // on nothing but an undiscoverable UI trick.
  await openSetup(page);
  await expect(page.getByTestId('saved-split')).toContainText('บันทึกแล้ว');

  await page.reload();
  await expect(page.getByTestId('saved-split')).toContainText('บันทึกแล้ว');
});

test('an edit made just before leaving is written, not dropped', async ({ page }) => {
  await openSetup(page);
  await page.getByTestId('price-baht').fill('26.5');
  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();
  const zoneEditor = page.locator('[data-testid^="zone-editor-"]');
  await zoneEditor.getByTestId(/^pile-name-/).fill('กอง 1');
  await zoneEditor.getByTestId(/^add-pile-/).click();
  await expect(page.getByTestId('start-counting')).toBeEnabled();

  // Correct the price and start the count in the same breath, without
  // waiting for the debounce. Unmounting used to cancel the pending save,
  // and because the start gate reads the log rather than the on-screen
  // draft, the whole sale then ran at the old price with nothing shown.
  await page.getByTestId('price-baht').fill('27');
  await page.getByTestId('start-counting').click();
  await expect(page.getByTestId('count')).toBeVisible();

  const saleId = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`/sale/${saleId}/setup`);
  await expect(page.getByTestId('price-baht')).toHaveValue('27');
});

test('parties and price auto-save without a button, and persist across a reload', async ({ page }) => {
  await openSetup(page);

  // Buyer is still empty at this point — must stay unsaved (idle) rather
  // than writing an incomplete `sale_started`.
  await page.getByTestId('farm-name').fill('ไร่ทดสอบ');
  await expect(page.getByTestId('saved-parties')).toContainText('ล้ง'); // the "farm and buyer required" hint

  await page.getByTestId('buyer').fill('ล้งทดสอบ');
  await expect(page.getByTestId('saved-parties')).toContainText('บันทึกแล้ว');

  await page.getByTestId('price-baht').fill('26.5');
  await expect(page.getByTestId('saved-price')).toContainText('บันทึกแล้ว');

  await page.reload();
  await expect(page.getByTestId('farm-name')).toHaveValue('ไร่ทดสอบ');
  await expect(page.getByTestId('buyer')).toHaveValue('ล้งทดสอบ');
  await expect(page.getByTestId('price-baht')).toHaveValue('26.5');
});

test('save status shows saving, then saved, and reverts to saving on the next edit', async ({ page }) => {
  // A real bug, found by clicking through the app: every save button wrote
  // its event correctly but gave zero visible feedback, so a working save
  // and a no-op looked identical. This is the auto-save replacement for
  // that button — no click, no missable toast, just a status that's always
  // showing something true.
  await openSetup(page);

  await page.getByTestId('price-baht').fill('26.5');
  await expect(page.getByTestId('saved-price')).toContainText('กำลังบันทึก'); // saving…
  await expect(page.getByTestId('saved-price')).toContainText('บันทึกแล้ว'); // saved

  // Touching the form again means the saved event no longer describes
  // what's on screen — the status must go back to "saving", not keep
  // claiming it's saved.
  await page.getByTestId('price-baht').fill('27');
  await expect(page.getByTestId('saved-price')).toContainText('กำลังบันทึก');
  await expect(page.getByTestId('saved-price')).toContainText('บันทึกแล้ว');

  await page.reload();
  await expect(page.getByTestId('price-baht')).toHaveValue('27');
});

test('a zone with its own worker picked from the people list overrides the default', async ({ page }) => {
  await openSetup(page);

  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();

  const picker = page.locator('[data-testid^="zone-worker-"]');
  await picker.getByTestId(/-add$/).click();
  await picker.getByTestId(/-new-name$/).fill('ประยุทธ');
  await picker.getByTestId(/-confirm-new$/).click();

  // Picking a worker reveals the per-zone percentage, which auto-saves too.
  const zoneEditor = page.locator('[data-testid^="zone-editor-"]');
  await expect(zoneEditor.getByTestId(/^saved-contract-/)).toContainText('บันทึกแล้ว');

  await page.reload();
  await expect(page.locator('[data-testid^="zone-worker-"]').getByTestId(/-selected$/)).toContainText('ประยุทธ');
});

test('clearing a zone worker really drops the contract, not just the display', async ({ page }) => {
  await openSetup(page);

  await page.getByTestId('new-zone-name').fill('โซน A');
  await page.getByTestId('add-zone').click();

  const picker = page.locator('[data-testid^="zone-worker-"]');
  await picker.getByTestId(/-add$/).click();
  await picker.getByTestId(/-new-name$/).fill('ประยุทธ');
  await picker.getByTestId(/-confirm-new$/).click();
  await expect(page.locator('[data-testid^="zone-editor-"]').getByTestId(/^saved-contract-/)).toContainText('บันทึกแล้ว');

  // "Change" with nobody picked afterwards means "put this zone back on the
  // sale default". The log is append-only, so hiding the worker on screen
  // is not enough — without an event of its own the old contract stayed
  // authoritative and the zone kept paying him.
  await picker.getByTestId(/-change$/).click();
  await expect(picker.getByTestId(/-selected$/)).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-testid^="zone-worker-"]').getByTestId(/-selected$/)).toHaveCount(0);
});
