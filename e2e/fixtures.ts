import type { Page } from '@playwright/test';

import { LogBuilder, readyPile, setUpSale } from '../src/core/fixtures';
import type { SaleEvent } from '../src/core/types';

/**
 * A sale with one zone, one pile already checked and ready, and `standardBaskets`
 * baskets already counted into it. Everything the counter-screen interaction
 * tests need (hold, undo, reject, tab-switch, reload) and nothing else.
 */
export function openPileScenario(
  saleId: string,
  standardBaskets = 0,
  /**
   * Gross scale readings, in grams, for short baskets in the same pile — each
   * one nets `reading − tare` (S22). Optional and empty by default, so every
   * existing caller sees exactly the log it saw before.
   */
  shortReadingsG: readonly number[] = [],
): SaleEvent[] {
  const b = setUpSale(new LogBuilder(saleId));
  readyPile(b, 'p1');
  for (let i = 0; i < standardBaskets; i++) b.accept('p1');
  for (const readingG of shortReadingsG) b.short('p1', readingG);
  return b.build();
}

/**
 * `setUpSale`'s two zones (A: p1, p2 · B: p3), with p1 and p3 both readied and
 * p1 given `standardBaskets` already counted. p2 stays `not-started`, so
 * closing p1 has a real "next pile in this zone" to offer, and p3 in zone B
 * gives the switcher and switch-zone paths somewhere real to go.
 */
export function closeLifecycleScenario(
  saleId: string,
  standardBaskets = 3,
  /**
   * Baskets counted into p3 (zone B) as well. Default 0, so every existing
   * caller sees the log it saw before; S25's "two piles counting at once"
   * cases need p3 closable in its own right, which needs a basket in it.
   */
  p3Baskets = 0,
): SaleEvent[] {
  const b = setUpSale(new LogBuilder(saleId));
  readyPile(b, 'p1');
  readyPile(b, 'p3');
  for (let i = 0; i < standardBaskets; i++) b.accept('p1');
  for (let i = 0; i < p3Baskets; i++) b.accept('p3');
  return b.build();
}

/**
 * One zone, one pile, readied and counting — the S25 single-pile edge, where
 * the closed pile has no sibling to move to and its zone has nothing else to
 * force-close, so close-sale is the only real next step.
 */
export function singlePileScenario(saleId: string, standardBaskets = 3): SaleEvent[] {
  const b = new LogBuilder(saleId)
    .sys({
      t: 'sale_started',
      farmName: 'ไร่คุณพ่อ',
      buyer: 'ล้งเจริญทรัพย์',
      manager: 'สมชาย',
      workerLead: 'ประยุทธ',
      where: 'farm',
    })
    .sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'ตลาดกลางหาดใหญ่' })
    .sys({ t: 'split_set', ownerPct: 50, basis: 'gross' })
    .sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' })
    .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 });
  readyPile(b, 'p1');
  for (let i = 0; i < standardBaskets; i++) b.accept('p1');
  return b.build();
}

/**
 * A sale with one zone and one pile that is genuinely `not-started` — no
 * zero check, no tare confirmed, no ready. For the S9 gate tests, which exist
 * specifically to prove the gate itself, `readyPile()` would defeat the point
 * by skipping straight past it.
 */
export function unreadyPileScenario(saleId: string): SaleEvent[] {
  return setUpSale(new LogBuilder(saleId)).build();
}

/**
 * Writes a sale's events directly into the browser's localStorage before the
 * app boots, mirroring `src/store/store.web.ts`'s exact schema. This is the
 * ENTIRE seeding mechanism for e2e now — there is no app-side seed any more
 * (see docs/stories/s17-remove-seed-and-sale-list.md). Tests build their own
 * scenarios with `src/core/fixtures.ts`'s `LogBuilder` and friends, which are
 * plain TS with no RN imports, so they run fine under Playwright's Node
 * environment too.
 *
 * Idempotent by construction: only writes if the key is empty. `addInitScript`
 * reruns on every navigation, including `page.reload()` — writing
 * unconditionally would re-seed (and, for the append-only store, collide with
 * events written since) on every reload a test performs.
 */
export async function seedSale(page: Page, saleId: string, events: readonly SaleEvent[]): Promise<void> {
  await page.addInitScript(
    ({ key, index, saleId, events }) => {
      if (window.localStorage.getItem(key) !== null) return;
      window.localStorage.setItem(key, JSON.stringify(events));
      const idx: string[] = JSON.parse(window.localStorage.getItem(index) ?? '[]');
      if (!idx.includes(saleId)) window.localStorage.setItem(index, JSON.stringify([saleId, ...idx]));
    },
    { key: `mon-farm:events:${saleId}`, index: 'mon-farm:sales', saleId, events },
  );
}

/** A fresh, per-test sale id — avoids any collision between parallel tests. */
export function testSaleId(label: string): string {
  return `e2e-${label}-${Math.random().toString(36).slice(2, 8)}`;
}
