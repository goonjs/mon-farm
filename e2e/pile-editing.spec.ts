import { expect, test, type Page } from '@playwright/test';

import { LogBuilder, readyPile, setUpSale } from '../src/core/fixtures';
import { openPileScenario, seedSale, testSaleId, unreadyPileScenario } from './fixtures';

/**
 * S26 — piles and zones are editable.
 *
 * Everything here is driven from the setup screen, because that is where a
 * mistake made at setup time gets corrected. What the tests keep checking on
 * the counter is the consequence: an edit before the first basket changes
 * what the gate expects, an edit after it changes only the name, and a
 * removal takes a pile out of the counting switcher and out of the money
 * while leaving every one of its baskets legible in the log.
 */

const SHOTS = 'docs/stories/screenshots/s26';
async function shot(
  page: Page,
  testInfo: { project: { name: string } },
  name: string,
  { floor = false }: { floor?: boolean } = {},
) {
  if (testInfo.project.name === 'phone-landscape') {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  } else if (floor && testInfo.project.name === 'phone-landscape-floor') {
    await page.screenshot({ path: `${SHOTS}/${name}-floor.png` });
  }
}

const setup = (page: Page, saleId: string) => page.goto(`/sale/${saleId}/setup`);

/** A sale whose กอง 1 has counted, so its weights are locked (FR-3.4). */
function countingPileScenario(saleId: string): ReturnType<typeof unreadyPileScenario> {
  return openPileScenario(saleId, 3);
}

test('a pile is renamed and re-weighed before it has counted', async ({ page }, testInfo) => {
  const saleId = testSaleId('s26-edit');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await setup(page, saleId);

  await expect(page.getByTestId('pile-p1')).toContainText('กอง 1');
  await page.getByTestId('pile-p1').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '00-setup-piles');

  await page.getByTestId('edit-pile-p1').click();
  await expect(page.getByTestId('pile-editor-p1')).toBeVisible();
  await page.getByTestId('pile-editor-p1').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '01-edit-unlocked', { floor: true });

  await page.getByTestId('pile-edit-name-p1').fill('กองหน้าบ้าน');
  await page.getByTestId('pile-edit-tare-p1').fill('3');
  await page.getByTestId('pile-edit-std-p1').fill('45');
  await page.getByTestId('pile-edit-save-p1').click();

  await expect(page.getByTestId('pile-p1')).toContainText('กองหน้าบ้าน');
  await expect(page.getByTestId('pile-p1')).toContainText('3');
  await expect(page.getByTestId('pile-p1')).toContainText('45');
  await page.getByTestId('pile-p1').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '02-edited');

  // The edit survives a reload: it is an event in the log, not screen state.
  await page.reload();
  await expect(page.getByTestId('pile-p1')).toContainText('กองหน้าบ้าน');
});

test('the new tare is what the gate reads back at the first basket', async ({ page }) => {
  const saleId = testSaleId('s26-gate');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await setup(page, saleId);

  await page.getByTestId('edit-pile-p1').click();
  await page.getByTestId('pile-edit-tare-p1').fill('3');
  await page.getByTestId('pile-edit-save-p1').click();
  await expect(page.getByTestId('pile-p1')).toContainText('3');

  await page.goto(`/sale/${saleId}/counter`);
  await expect(page.getByTestId('zero-tare-gate')).toBeVisible();
  await page.getByTestId('zero-yes').click();
  // The gate offers the pile's tare as it stands now — the edited 3 kg.
  await expect(page.getByTestId('tare-input')).toHaveValue('3');
  await page.getByTestId('tare-confirm').click();
  // 3 + 50 = 53, not the 2 + 50 = 52 the pile was set up with.
  await expect(page.getByTestId('read-back')).toContainText('53');
});

test('a pile that has counted can be renamed, and only renamed', async ({ page }, testInfo) => {
  const saleId = testSaleId('s26-locked');
  await seedSale(page, saleId, countingPileScenario(saleId));
  await setup(page, saleId);

  await page.getByTestId('edit-pile-p1').click();
  await expect(page.getByTestId('pile-edit-locked-p1')).toBeVisible();
  await expect(page.getByTestId('pile-edit-tare-p1')).not.toBeEditable();
  await expect(page.getByTestId('pile-edit-std-p1')).not.toBeEditable();
  await page.getByTestId('pile-editor-p1').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '03-edit-locked', { floor: true });

  await page.getByTestId('pile-edit-name-p1').fill('กองริมรั้ว');
  await page.getByTestId('pile-edit-save-p1').click();
  await expect(page.getByTestId('pile-p1')).toContainText('กองริมรั้ว');
  // The weights it counted at are untouched: 2 kg tare, 50 kg standard.
  await expect(page.getByTestId('pile-p1')).toContainText('2');
  await expect(page.getByTestId('pile-p1')).toContainText('50');

  // And the three baskets already counted are still three baskets.
  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('pile-whole-sale')).toContainText('150');
});

test('removing a pile that has counted is a void with a typed reason', async ({ page }, testInfo) => {
  const saleId = testSaleId('s26-void');
  await seedSale(page, saleId, countingPileScenario(saleId));

  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('pile-whole-sale')).toContainText('150');

  await setup(page, saleId);
  await page.getByTestId('remove-pile-p1').click();
  await expect(page.getByTestId('remove-pile-p1-reason')).toBeVisible();
  await expect(page.getByTestId('remove-pile-p1-confirm')).toBeDisabled();
  await page.getByTestId('remove-pile-p1-reason').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '04-remove-needs-reason', { floor: true });

  await page.getByTestId('remove-pile-p1-reason').fill('นับซ้ำกับกอง 2');
  await page.getByTestId('remove-pile-p1-confirm').click();
  await expect(page.getByTestId('pile-p1')).toHaveCount(0);
  await shot(page, testInfo, '05-removed');

  await page.goto(`/sale/${saleId}/counter`);
  // Not a counting target any more.
  await page.getByTestId('open-switcher').click();
  await expect(page.getByTestId('switcher-pile-p1')).toHaveCount(0);
  await page.getByTestId('switcher-close').click();

  // Out of the money — the whole sale drops by exactly that pile's 150 kg.
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('pile-whole-sale')).toContainText('0');

  // Still in the record, reason and all.
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('นับซ้ำกับกอง 2');
  await expect(page.getByTestId('log')).toContainText('เข่งมาตรฐาน');
  await shot(page, testInfo, '06-log-after-removal');
});

test('removing a pile that never counted takes one tap and no reason', async ({ page }, testInfo) => {
  const saleId = testSaleId('s26-empty');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await setup(page, saleId);

  await page.getByTestId('remove-pile-p2').click();
  await expect(page.getByTestId('remove-pile-p2-reason')).toHaveCount(0);
  await page.getByTestId('remove-pile-p2-confirm').click();
  await expect(page.getByTestId('pile-p2')).toHaveCount(0);
  await shot(page, testInfo, '07-removed-empty');

  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('open-switcher').click();
  await expect(page.getByTestId('switcher-pile-p1')).toBeVisible();
  await expect(page.getByTestId('switcher-pile-p2')).toHaveCount(0);
});

test('a zone is emptied of piles before it can be removed', async ({ page }, testInfo) => {
  const saleId = testSaleId('s26-zone');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await setup(page, saleId);

  // โซน A still has กอง 1 and กอง 2 under it.
  await expect(page.getByTestId('remove-zone-zA')).toBeDisabled();
  await expect(page.getByTestId('remove-zone-zA-blocked')).toContainText('เอากองในโซนออกให้หมดก่อน');
  await page.getByTestId('remove-zone-zA-blocked').scrollIntoViewIfNeeded();
  await shot(page, testInfo, '08-zone-blocked');

  for (const pileId of ['p1', 'p2']) {
    await page.getByTestId(`remove-pile-${pileId}`).click();
    await page.getByTestId(`remove-pile-${pileId}-confirm`).click();
    await expect(page.getByTestId(`pile-${pileId}`)).toHaveCount(0);
  }

  await expect(page.getByTestId('remove-zone-zA')).toBeEnabled();
  await page.getByTestId('remove-zone-zA').click();
  // A zone that had to be emptied is a real part of the sale being retired,
  // so it says why — the same fork the piles inside it went through.
  await expect(page.getByTestId('remove-zone-zA-reason')).toBeVisible();
  await expect(page.getByTestId('remove-zone-zA-confirm')).toBeDisabled();
  await page.getByTestId('remove-zone-zA-reason').fill('ยกโซนนี้ไปขายรอบหน้า');
  await page.getByTestId('remove-zone-zA-confirm').click();
  await expect(page.getByTestId('zone-editor-zA')).toHaveCount(0);
  await shot(page, testInfo, '09-zone-removed');

  // โซน B is untouched — removal is never a cascade upwards either.
  await expect(page.getByTestId('zone-editor-zB')).toBeVisible();
});

test('a zone is renamed without touching its piles', async ({ page }) => {
  const saleId = testSaleId('s26-zone-name');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await setup(page, saleId);

  await page.getByTestId('edit-zone-zA').click();
  await page.getByTestId('zone-name-zA').fill('โซนหน้าบ้าน');
  await page.getByTestId('zone-name-save-zA').click();
  await expect(page.getByTestId('zone-editor-zA')).toContainText('โซนหน้าบ้าน');
  await expect(page.getByTestId('pile-p1')).toContainText('กอง 1');

  await page.reload();
  await expect(page.getByTestId('zone-editor-zA')).toContainText('โซนหน้าบ้าน');
});

test('a bulk-entered pile removes like any other, reason and all', async ({ page }) => {
  const saleId = testSaleId('s26-bulk');
  const b = setUpSale(new LogBuilder(saleId));
  b.sys({ t: 'bulk_gate_skipped', pileId: 'p2', reason: 'นับไว้ในกระดาษ' });
  for (let i = 0; i < 4; i++) b.accept('p2', 50_000, 2_000, 'bulk');
  b.sys({ t: 'pile_closed', pileId: 'p2', forced: false });
  readyPile(b, 'p1');
  b.accept('p1');
  await seedSale(page, saleId, b.build());

  await setup(page, saleId);
  await page.getByTestId('remove-pile-p2').click();
  // Bulk baskets are baskets: this is the typed-reason path, not one tap.
  await expect(page.getByTestId('remove-pile-p2-reason')).toBeVisible();
  await page.getByTestId('remove-pile-p2-reason').fill('กระดาษเป็นของกองอื่น');
  await page.getByTestId('remove-pile-p2-confirm').click();
  await expect(page.getByTestId('pile-p2')).toHaveCount(0);

  await page.goto(`/sale/${saleId}/counter`);
  await page.getByTestId('tab-pile').click();
  // 4 × 50 kg of bulk gone; the one live basket in กอง 1 remains.
  await expect(page.getByTestId('pile-whole-sale')).toContainText('50');
});
