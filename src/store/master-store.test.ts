import { beforeEach, describe, expect, it } from 'vitest';

import { MASTER_SCOPE, saleSettings, shareOn, tapperOn } from '../core/master';
import { createDeviceClock } from './device-clock';
import { NotSignedInError, setSessionGroup, setSessionUser } from './session';
import { NoGroupError } from '../core/scope';
import { DuplicatePointNameError, InvalidInputError, MasterStore, ShareTooEarlyError } from './master-store';
import { MemoryStore } from './memory-store';
import { LogBuilder, setUpSale, withZoneContract } from '../core/fixtures';

describe('MasterStore — people and buyers as events (E03-S01)', () => {
  let events: MemoryStore;
  let master: MasterStore;
  beforeEach(() => {
    setSessionUser('user-1');
    setSessionGroup('group-1');
    events = new MemoryStore();
    master = new MasterStore(events, createDeviceClock(events));
  });

  it('every farm-data event names the signed-in user and the open group (E02-S01/S02, D-24)', async () => {
    const p = await master.create('แดง', ['tapper']);
    await master.remove(p.id);
    const log = await events.load(MASTER_SCOPE);
    expect(log).toHaveLength(2);
    for (const e of log) {
      expect(e.groupId).toBe('group-1');
      expect(e.actor.userId).toBe('user-1');
    }
  });

  it('with no open group a write fails and stores nothing (D-24)', async () => {
    setSessionGroup(null);
    await expect(master.create('แดง', ['tapper'])).rejects.toBeInstanceOf(NoGroupError);
    expect(await events.load(MASTER_SCOPE)).toEqual([]);
  });

  it('with nobody signed in a write fails and stores nothing (ACC-6)', async () => {
    setSessionUser(null);
    await expect(master.create('แดง', ['tapper'])).rejects.toBeInstanceOf(NotSignedInError);
    expect(await events.load(MASTER_SCOPE)).toEqual([]);
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

  it('zones: add under a farm with an effective day, refuse a taken name or a bad day, rename (E11-S10)', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const z = await master.addZone(f.id, ' โซนริมคลอง ', '2026-10-01');
    expect(z).toMatchObject({ propertyId: f.id, name: 'โซนริมคลอง', effective: '2026-10-01' });
    await expect(master.addZone(f.id, 'โซนริมคลอง', '2026-10-01')).rejects.toBeInstanceOf(InvalidInputError);
    await expect(master.addZone(f.id, ' ', '2026-10-01')).rejects.toBeInstanceOf(InvalidInputError);
    await expect(master.addZone(f.id, 'หลังบ้าน', '1/10')).rejects.toBeInstanceOf(InvalidInputError);
    await expect(master.addZone('no-such-farm', 'หลังบ้าน', '2026-10-01')).rejects.toBeInstanceOf(InvalidInputError);
    await master.renameZone(z.id, 'ริมคลอง');
    expect((await master.state()).zones.map((x) => x.name)).toEqual(['ริมคลอง']);
  });

  it('refuses a point under a farm that is missing or deleted — no orphan points', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    await master.remove(f.id);
    await expect(master.addPoint(f.id, 'จุด 1')).rejects.toBeInstanceOf(InvalidInputError);
    await expect(master.addPoint('no-such-farm', 'จุด 1')).rejects.toBeInstanceOf(InvalidInputError);
    expect((await master.state()).points).toEqual([]);
  });

  it('the starter wizard writes one point per typed name and returns them with their tapper', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const made = await master.createStarterPoints([{ propertyId: f.id, tapperId: 't1', names: ['จุด 1', 'จุด 2'] }]);
    expect(made.map((m) => [m.name, m.tapperId])).toEqual([['จุด 1', 't1'], ['จุด 2', 't1']]);
    // E03-S05: each point starts with its tapper, no start date (D-63).
    const st = await master.state();
    expect(made.map((m) => tapperOn(st, m.id, '2000-01-01'))).toEqual(['t1', 't1']);
    expect((await master.state()).points).toHaveLength(2);
    await expect(master.createStarterPoints([{ propertyId: f.id, tapperId: 't1', names: ['จุด 1'] }])).rejects.toThrow();
  });

  it('assign, plan a change, leave without replacement, cancel a plan (E03-S05)', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const p = await master.addPoint(f.id, 'จุด 1');
    await master.assignTapper(p.id, 'red', null);
    const plan = await master.assignTapper(p.id, 'nat', '2026-12-01');
    let s = await master.state();
    expect([tapperOn(s, p.id, '2026-11-30'), tapperOn(s, p.id, '2026-12-01')]).toEqual(['red', 'nat']);
    await master.remove(plan);
    s = await master.state();
    expect(tapperOn(s, p.id, '2026-12-01')).toBe('red');
    await master.endTapper(p.id, '2027-01-01');
    s = await master.state();
    expect(tapperOn(s, p.id, '2027-01-01')).toBeNull();
  });

  it('shares: set from a date; refuse a start on or before the tapper\'s latest closed sale (E03-S06)', async () => {
    const red = await master.create('แดง', ['tapper']);
    // A closed sale in which แดง holds a zone, started 18 Sep 2026 (Bangkok).
    const b = withZoneContract(setUpSale(new LogBuilder('sale-closed', 'dev-other')), 'zA', red.id, 'แดง', 50);
    b.sys({ t: 'sale_closed' });
    const ts = Date.UTC(2026, 8, 18, 3);
    for (const e of b.build()) await events.append({ ...e, ts });
    expect(await master.lastClosedSaleDay(red.id)).toBe('2026-09-18');
    await expect(master.setShare(red.id, 55, '2026-09-18')).rejects.toBeInstanceOf(ShareTooEarlyError);
    await master.setShare(red.id, 55, '2026-09-19');
    await expect(master.setShare(red.id, 101, '2026-10-01')).rejects.toThrow();
    expect(shareOn(await master.state(), red.id, '2026-09-19')).toMatchObject({ tapperPct: 55, ownerPct: 45 });
  });

  it('a cancelled sale does not hold back a share; a completed one does (E04-S11)', async () => {
    const red = await master.create('แดง', ['tapper']);
    const cancelled = withZoneContract(setUpSale(new LogBuilder('sale-cancelled', 'dev-other')), 'zA', red.id, 'แดง', 50);
    cancelled.sys({ t: 'sale_closed' }).sys({ t: 'sale_status_set', status: 'cancelled' });
    for (const e of cancelled.build()) await events.append({ ...e, ts: Date.UTC(2026, 8, 20, 3) });
    expect(await master.lastClosedSaleDay(red.id)).toBeNull();
    const done = withZoneContract(setUpSale(new LogBuilder('sale-completed', 'dev-other')), 'zA', red.id, 'แดง', 50);
    done.sys({ t: 'price_set', satangPerKg: 4_850, indexRef: '' }).sys({ t: 'sale_status_set', status: 'completed' });
    for (const e of done.build()) await events.append({ ...e, ts: Date.UTC(2026, 8, 21, 3) });
    expect(await master.lastClosedSaleDay(red.id)).toBe('2026-09-21');
  });

  it('sale settings: patch, add a pair in whole kg, make it default; refuse out-of-range values (E03-S07)', async () => {
    await master.updateSettings({ zeroCheck: 'skip', dupWindowS: 9 });
    await expect(master.updateSettings({ dupWindowS: 12 })).rejects.toThrow();
    const id = await master.addPair(55, 3);
    await master.setDefaultPair(id);
    await expect(master.addPair(0, 3)).rejects.toThrow();
    const s = saleSettings(await master.state());
    expect(s).toMatchObject({ zeroCheck: 'skip', dupWindowS: 9 });
    expect(s.pairs.find((p) => p.isDefault)).toMatchObject({ netG: 55_000, basketG: 3_000 });
  });

  it('refuses a blank start once the point has an assignment (review fix)', async () => {
    const f = await master.addProperty({ name: 'ก', crop: 'rubber' });
    const p = await master.addPoint(f.id, 'จุด 1');
    await master.assignTapper(p.id, 'red', null);
    await expect(master.assignTapper(p.id, 'nat', null)).rejects.toThrow();
  });
});
