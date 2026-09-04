import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFarmStore } from './farm-memory';

/**
 * MemoryFarmStore only — the platform adapters (farm.web.ts, farm.native.ts)
 * touch localStorage / expo-sqlite and are exercised via Playwright once a
 * real screen uses them, not here. See people.test.ts for the same split.
 */
describe('MemoryFarmStore', () => {
  let store: MemoryFarmStore;
  beforeEach(() => {
    store = new MemoryFarmStore();
  });

  it('starts empty', async () => {
    expect(await store.listZones()).toEqual([]);
  });

  it('a created zone round-trips', async () => {
    const z = await store.addZone('โซนบน');
    expect(z.name).toBe('โซนบน');
    expect(z.id).toBeTruthy();
    expect(z.piles).toEqual([]);
    expect(z.archivedTs).toBeNull();
    expect(await store.getZone(z.id)).toEqual(z);
  });

  it('ids are stable across reads and across writes to other zones', async () => {
    const a = await store.addZone('โซนบน');
    const b = await store.addZone('โซนล่าง');
    await store.addPile(b.id, 'กองที่ 1', 2000, 50000);

    const again = await store.getZone(a.id);
    expect(again?.id).toBe(a.id);
    expect(again?.piles).toEqual([]);
  });

  it('zone listing is Thai-collated, not insertion-ordered', async () => {
    await store.addZone('สมหญิง');
    await store.addZone('ประยุทธ');
    await store.addZone('มานพ');
    const names = (await store.listZones()).map((z) => z.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'th')));
    expect(names).toHaveLength(3);
  });

  it('archiving hides a zone from the list but keeps it resolvable', async () => {
    const z = await store.addZone('โซนบน');
    await store.archiveZone(z.id);

    expect(await store.listZones()).toEqual([]);
    const after = await store.getZone(z.id);
    expect(after?.archivedTs).not.toBeNull();
    expect(after?.name).toBe('โซนบน');
  });

  it('renaming a zone keeps its id', async () => {
    const z = await store.addZone('โซนบน');
    await store.renameZone(z.id, 'โซนบน 2');
    const after = await store.getZone(z.id);
    expect(after?.id).toBe(z.id);
    expect(after?.name).toBe('โซนบน 2');
  });

  it('piles add, edit and remove within a zone', async () => {
    const z = await store.addZone('โซนบน');
    const pile = await store.addPile(z.id, 'กองที่ 1', 2000, 50000);
    expect(pile.name).toBe('กองที่ 1');
    expect(pile.tareG).toBe(2000);
    expect(pile.stdNetG).toBe(50000);

    await store.editPile(z.id, pile.id, { tareG: 2500 });
    let after = await store.getZone(z.id);
    expect(after?.piles).toEqual([{ ...pile, tareG: 2500 }]);

    await store.removePile(z.id, pile.id);
    after = await store.getZone(z.id);
    expect(after?.piles).toEqual([]);
  });

  it('an unknown zone or pile id is a no-op, not a throw', async () => {
    await expect(store.renameZone('nope', 'x')).resolves.toBeUndefined();
    await expect(store.archiveZone('nope')).resolves.toBeUndefined();
    await expect(store.addPile('nope', 'x', 1000, 2000)).resolves.toBeTruthy();
    await expect(store.editPile('nope', 'nope', { name: 'x' })).resolves.toBeUndefined();
    await expect(store.removePile('nope', 'nope')).resolves.toBeUndefined();
    expect(await store.getZone('nope')).toBeNull();
  });
});
