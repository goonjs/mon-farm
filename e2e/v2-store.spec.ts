import { expect, test, type Page } from '@playwright/test';

import { evidence, seedMaster } from './fixtures';
import type { MasterPayload } from '../src/core/types';

/**
 * The web event store on the v2 screens (E01-S03, E01-S02 AC6), ported from
 * the v1 web-store and legacy-log specs: IndexedDB `mon-farm-v1`, one record
 * per event, nothing rewritten; a browser without IndexedDB still works and
 * says in Thai that nothing is kept; two tabs lose nothing; and a v0.4 log
 * left in localStorage is dropped once without taking the app down.
 */

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'v2 screens are portrait-first'));

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });

/** Farm master records in IndexedDB, split into seeded ones and ones this browser wrote. */
async function masterRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ seeded: number; written: number; seqs: { indexed: number; body: number }[] }>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('events', 'readonly').objectStore('events').index('saleId').getAll('farm-master');
          req.onsuccess = () => {
            const rows = req.result as { deviceSeq: number; event: { kind: string; deviceSeq: number; actor: { deviceId: string } } }[];
            const mine = rows.filter((r) => r.event.actor.deviceId !== 'dev-seed');
            open.result.close();
            resolve({
              seeded: rows.length - mine.length,
              written: mine.filter((r) => r.event.kind === 'master').length,
              seqs: mine.map((r) => ({ indexed: r.deviceSeq, body: r.event.deviceSeq })),
            });
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

async function addPerson(page: Page, name: string) {
  const id = on(page);
  await page.goto('/v2/person/new');
  await id('person-name').fill(name);
  await id('role-worker').click();
  await id('person-save').click();
  // A cold open has nothing to pop, so saving lands on the people list.
  await expect(id('people-list')).toContainText(name);
}

test('a saved person is one IndexedDB record; 400 seeded records stay untouched and come back after a reload', async ({ page }) => {
  const seeded: MasterPayload[] = Array.from({ length: 400 }, (_, i) => ({
    t: 'person_added',
    personId: `seed-${i}`,
    name: `คนงาน ${i + 1}`,
    roles: ['worker'],
    otherRoles: [],
  }));
  await seedMaster(page, seeded);
  const id = on(page);
  await page.goto('/v2/farm');
  await expect(id('hub-people')).toContainText('400 คน');
  expect(await masterRecords(page)).toMatchObject({ seeded: 400, written: 0 });

  await addPerson(page, 'แดง');
  // One person → exactly one new record; the seeded 400 are still there, untouched.
  await expect.poll(async () => (await masterRecords(page)).written).toBe(1);
  expect((await masterRecords(page)).seeded).toBe(400);
  // Nothing of the event log is written to localStorage.
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(lsKeys.filter((k) => k.startsWith('mon-farm-v1:'))).toEqual([]);

  await page.goto('/v2/farm');
  await page.reload();
  await expect(id('hub-people')).toContainText('401 คน');
});

test('an IndexedDB that refuses to open falls back, with the warning on every screen', async ({ page }) => {
  await page.addInitScript(() => {
    // Older Firefox private mode: indexedDB exists but open() errors.
    const real = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: new Proxy(real, {
        get(target, prop) {
          if (prop !== 'open') return Reflect.get(target, prop).bind?.(target) ?? Reflect.get(target, prop);
          return () => {
            const req: Record<string, unknown> = { error: new DOMException('denied', 'InvalidStateError') };
            setTimeout(() => (req.onerror as (() => void) | undefined)?.(), 0);
            return req;
          };
        },
      }),
    });
  });
  await page.goto('/v2');
  await expect(page.getByTestId('storage-warning')).toBeVisible();
  await page.goto('/v2/farm');
  await expect(page.getByTestId('storage-warning')).toBeVisible();
});

test('without IndexedDB the app warns in Thai that nothing is kept, from the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('/');
  // Nothing was ever signed in here (the session lives in IndexedDB), so the
  // first screen is the sign-in screen — with the warning above it (E02-S01).
  await expect(page.getByTestId('signin')).toBeVisible();
  const warning = page.getByTestId('storage-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('ไม่ได้บันทึก');
  await evidence(page, 'docs/ux/screenshots/ui-v2/farm/21-storage-warning.png');
});

test('two tabs saving in turn lose nothing (NFR-2)', async ({ context, page }) => {
  const errors: string[] = [];
  const second = await context.newPage();
  for (const p of [page, second]) p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  for (let i = 0; i < 3; i++) {
    await addPerson(page, `แท็บหนึ่ง ${i + 1}`);
    await addPerson(second, `แท็บสอง ${i + 1}`);
  }
  await expect.poll(async () => (await masterRecords(page)).written).toBe(6);
  // One id, one body: each record's indexed deviceSeq is the one inside the
  // stored event (what the outbox will push), and no number repeats.
  const { seqs } = await masterRecords(page);
  expect(seqs.every((s) => s.indexed === s.body)).toBe(true);
  expect(new Set(seqs.map((s) => s.body)).size).toBe(seqs.length);
  expect(errors.filter((e) => e.includes('could not be stored') || e.includes('IntegrityError'))).toEqual([]);

  await page.goto('/v2/farm');
  await expect(on(page)('hub-people')).toContainText('6 คน');
});

test('a browser holding a v0.4 log opens normally and drops the old sale keys once', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    // The v0.4 shape: per-sale arrays keyed by (saleId, seq), actor a name.
    localStorage.setItem(
      'mon-farm:events:old-sale',
      JSON.stringify([{ saleId: 'old-sale', seq: 1, ts: 1, mono: 1, actor: 'somchai', kind: 'sys', payload: { t: 'sale_started' } }]),
    );
    localStorage.setItem('mon-farm:sales', JSON.stringify(['old-sale']));
    localStorage.setItem('mon-farm:synced', '[]');
    // What E01-S02 wrote on dev builds before IndexedDB.
    localStorage.setItem('mon-farm-v1:meta', '{}');
    localStorage.setItem('mon-farm:locale', 'th');
    localStorage.setItem('mon-farm:people', '[]');
    localStorage.setItem('mon-farm:farm-profile', '{"zones":[]}');
    localStorage.setItem('mon-farm:speech-on', 'true');
  });

  const id = on(page);
  await page.goto('/');
  await expect(id('v2-home')).toBeVisible();
  await page.goto('/v2/people');
  await expect(id('people')).toContainText('ยังไม่มีคนในรายการนี้');
  await page.reload();
  await expect(id('people')).toContainText('ยังไม่มีคนในรายการนี้');

  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((k) => k.startsWith('mon-farm:events:'))).toEqual([]);
  expect(keys).not.toContain('mon-farm:sales');
  expect(keys).not.toContain('mon-farm:synced');
  expect(keys).not.toContain('mon-farm:locale');
  // Unread since E03-S01 but kept: clearing them cannot be undone.
  expect(keys).toContain('mon-farm:people');
  expect(keys).toContain('mon-farm:farm-profile');
  expect(keys).toContain('mon-farm:speech-on');
  expect(keys.filter((k) => k.startsWith('mon-farm-v1:'))).toEqual([]);
});
