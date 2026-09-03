import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFarmProfileStore } from './farmProfile-memory';
import { profileZonesFromSale } from './farmProfile-doc';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { projectSale } from '../core/project';

/**
 * MemoryFarmProfileStore and the pure document helpers only — the platform
 * adapters (farmProfile.web.ts, farmProfile.native.ts) are thin read/write
 * shells around the same shared logic, and are exercised through Playwright
 * once a real screen uses them. Same split as people.test.ts.
 */
describe('MemoryFarmProfileStore', () => {
  let store: MemoryFarmProfileStore;
  beforeEach(() => {
    store = new MemoryFarmProfileStore();
  });

  it('starts empty, and has never been seeded', async () => {
    expect(await store.get()).toEqual({ zones: [], seededTs: null });
  });

  it('adds a zone and a pile under it', async () => {
    const z = await store.addZone('โซน A');
    const p = (await store.addPile(z.id, { name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 }))!;

    const profile = await store.get();
    expect(profile.zones).toHaveLength(1);
    expect(profile.zones[0].name).toBe('โซน A');
    expect(profile.zones[0].piles).toEqual([{ id: p.id, name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 }]);
  });

  it('renames a zone and edits a pile without changing either id', async () => {
    const z = await store.addZone('โซน A');
    const p = (await store.addPile(z.id, { name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 }))!;

    await store.renameZone(z.id, 'โซน ก');
    await store.editPile(p.id, { name: 'กอง หนึ่ง', tareG: 2_400 });

    const profile = await store.get();
    expect(profile.zones[0].id).toBe(z.id);
    expect(profile.zones[0].name).toBe('โซน ก');
    expect(profile.zones[0].piles[0]).toEqual({
      id: p.id,
      name: 'กอง หนึ่ง',
      tareG: 2_400,
      stdNetG: 50_000, // untouched by the patch
    });
  });

  it('removes a single pile, and removes a zone with its piles', async () => {
    const zA = await store.addZone('โซน A');
    const p1 = (await store.addPile(zA.id, { name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 }))!;
    await store.addPile(zA.id, { name: 'กอง 2', tareG: 2_000, stdNetG: 50_000 });
    const zB = await store.addZone('โซน B');

    await store.removePile(p1.id);
    expect((await store.get()).zones[0].piles.map((p) => p.name)).toEqual(['กอง 2']);

    await store.removeZone(zA.id);
    const after = await store.get();
    expect(after.zones.map((z) => z.id)).toEqual([zB.id]);
  });

  it('seeds an empty profile once, and never again', async () => {
    const zones = [
      { id: 'pz1', name: 'โซน A', piles: [{ id: 'pp1', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 }] },
    ];
    await store.seed(zones);

    const seeded = await store.get();
    expect(seeded.zones).toEqual(zones);
    expect(seeded.seededTs).not.toBeNull();

    await store.seed([{ id: 'pz2', name: 'โซน B', piles: [] }]);
    expect((await store.get()).zones.map((z) => z.name)).toEqual(['โซน A']);
  });

  it('does not re-seed a profile the owner has since emptied', async () => {
    await store.seed([{ id: 'pz1', name: 'โซน A', piles: [] }]);
    await store.removeZone('pz1');
    expect((await store.get()).zones).toEqual([]);

    // An intentionally emptied profile stays empty: `seededTs` outlives the
    // zones, so "empty" and "never seeded" are not the same state.
    await store.seed([{ id: 'pz2', name: 'โซน B', piles: [] }]);
    expect((await store.get()).zones).toEqual([]);
  });

  it('does not seed a profile the owner has already filled in by hand', async () => {
    await store.addZone('โซน มือ');
    await store.seed([{ id: 'pz1', name: 'โซน A', piles: [] }]);

    const after = await store.get();
    expect(after.zones.map((z) => z.name)).toEqual(['โซน มือ']);
    expect(after.seededTs).toBeNull();
  });

  it('edit, rename or remove on an unknown id is a no-op, not an error', async () => {
    await expect(store.renameZone('nope', 'x')).resolves.toBeUndefined();
    await expect(store.removeZone('nope')).resolves.toBeUndefined();
    await expect(store.editPile('nope', { name: 'x' })).resolves.toBeUndefined();
    await expect(store.removePile('nope')).resolves.toBeUndefined();
    await expect(store.addPile('nope', { name: 'x', tareG: 1, stdNetG: 2 })).resolves.toBeNull();
    expect(await store.get()).toEqual({ zones: [], seededTs: null });
  });
});

describe('profileZonesFromSale', () => {
  it('carries a sale’s zones and piles across, with fresh profile ids', () => {
    const state = projectSale(setUpSale(new LogBuilder('s1')).build(), 's1');
    const zones = profileZonesFromSale(state.zones, state.piles);

    expect(zones.map((z) => z.name)).toEqual(state.zones.map((z) => z.name));
    // Profile ids are its own — a profile zone is not a sale-scoped ZoneId.
    expect(zones.every((z) => !state.zones.some((sz) => sz.id === z.id))).toBe(true);
    expect(zones[0].piles.map((p) => ({ name: p.name, tareG: p.tareG, stdNetG: p.stdNetG }))).toEqual(
      state.piles
        .filter((p) => p.zoneId === state.zones[0].id)
        .map((p) => ({ name: p.name, tareG: p.tareG, stdNetG: p.stdNetG })),
    );
  });

  it('carries no worker or split — a contract is agreed fresh each sale', () => {
    const b = setUpSale(new LogBuilder('s2'));
    b.sys({ t: 'zone_contract_set', zoneId: 'zA', personId: 'per1', workerName: 'ประยุทธ', ownerPct: 60 });
    const state = projectSale(b.build(), 's2');
    expect(state.zones[0].contract).toBeTruthy();

    const zones = profileZonesFromSale(state.zones, state.piles);
    expect(JSON.stringify(zones)).not.toContain('ประยุทธ');
    expect(Object.keys(zones[0])).toEqual(['id', 'name', 'piles']);
  });

  it('leaves out zones and piles that were removed from the sale', () => {
    const b = setUpSale(new LogBuilder('s3'));
    b.sys({ t: 'pile_removed', pileId: 'p1', reason: 'พิมพ์ผิด' });
    b.sys({ t: 'zone_removed', zoneId: 'zB', reason: 'ไม่ได้ขาย' });
    const state = projectSale(b.build(), 's3');

    const zones = profileZonesFromSale(state.zones, state.piles);
    expect(zones.map((z) => z.name)).not.toContain('โซน B');
    expect(zones.flatMap((z) => z.piles).map((p) => p.name)).not.toContain('กอง 1');
  });
});
