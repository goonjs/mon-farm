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
  const logs: string[] = [];
  const log = (m: { type(): string; text(): string }) => logs.push(`${m.type()}: ${m.text()}`);
  page.on('console', log);
  await page.goto('/v2');
  // The header's sync pill renders only after `pending()` resolved, i.e. after
  // the app created the database with its own schema — so the seed never
  // creates it.
  try {
    // Waits as long as before for the app; the sign-in screen, which never turns into the app on its own, ends
    // the wait at once. A rare run opens there (2026-11-07, cause not yet found): say what the page logged and
    // what the account database held, so the next one explains itself.
    const signIn = page.getByTestId('signin').first().waitFor().then(() => 'sign-in' as const);
    signIn.catch(() => undefined);
    const shown = await Promise.race([page.getByTestId('sync-pill').first().waitFor().then(() => 'app' as const), signIn]);
    if (shown === 'sign-in') throw new Error(`seedEvents: the app opened on the sign-in screen. ${await openFailure(page, logs)}`);
  } finally {
    page.off('console', log);
  }
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
export function evidence(page: Page, docsPath: string, options: { fullPage?: boolean } = {}) {
  const path = process.env.UPDATE_SCREENSHOTS === '1' ? docsPath : test.info().outputPath(basename(docsPath));
  return page.screenshot({ path, ...options });
}

/** What the account stores held and the page logged when it opened on sign-in (seedEvents). Never hangs or throws. */
async function openFailure(page: Page, logs: string[]): Promise<string> {
  const stored = await page
    .evaluate(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('database read timed out'), 2_000);
          const open = indexedDB.open('mon-farm-v1');
          open.onupgradeneeded = () => {
            open.transaction?.abort();
            resolve('no mon-farm-v1 database');
          };
          open.onerror = () => resolve(`open failed: ${String(open.error)}`);
          open.onsuccess = () => {
            const db = open.result;
            try {
              const tx = db.transaction(['meta', 'memberships'], 'readonly');
              const session = tx.objectStore('meta').get('session');
              const groups = tx.objectStore('memberships').count();
              tx.oncomplete = () => resolve(`session ${session.result ? 'present' : 'MISSING'}, memberships ${groups.result}`);
              tx.onerror = tx.onabort = () => resolve(`read failed: ${String(tx.error)}`);
            } catch (e) {
              resolve(`read failed: ${String(e)}`);
            } finally {
              db.close();
            }
          };
        }),
    )
    .catch((e) => `database not readable: ${String(e)}`);
  return `Database: ${stored}. Console: ${JSON.stringify(logs.slice(-20))}`;
}
