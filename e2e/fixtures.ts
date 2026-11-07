import { basename } from 'node:path';

import { test, type Page } from '@playwright/test';

import { FIXTURE_GROUP_ID } from '../src/core/fixtures';
import { MASTER_SCOPE } from '../src/core/master';
import type { MasterPayload, SaleEvent } from '../src/core/types';

/**
 * Writes events straight into the app's IndexedDB (`mon-farm-v1`, see
 * `src/store/store.web.ts`) before the test opens the screen it is about.
 * This is the ENTIRE seeding mechanism for e2e — there is no app-side seed.
 *
 * It loads the app once, so the database exists with the app's own schema,
 * then writes the records in one transaction. Runs once per call — unlike an
 * init script it does not re-run on `page.reload()`. The record shape below
 * mirrors `EventRecord` in store.web.ts; keep the two in step.
 */
export async function seedEvents(page: Page, events: readonly SaleEvent[]): Promise<void> {
  await page.goto('/v2');
  // The header's sync pill renders only after `pending()` resolved, i.e. after
  // the app created the database with its own schema — so the seed never
  // creates it.
  await page.getByTestId('sync-pill').first().waitFor();
  await page.evaluate(
    (events) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onupgradeneeded = () => {
          open.transaction?.abort();
          reject(new Error('seedEvents: app has not created mon-farm-v1 yet'));
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

/**
 * Seeds people into farm master data (E03-S01): one `person_added` event
 * each (role tapper), under `MASTER_SCOPE`, written like `seedEvents`.
 */
export async function seedPeople(
  page: Page,
  people: readonly { id: string; name: string }[],
): Promise<void> {
  const events: SaleEvent[] = people.map((p, i) => ({
    id: `seed-person/${p.id}`,
    groupId: FIXTURE_GROUP_ID,
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

/** Seeds farm master data (E03) as `master` events, written like `seedEvents`. */
export async function seedMaster(page: Page, payloads: readonly MasterPayload[]): Promise<void> {
  const events: SaleEvent[] = payloads.map((payload, i) => ({
    id: `seed-master/${i}/${Math.random().toString(36).slice(2, 8)}`,
    groupId: FIXTURE_GROUP_ID,
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

/**
 * Screenshot evidence for the owner. It is written to its place under docs/
 * only when UPDATE_SCREENSHOTS=1, so an ordinary run (CI, `npm run verify`)
 * never rewrites tracked PNGs whose fonts render a little differently on
 * each machine; otherwise it lands in the test's own output folder
 * (e2e/.results, ignored). See docs/ui-v2.md.
 */
/** Evidence of the splash only while it is still up: on a busy machine it may already have handed over to home. */
export async function splashEvidence(page: Page, docsPath: string) {
  if (await page.getByTestId('splash').isVisible()) await evidence(page, docsPath);
}

export function evidence(page: Page, docsPath: string, options: { fullPage?: boolean } = {}) {
  const path = process.env.UPDATE_SCREENSHOTS === '1' ? docsPath : test.info().outputPath(basename(docsPath));
  return page.screenshot({ path, ...options });
}

/**
 * The splash at `/` shows for SPLASH_MS (900 ms) and appears a few hundred ms
 * after navigation starts. `page.goto` waits for `load`, which on a busy
 * machine comes after the splash has already gone, and `expect(…).toBeVisible()`
 * polls up to a second apart — so asking for it afterwards misses it now and
 * then. Record it from the page's first script instead: call this before the
 * navigation (or the tap) that shows the splash, then await the returned
 * function for the splash's text. Reading it clears it, so a second splash in
 * the same document needs its own read.
 */
export async function watchSplash(page: Page): Promise<() => Promise<string>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __splashText?: string };
    new MutationObserver(() => {
      const text = document.querySelector('[data-testid="splash"]')?.textContent?.trim();
      if (text) w.__splashText = text;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  return async () => {
    const handle = await page.waitForFunction(() => (window as unknown as { __splashText?: string }).__splashText);
    const text = String(await handle.jsonValue());
    await page.evaluate(() => delete (window as unknown as { __splashText?: string }).__splashText);
    return text;
  };
}
