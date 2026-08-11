import { expect, test } from '@playwright/test';

import { seedSale, testSaleId } from './fixtures';
import { LogBuilder, readyPile, setUpSale, withZoneContract, workedExample } from '../src/core/fixtures';

/**
 * The settlement figures are checked against a hand calculation in
 * `src/core/settle.test.ts`. What this tier adds is that the numbers actually
 * reach the screen, and that the per-zone rows visibly add up — because that
 * addition happening in front of a buyer is the entire trust mechanism.
 *
 * `workedExample()` is the same fixture the unit tests check to the satang:
 * two zones, each with its own worker at 50/50 (ประยุทธ in zone A, มานพ in
 * zone B). Reusing it here means these figures cannot drift from what
 * settle.test.ts already proved correct.
 */

async function openSettlement(page: import('@playwright/test').Page) {
  const saleId = testSaleId('settlement');
  await seedSale(page, saleId, workedExample(saleId));
  await page.goto(`/sale/${saleId}/settlement`);
  await expect(page.getByTestId('owner-share')).toBeVisible();
  return saleId;
}

test('settlement renders the derivation and the owner total', async ({ page }, testInfo) => {
  await openSettlement(page);

  // net = 11,273 kg; gross = ฿298,734.50; owner total (both zones at 50%) = ฿149,367.25
  await expect(page.getByTestId('step-net-weight')).toContainText('11,273');
  await expect(page.getByTestId('step-gross')).toContainText('298,734.50');
  await expect(page.getByTestId('owner-share')).toContainText('149,367.25');

  await page.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/settlement.png` });
});

test('every step of the money chain is shown, not just the total (FR-7.4)', async ({ page }) => {
  await openSettlement(page);

  for (const key of ['baskets', 'standard-weight', 'short-weight', 'net-weight', 'price', 'gross']) {
    await expect(page.getByTestId(`step-${key}`)).toBeVisible();
  }
});

test('per-zone rows show each zone’s own worker and figures', async ({ page }) => {
  await openSettlement(page);

  const zoneA = page.getByTestId('zone-zA');
  await expect(zoneA).toContainText('โซน A');
  await expect(zoneA).toContainText('ประยุทธ');
  await expect(zoneA).toContainText('100,342.25'); // zone A's own worker share at 50%

  const zoneB = page.getByTestId('zone-zB');
  await expect(zoneB).toContainText('โซน B');
  await expect(zoneB).toContainText('มานพ');
  await expect(zoneB).toContainText('49,025.00'); // zone B's own worker share at 50%
});

test('per-worker card sums each worker\'s own total, not the zone total', async ({ page }) => {
  await openSettlement(page);

  // Each worker in workedExample() is named in exactly one zone, so their
  // per-worker total matches that zone's worker share — the number a worker
  // actually wants ("what do I get") happens to equal "what did my zone make"
  // here only because there is one zone per worker.
  const prayuth = page.getByTestId('worker-person-prayuth');
  await expect(prayuth).toContainText('ประยุทธ');
  await expect(prayuth).toContainText('100,342.25');
  await expect(prayuth).toContainText('โซน A');

  const manop = page.getByTestId('worker-person-manop');
  await expect(manop).toContainText('มานพ');
  await expect(manop).toContainText('49,025.00');
  await expect(manop).toContainText('โซน B');
});

test('one worker paid across two zones gets a single, combined row', async ({ page }) => {
  const saleId = testSaleId('settlement-shared-worker');
  const b = setUpSale(new LogBuilder(saleId));
  withZoneContract(b, 'zA', 'shared-person', 'บุญมี', 50);
  withZoneContract(b, 'zB', 'shared-person', 'บุญมี', 50);
  readyPile(b, 'p1');
  b.accept('p1', 100_000); // 100 kg net, zone A
  readyPile(b, 'p3');
  b.accept('p3', 100_000); // 100 kg net, zone B
  b.sys({ t: 'sale_closed' });

  await seedSale(page, saleId, b.build());
  await page.goto(`/sale/${saleId}/settlement`);
  await expect(page.getByTestId('owner-share')).toBeVisible();

  const rows = page.getByTestId('worker-shared-person');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('บุญมี');
  await expect(rows).toContainText('โซน A');
  await expect(rows).toContainText('โซน B');
  // Same net, same price, same 50% split, both zones — worker total equals
  // the sale's aggregate worker share exactly.
  await expect(rows).toContainText('2,650.00'); // 200 kg × ฿26.50 × 50%
});
