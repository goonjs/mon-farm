import { expect, test } from '@playwright/test';

/**
 * E01-S02 AC6: the v0.4 sale log is not migrated (owner 2026-10-03). A
 * browser still holding it must open normally, start empty, and lose the old
 * sale keys once — while the farm/people keys the interim stores still read
 * are left for E03.
 */
test('a browser holding a v0.4 log opens empty and drops the old sale keys', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    // The v0.4 shape: per-sale arrays keyed by (saleId, seq), actor a name.
    localStorage.setItem(
      'mon-farm:events:old-sale',
      JSON.stringify([
        { saleId: 'old-sale', seq: 1, ts: 1, mono: 1, actor: 'somchai', kind: 'sys', payload: { t: 'sale_started' } },
      ]),
    );
    localStorage.setItem('mon-farm:sales', JSON.stringify(['old-sale']));
    localStorage.setItem('mon-farm:synced', '[]');
    localStorage.setItem('mon-farm:locale', 'th');
    localStorage.setItem('mon-farm:people', '[]');
    localStorage.setItem('mon-farm:farm-profile', '{"zones":[]}');
    localStorage.setItem('mon-farm:speech-on', 'true');
  });

  await page.goto('/');
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('empty-state')).toBeVisible();

  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((k) => k.startsWith('mon-farm:events:'))).toEqual([]);
  expect(keys).not.toContain('mon-farm:sales');
  expect(keys).not.toContain('mon-farm:synced');
  expect(keys).not.toContain('mon-farm:locale'); // listed for removal in architecture §ข้อมูลเก่า
  // Interim farm/people stores and the device speech setting stay until E03.
  expect(keys).toContain('mon-farm:people');
  expect(keys).toContain('mon-farm:farm-profile');
  expect(keys).toContain('mon-farm:speech-on');
  expect(keys).toContain('mon-farm-v1:meta');

  await page.screenshot({ path: 'docs/stories/screenshots/e01-s02/legacy-log-ignored.png' });
});
