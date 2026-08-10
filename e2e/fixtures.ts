import type { Page } from '@playwright/test';

import { LogBuilder, readyPile, setUpSale } from '../src/core/fixtures';
import type { SaleEvent } from '../src/core/types';

/**
 * A sale with one zone, one pile already checked and ready, and `standardBaskets`
 * baskets already counted into it. Everything the counter-screen interaction
 * tests need (hold, undo, reject, tab-switch, reload) and nothing else.
 */
export function openPileScenario(saleId: string, standardBaskets = 0): SaleEvent[] {
  const b = setUpSale(new LogBuilder(saleId));
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
