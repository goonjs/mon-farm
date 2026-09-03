import { expect, test, type Page } from '@playwright/test';

import { closeLifecycleScenario, seedSale, singlePileScenario, testSaleId } from './fixtures';

/**
 * Pile → zone → sale close lifecycle (S13, docs/ux/pile-zone-sale-lifecycle.md):
 * closing a pile lands on a named decision point rather than a single
 * "continue"; closing a zone names any pile still counting before force-
 * closing it; closing the sale is a real event, not just a navigation; and
 * reopening anything is a typed-reason, two-step, publicly-shown act.
 *
 * `closeLifecycleScenario` readies p1 and p3 (zone A and zone B respectively)
 * and leaves p2 (also zone A) `not-started`, so "next pile in this zone" and
 * "switch zone" both have somewhere real to go.
 */

async function openCounter(page: Page, standardBaskets = 3, p3Baskets = 0) {
  const saleId = testSaleId('close-lifecycle');
  await seedSale(page, saleId, closeLifecycleScenario(saleId, standardBaskets, p3Baskets));
  await page.goto(`/sale/${saleId}/counter`);
  await expect(page.getByTestId('count')).toBeVisible();
  return saleId;
}

test('closing a pile lands on the decision point, naming every option', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('tab-pile').click();
  await page.getByTestId('close-pile').click();
  await page.getByTestId('close-pile-confirm').click();

  await page.getByTestId('tab-count').click();
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();
  await expect(page.getByTestId('pile-closed-total')).toContainText('3');
  await expect(page.getByTestId('decision-next-pile')).toBeVisible();
  await expect(page.getByTestId('decision-switch-zone')).toBeVisible();
  await expect(page.getByTestId('decision-close-zone')).toBeVisible();
  // Close-sale is NOT among them here (S25): p3 in zone B is still counting,
  // so the operator's real next step is a pile, not the end of the sale. Its
  // own appearance rule has its own cases below.
  await expect(page.getByTestId('decision-close-sale')).toHaveCount(0);
});

test('"next pile in this zone" moves straight to the not-started pile\'s gate', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('tab-pile').click();
  await page.getByTestId('close-pile').click();
  await page.getByTestId('close-pile-confirm').click();
  await page.getByTestId('tab-count').click();

  await page.getByTestId('decision-next-pile').click();
  await expect(page.getByTestId('crumb')).toContainText('กอง 2');
  await expect(page.getByTestId('zero-yes')).toBeVisible();
});

test('the switcher jumps to any pile in any zone, closed or not', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('open-switcher').click();
  await expect(page.getByTestId('zone-pile-switcher')).toBeVisible();
  await page.getByTestId('switcher-pile-p3').click();

  await expect(page.getByTestId('zone-pile-switcher')).toHaveCount(0);
  await expect(page.getByTestId('crumb')).toContainText('กอง 3');
  await expect(page.getByTestId('count')).toBeVisible();
});

test('reopening a closed pile requires a typed reason and a second confirm', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('tab-pile').click();
  await page.getByTestId('close-pile').click();
  await page.getByTestId('close-pile-confirm').click();
  await expect(page.getByTestId('reopen-pile')).toBeVisible();

  await page.getByTestId('reopen-pile').click();
  await expect(page.getByTestId('reopen-prompt')).toBeVisible();

  await page.getByTestId('reopen-prompt-reason').fill('นับผิด ต้องแก้');
  await page.getByTestId('reopen-prompt-next').click();
  await expect(page.getByTestId('reopen-prompt-reason-echo')).toContainText('นับผิด ต้องแก้');
  await page.getByTestId('reopen-prompt-confirm').click();

  await expect(page.getByTestId('reopen-prompt')).toHaveCount(0);
  // Back on the pile tab, the pile is countable again — close-pile is offered,
  // not reopen-pile.
  await expect(page.getByTestId('close-pile')).toBeVisible();

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('เปิดกองอีกครั้ง');
  await expect(page.getByTestId('log')).toContainText('นับผิด ต้องแก้');
});

test('closing a zone names any pile still counting before force-closing it', async ({ page }) => {
  await openCounter(page);

  // p1 (zone A) is still counting; p2 (zone A) hasn't started. Closing zone A
  // must name p1 before force-closing it.
  await page.getByTestId('tab-pile').click();
  await page.getByTestId('close-zone').click();
  await expect(page.getByTestId('close-zone-warning')).toContainText('กอง 1');
  await page.getByTestId('close-zone-confirm').click();

  // Closing the zone hands off to the switcher — the operator just lost
  // their current zone, so picking where to go next is the natural follow-up.
  await expect(page.getByTestId('zone-pile-switcher')).toBeVisible();
  await page.getByTestId('switcher-close').click();

  await expect(page.getByTestId('reopen-zone')).toBeVisible();

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('ปิดโซน');
});

test('closing the current pile is reachable from the count tab itself', async ({ page }) => {
  await openCounter(page);

  // No tab switch: the button lives in the same row as undo and short-basket
  // on the tab the operator is already on, since a pile close is exactly as
  // frequent as those and touches nothing but the pile in front of them.
  await expect(page.getByTestId('tab-pile')).toBeVisible();
  // S25: close-pile is the row's only close-type action — no close-sale
  // button sits beside it while the pile is still counting.
  await expect(page.getByTestId('to-settlement')).toHaveCount(0);
  await page.getByTestId('row-close-pile').click();
  await expect(page.getByTestId('row-close-pile-detail')).toContainText('3');

  // Cancelling leaves the pile counting, right where it was.
  await page.getByTestId('row-close-pile-cancel').click();
  await expect(page.getByTestId('count')).toBeVisible();
  await expect(page.getByTestId('row-close-pile')).toBeVisible();

  // Confirming lands on the same named decision point the Pile-tab close
  // already reaches — one event, two doors.
  await page.getByTestId('row-close-pile').click();
  await page.getByTestId('row-close-pile-confirm').click();
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();

  // ...and the sale itself is not closable from here at all (S25): the row
  // never offered a way out of the whole sale while a pile is still counting.
  await page.getByTestId('decision-switch-zone').click();
  await page.getByTestId('switcher-pile-p3').click();
  await expect(page.getByTestId('count')).toBeVisible();
  await expect(page.getByTestId('to-settlement')).toHaveCount(0);
  await expect(page.getByTestId('row-close-pile')).toBeVisible();
});

test('closing a zone from the decision point also takes two steps, not one', async ({ page }) => {
  await openCounter(page);

  // Reach the decision point by closing p1 the ordinary way.
  await page.getByTestId('tab-pile').click();
  await page.getByTestId('close-pile').click();
  await page.getByTestId('close-pile-confirm').click();
  await page.getByTestId('tab-count').click();
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();

  // The first tap must only ask. Wiring this straight to the append was a
  // real bug: one tap here force-closed every pile still counting in the
  // zone, with no warning and nothing to cancel, while the same action on
  // the Pile tab correctly took two steps.
  await page.getByTestId('decision-close-zone').click();
  await expect(page.getByTestId('decision-close-zone-detail')).toBeVisible();

  // Cancelling leaves the zone open and puts the operator back where they were.
  await page.getByTestId('decision-close-zone-cancel').click();
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).not.toContainText('ปิดโซน');

  // Only the second, explicit confirm actually closes it.
  await page.getByTestId('tab-count').click();
  await page.getByTestId('decision-close-zone').click();
  await page.getByTestId('decision-close-zone-confirm').click();
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('ปิดโซน');
});

test('closing the sale writes a real event and settlement offers reopening it', async ({ page }) => {
  const saleId = await openCounter(page, 3, 2);

  // S25: the sale can only be closed once nothing is still counting, so both
  // piles close first — close pile, then close pile, then close sale.
  await closeCurrentPile(page);
  await page.getByTestId('decision-switch-zone').click();
  await page.getByTestId('switcher-pile-p3').click();
  await closeCurrentPile(page);

  await page.getByTestId('decision-close-sale').click();
  // Closing the sale gets the same verbose, two-step confirm as undo now —
  // no confirmation at all was a real gap, since this ends counting for
  // every zone and pile at once.
  await expect(page.getByTestId('close-sale-detail')).toContainText('เข่ง');
  await page.getByTestId('close-sale-confirm').click();
  await expect(page.getByTestId('owner-share')).toBeVisible();
  await expect(page.getByTestId('reopen-sale')).toBeVisible();
  expect(await saleClosedCount(page, saleId)).toBe(1);

  await page.getByTestId('reopen-sale').click();
  await page.getByTestId('reopen-prompt-reason').fill('ลูกค้าขอเพิ่มเข่ง');
  await page.getByTestId('reopen-prompt-next').click();
  await page.getByTestId('reopen-prompt-confirm').click();

  // Reopening IS "back to counting" now — one action does both, landing
  // straight on the counter screen rather than leaving a second, separate
  // "back to counting" button that would do nothing useful on a closed sale.
  // Both piles are still closed, so the pile in view is on its decision
  // point, where close-sale is offered again.
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();
  await expect(page.getByTestId('decision-close-sale')).toBeVisible();
});

/** Closes the pile in view from the live-counting row, via its confirm. */
async function closeCurrentPile(page: Page) {
  await page.getByTestId('row-close-pile').click();
  await page.getByTestId('row-close-pile-confirm').click();
  await expect(page.getByTestId('pile-closed-transition')).toBeVisible();
}

/** How many `sale_closed` events the seeded log actually holds. */
async function saleClosedCount(page: Page, saleId: string): Promise<number> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem(`mon-farm:events:${id}`) ?? '[]';
    return (JSON.parse(raw) as { kind: string; payload?: { t?: string } }[]).filter(
      (e) => e.kind === 'sys' && e.payload?.t === 'sale_closed',
    ).length;
  }, saleId);
}

test('close sale waits until no pile anywhere in the sale is still counting', async ({ page }) => {
  await openCounter(page, 3, 2);

  // p1 (zone A) and p3 (zone B) are both counting. Closing p1 is not the end
  // of the sale — the operator's real next step is the other pile.
  await closeCurrentPile(page);
  await expect(page.getByTestId('decision-close-sale')).toHaveCount(0);
  await expect(page.getByTestId('decision-switch-zone')).toBeVisible();
  await expect(page.getByTestId('decision-close-zone')).toBeVisible();

  // Nor from the Pile tab, while p3 counts elsewhere.
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('pile-close-sale')).toHaveCount(0);
  await page.getByTestId('tab-count').click();

  // Close the last counting pile: its own decision point now offers it, with
  // no reopen, refresh or navigation in between.
  await page.getByTestId('decision-switch-zone').click();
  await page.getByTestId('switcher-pile-p3').click();
  await closeCurrentPile(page);
  await expect(page.getByTestId('decision-close-sale')).toBeVisible();
});

test('a single-pile sale offers close sale the moment its only pile closes', async ({ page }) => {
  const saleId = testSaleId('single-pile');
  await seedSale(page, saleId, singlePileScenario(saleId));
  await page.goto(`/sale/${saleId}/counter`);
  await expect(page.getByTestId('count')).toBeVisible();

  // Nothing sale-ending while it counts.
  await expect(page.getByTestId('to-settlement')).toHaveCount(0);

  await closeCurrentPile(page);
  await expect(page.getByTestId('decision-close-sale')).toBeVisible();
  // No sibling pile in the zone, so no "next pile" — the zone can still be
  // closed explicitly, per the existing S13 rules.
  await expect(page.getByTestId('decision-next-pile')).toHaveCount(0);
});

test('reopening a pile takes close sale away again on both surfaces', async ({ page }) => {
  await openCounter(page, 3, 2);

  await closeCurrentPile(page);
  await page.getByTestId('decision-switch-zone').click();
  await page.getByTestId('switcher-pile-p3').click();
  await closeCurrentPile(page);
  await expect(page.getByTestId('decision-close-sale')).toBeVisible();

  // p3 goes back to counting — the sale is not over after all.
  await page.getByTestId('tab-pile').click();
  await page.getByTestId('reopen-pile').click();
  await page.getByTestId('reopen-prompt-reason').fill('ชั่งซ้ำ');
  await page.getByTestId('reopen-prompt-next').click();
  await page.getByTestId('reopen-prompt-confirm').click();

  await expect(page.getByTestId('pile-close-sale')).toHaveCount(0);
  await page.getByTestId('tab-count').click();
  await expect(page.getByTestId('to-settlement')).toHaveCount(0);

  // Closing it a second time brings close-sale back.
  await closeCurrentPile(page);
  await expect(page.getByTestId('decision-close-sale')).toBeVisible();
});

test('the Pile tab offers close sale as a secondary, lighter-weight action', async ({ page }) => {
  const saleId = await openCounter(page, 3, 2);

  await closeCurrentPile(page);
  await page.getByTestId('decision-switch-zone').click();
  await page.getByTestId('switcher-pile-p3').click();
  await closeCurrentPile(page);

  await page.getByTestId('tab-pile').click();
  const closeSale = page.getByTestId('pile-close-sale');
  await expect(closeSale).toBeVisible();
  // Lighter than the pile card's own controls: a plain pressable label with
  // no button border at all, rather than the bordered destructive button
  // close-pile's confirm uses.
  await expect(closeSale).toHaveCSS('border-bottom-width', '0px');

  await closeSale.click();
  await expect(page.getByTestId('close-sale-detail')).toBeVisible();
  await page.getByTestId('close-sale-confirm').click();

  await expect(page.getByTestId('owner-share')).toBeVisible();
  expect(await saleClosedCount(page, saleId)).toBe(1);
});
