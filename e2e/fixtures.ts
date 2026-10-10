import type { Page } from '@playwright/test';

import { LogBuilder, readyPile, setUpSale } from '../src/core/fixtures';
import { MASTER_SCOPE } from '../src/core/master';
import type { MasterPayload, SaleEvent } from '../src/core/types';

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
 * `setUpSale`'s two zones (A: p1, p2 · B: p3), with p1 and p3 both readied and
 * p1 given `standardBaskets` already counted. p2 stays `not-started`, so
 * closing p1 has a real "next pile in this zone" to offer, and p3 in zone B
 * gives the switcher and switch-zone paths somewhere real to go.
 */
export function closeLifecycleScenario(saleId: string, standardBaskets = 3): SaleEvent[] {
  const b = setUpSale(new LogBuilder(saleId));
  readyPile(b, 'p1');
  readyPile(b, 'p3');
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
 * Writes a sale's events straight into the app's IndexedDB (`mon-farm-v1`,
 * see `src/store/store.web.ts`) before the test opens the screen it is
 * about. This is the ENTIRE seeding mechanism for e2e — there is no app-side
 * seed (see docs/stories/s17-remove-seed-and-sale-list.md). Tests build their
 * scenarios with `src/core/fixtures.ts`'s `LogBuilder`, plain TS that runs
 * under Playwright's Node too.
 *
 * It loads the app once, so the database exists with the app's own schema,
 * then writes the records in one transaction. Runs once per call — unlike an
 * init script it does not re-run on `page.reload()`. The record shape below
 * mirrors `EventRecord` in store.web.ts; keep the two in step.
 */
export async function seedSale(page: Page, saleId: string, events: readonly SaleEvent[]): Promise<void> {
  if (events.some((e) => e.saleId !== saleId)) throw new Error(`seedSale: events not all for ${saleId}`);
  await seedEvents(page, events);
}

/** Writes any events (a sale's, or farm master data's) straight into IndexedDB — see `seedSale`. */
async function seedEvents(page: Page, events: readonly SaleEvent[]): Promise<void> {
  await page.goto('/');
  // The list renders only after `listSales()` resolved, i.e. after the app
  // created the database with its own schema — so the seed never creates it.
  await page.locator('[data-testid="empty-state"], [data-testid^="sale-"]').first().waitFor();
  await page.evaluate(
    (events) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1', 1);
        open.onupgradeneeded = () => {
          open.transaction?.abort();
          reject(new Error('seedSale: app has not created mon-farm-v1 yet'));
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('events', 'readwrite');
          const store = tx.objectStore('events');
          for (const event of events) {
            store.put({
              id: event.id,
              saleId: event.saleId,
              ts: event.ts,
              deviceSeq: event.deviceSeq,
              pending: 1,
              event,
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    events as SaleEvent[],
  );
}

/** A fresh, per-test sale id — avoids any collision between parallel tests. */
export function testSaleId(label: string): string {
  return `e2e-${label}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Seeds people into farm master data (E03-S01): one `person_added` event
 * each, under `MASTER_SCOPE`, written like `seedSale`. Needed so
 * `PeoplePicker` (used by the S29 deduction form) has someone to pick — a
 * `zone_contract_set` event only snapshots a name against a `personId`, it
 * never adds a person.
 */
export async function seedPeople(
  page: Page,
  people: readonly { id: string; name: string }[],
): Promise<void> {
  const events: SaleEvent[] = people.map((p, i) => ({
    id: `seed-person/${p.id}`,
    saleId: MASTER_SCOPE,
    seq: i + 1,
    deviceSeq: i + 1,
    ts: Date.now(),
    mono: i,
    actor: { userId: 'pre-login', deviceId: 'dev-seed' },
    source: 'app',
    kind: 'master',
    payload: { t: 'person_added', personId: p.id, name: p.name, roles: ['tapper'], otherRoles: [] },
  }));
  await seedEvents(page, events);
}

/**
 * Seeds the farm profile (S27) — `src/store/farm.web.ts`'s exact
 * `mon-farm:farm-profile` localStorage schema, one JSON document holding
 * every zone. Same idempotent-by-key pattern as `seedSale` / `seedPeople`:
 * only writes if the key is empty, so a `page.reload()` mid-test does not
 * stomp on profile edits the test itself made through the UI.
 */
export async function seedFarmProfile(
  page: Page,
  zones: readonly {
    id: string;
    name: string;
    piles: readonly { id: string; name: string; tareG: number; stdNetG: number }[];
  }[],
): Promise<void> {
  await page.addInitScript(
    ({ key, zones }) => {
      if (window.localStorage.getItem(key) !== null) return;
      const rows = zones.map((z) => ({ id: z.id, name: z.name, piles: z.piles, archivedTs: null }));
      window.localStorage.setItem(key, JSON.stringify(rows));
    },
    { key: 'mon-farm:farm-profile', zones },
  );
}

/** Seeds farm master data (E03) as `master` events, written like `seedSale`. */
export async function seedMaster(page: Page, payloads: readonly MasterPayload[]): Promise<void> {
  const events: SaleEvent[] = payloads.map((payload, i) => ({
    id: `seed-master/${i}/${Math.random().toString(36).slice(2, 8)}`,
    saleId: MASTER_SCOPE,
    seq: i + 1,
    deviceSeq: i + 1,
    ts: Date.now(),
    mono: i,
    actor: { userId: 'pre-login', deviceId: 'dev-seed' },
    source: 'app',
    kind: 'master',
    payload,
  }));
  await seedEvents(page, events);
}
