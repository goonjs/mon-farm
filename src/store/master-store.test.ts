import { beforeEach, describe, expect, it } from 'vitest';

import { MASTER_SCOPE } from '../core/master';
import { createDeviceClock } from './device-clock';
import { MasterStore } from './master-store';
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
});
