import { expect, test } from '@playwright/test';

import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * E01-S03: the web store is IndexedDB (`mon-farm-v1`), one record per event,
 * and a browser without IndexedDB still counts — with a Thai warning that
 * nothing is being kept.
 */

/** Records of one sale, split into the seeded ones and the ones this browser wrote. */
async function idbRecords(page: import('@playwright/test').Page, saleId: string) {
  return page.evaluate(
    (saleId) =>
      new Promise<{ seeded: number; written: number; writtenAccepts: number }>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('events', 'readonly');
          const req = tx.objectStore('events').index('saleId').getAll(saleId);
          req.onsuccess = () => {
            const rows = req.result as { event: { kind: string; actor: { deviceId: string } } }[];
            const mine = rows.filter((r) => r.event.actor.deviceId !== 'dev-A');
            open.result.close();
            resolve({
              seeded: rows.length - mine.length,
              written: mine.length,
              writtenAccepts: mine.filter((r) => r.event.kind === 'accept').length,
            });
          };
          req.onerror = () => reject(req.error);
        };
      }),
    saleId,
  );
}

async function holdToCount(page: import('@playwright/test').Page) {
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
}

test('a counted basket is one IndexedDB record and survives a reload at 400 baskets', async ({ page }) => {
  const saleId = testSaleId('idb-400');
  await seedSale(page, saleId, openPileScenario(saleId, 400));
  await page.goto(`/sale/${saleId}/counter?holdMs=200`);
  await expect(page.getByTestId('count')).toHaveText('400');
  const before = await idbRecords(page, saleId);
  expect(before.written).toBe(0);

  await holdToCount(page);
  await expect(page.getByTestId('count')).toHaveText('401');
  // One basket → exactly one new `accept` record (its `announced` and any
  // clock-anomaly events are records of their own), and the seeded 400+
  // records are still there, untouched — no whole-log rewrite.
  await expect.poll(async () => (await idbRecords(page, saleId)).writtenAccepts).toBe(1);
  expect((await idbRecords(page, saleId)).seeded).toBe(before.seeded);
  // Nothing about the sale is written to localStorage any more.
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(lsKeys.filter((k) => k.startsWith('mon-farm-v1:'))).toEqual([]);

  await page.reload();
  await expect(page.getByTestId('count')).toHaveText('401');
});

test('an IndexedDB that refuses to open also falls back, with the warning', async ({ page }) => {
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
  await page.goto('/');
  await expect(page.getByTestId('storage-warning')).toBeVisible();
});

test('without IndexedDB the app still counts and warns in Thai that nothing is kept', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('/');
  const warning = page.getByTestId('storage-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('ไม่ได้บันทึก');

  await page.getByTestId('new-sale').click();
  await expect(page).toHaveURL(/\/start$/); // E04-S02: a new sale opens the start screen
  await expect(page.getByTestId('storage-warning')).toBeVisible();
  await page.screenshot({ path: 'docs/stories/screenshots/e01-s03/storage-warning.png' });
});

test('two tabs counting the same sale in turn lose nothing (NFR-2)', async ({ context, page }) => {
  const saleId = testSaleId('idb-two-tabs');
  await seedSale(page, saleId, openPileScenario(saleId, 0));
  const errors: string[] = [];
  const second = await context.newPage();
  for (const p of [page, second]) {
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await p.goto(`/sale/${saleId}/counter?holdMs=200`);
    await expect(p.getByTestId('count')).toHaveText('0');
  }

  // Each tab only sees its own baskets until reload — what matters is that
  // every one of them is stored.
  for (let i = 0; i < 3; i++) {
    await holdToCount(page);
    await holdToCount(second);
  }
  await expect.poll(async () => (await idbRecords(page, saleId)).writtenAccepts).toBe(6);
  // One id, one body: each record's indexed deviceSeq is the one inside the
  // stored event (what the outbox will push), and no number repeats.
  const seqs = await page.evaluate(
    (saleId) =>
      new Promise<{ indexed: number; body: number }[]>((resolve, reject) => {
        const open = indexedDB.open('mon-farm-v1');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('events').objectStore('events').index('saleId').getAll(saleId);
          req.onsuccess = () => {
            const rows = req.result as { deviceSeq: number; event: { deviceSeq: number; actor: { deviceId: string } } }[];
            open.result.close();
            resolve(
              rows
                .filter((r) => r.event.actor.deviceId !== 'dev-A')
                .map((r) => ({ indexed: r.deviceSeq, body: r.event.deviceSeq })),
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
    saleId,
  );
  expect(seqs.every((s) => s.indexed === s.body)).toBe(true);
  expect(new Set(seqs.map((s) => s.body)).size).toBe(seqs.length);
  expect(errors.filter((e) => e.includes('could not be stored') || e.includes('IntegrityError'))).toEqual([]);

  await page.reload();
  await expect(page.getByTestId('count')).toHaveText('6');
});
