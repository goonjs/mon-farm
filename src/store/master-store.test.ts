import { beforeEach, describe, expect, it } from 'vitest';

import { MASTER_SCOPE } from '../core/master';
import { createDeviceClock } from './device-clock';
import { DuplicatePointNameError, MasterStore } from './master-store';
import { MemoryStore } from './memory-store';
import { LogBuilder } from '../core/fixtures';

describe('MasterStore — people and buyers as events (E03-S01)', () => {
  let events: MemoryStore;
  let master: MasterStore;
  beforeEach(() => {
    events = new MemoryStore();
    master = new MasterStore(events, createDeviceClock(events));
  });

  it('every write is an event in the master scope, waiting in the outbox', async () => {
    const p = await master.create('แดง', ['tapper']);
    await master.rename(p.id, 'แดงใหม่');
    await master.remove(p.id);
    const log = await events.load(MASTER_SCOPE);
    expect(log.map((e) => e.kind)).toEqual(['master', 'master', 'delete']);
    expect((await events.pending()).length).toBe(3);
  });

  it('a rename keeps the id; a removed person leaves the list but still resolves, and restores', async () => {
    const p = await master.create('แดง', ['tapper']);
    await master.rename(p.id, 'แดงใหม่');
    expect(await master.get(p.id)).toMatchObject({ id: p.id, name: 'แดงใหม่' });

    await master.remove(p.id);
    expect(await master.list()).toEqual([]);
    expect(await master.get(p.id)).toMatchObject({ name: 'แดงใหม่', deleted: true });

    await master.restore(p.id);
    expect((await master.list()).map((x) => x.id)).toEqual([p.id]);
  });

  it('lists by role', async () => {
    await master.create('แดง', ['tapper']);
    await master.create('สมหวัง', ['manager', 'payer']);
    expect((await master.list('tapper')).map((p) => p.name)).toEqual(['แดง']);
    expect((await master.list('payer')).map((p) => p.name)).toEqual(['สมหวัง']);
  });

  it('refuses a person with no role (D-68)', async () => {
    await expect(master.create('แดง', [])).rejects.toThrow();
    const p = await master.create('แดง', ['tapper']);
    await expect(master.edit(p.id, { roles: [], otherRoles: [] })).rejects.toThrow();
    await master.edit(p.id, { roles: [], otherRoles: ['ลูกคนงาน'] });
    expect(await master.get(p.id)).toMatchObject({ roles: [], otherRoles: ['ลูกคนงาน'] });
  });

  it('buyers: add, rename, remove, restore', async () => {
    const b = await master.addBuyer('ล้ง ก');
    await master.renameBuyer(b.id, 'ล้ง ก ใหม่');
    expect((await master.state()).buyers).toMatchObject([{ id: b.id, name: 'ล้ง ก ใหม่', deleted: false }]);
    await master.remove(b.id);
    expect((await master.state()).buyers[0].deleted).toBe(true);
    await master.restore(b.id);
    expect((await master.state()).buyers[0].deleted).toBe(false);
  });

  it('master data is not a sale', async () => {
    await master.create('แดง', ['tapper']);
    expect(await events.listSales()).toEqual([]);
  });

  it('the latest buyer is the one the newest started sale picked; none if it typed a name', async () => {
    const b1 = await master.addBuyer('ล้ง ก');
    const start = (saleId: string, buyerId?: string) =>
      new LogBuilder(saleId, 'dev-other')
        .sys({ t: 'sale_started', farmName: 'สวน', buyer: 'x', ...(buyerId ? { buyerId } : {}), manager: '', workerLead: '', where: 'farm' })
        .build();
    expect(await master.latestBuyerId()).toBeNull();
    for (const e of start('sale-old', b1.id)) await events.append(e);
    expect(await master.latestBuyerId()).toBe(b1.id);
  });

  it('properties: add with optional fields, edit, record area history, delete and restore (E03-S02)', async () => {
    const f = await master.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber', plantedYearBe: 2554 });
    await master.recordArea(f.id, 12_000, '2026-01-01');
    await master.recordArea(f.id, 12_500, '2026-10-01');
    await master.editProperty(f.id, { name: 'สวนจันทเขลม 2', plantedYearBe: null });
    const got = (await master.state()).properties[0];
    expect(got).toMatchObject({ id: f.id, name: 'สวนจันทเขลม 2', plantedYearBe: null, gps: null });
    expect(got.areaHistory.map((a) => a.centiRai)).toEqual([12_500, 12_000]);
    await master.remove(f.id);
    expect((await master.state()).properties[0].deleted).toBe(true);
    await master.restore(f.id);
    expect((await master.state()).properties[0].deleted).toBe(false);
  });

  it('refuses a property with no name, or an area that is not > 0', async () => {
    await expect(master.addProperty({ name: ' ', crop: 'rubber' })).rejects.toThrow();
    const f = await master.addProperty({ name: 'ทุเรียน', crop: 'durian' });
    await expect(master.recordArea(f.id, 0, '2026-10-01')).rejects.toThrow();
  });

  it('points: add under a farm, refuse a name taken in that farm, rename, delete (E03-S03)', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const g = await master.addProperty({ name: 'ข', crop: 'rubber' });
    const p1 = await master.addPoint(f.id, 'จุด 1');
    await expect(master.addPoint(f.id, 'จุด 1')).rejects.toBeInstanceOf(DuplicatePointNameError);
    await master.addPoint(g.id, 'จุด 1');
    await expect(master.renamePoint(p1.id, ' ')).rejects.toThrow();
    await master.renamePoint(p1.id, 'จุดหน้า');
    expect((await master.state()).points.find((p) => p.id === p1.id)?.name).toBe('จุดหน้า');
  });

  it('the starter wizard writes one point per typed name and returns them with their tapper', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const made = await master.createStarterPoints([{ propertyId: f.id, tapperId: 't1', names: ['จุด 1', 'จุด 2'] }]);
    expect(made.map((m) => [m.name, m.tapperId])).toEqual([['จุด 1', 't1'], ['จุด 2', 't1']]);
    expect((await master.state()).points).toHaveLength(2);
    await expect(master.createStarterPoints([{ propertyId: f.id, tapperId: 't1', names: ['จุด 1'] }])).rejects.toThrow();
  });
});
