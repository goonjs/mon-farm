import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { basketList, saleRollup } from './sale-points';
import { pileTotals, saleTotals, zoneTotals } from './totals';
import { projectSale } from './project';
import type { MasterPayload, SaleEvent, Totals } from './types';

/**
 * E04-S25 — a short basket topped up until full is 1 full basket everywhere;
 * the top-up part is never a basket of its own (owner 2026-11-20).
 *
 * Farm fA: p1, p2 → red; p3 → nat. Standard net 50 kg, basket 2 kg.
 */
function master() {
  const events: SaleEvent[] = [];
  let n = 0;
  const add = (payload: MasterPayload) => {
    n += 1;
    events.push({ id: `m${n}`, groupId: 'group-1', saleId: MASTER_SCOPE, seq: n, deviceSeq: n, ts: 0, mono: 0, actor: { userId: 'u', deviceId: 'd' }, source: 'app', kind: 'master', payload });
  };
  add({ t: 'property_added', propertyId: 'fA', name: 'ก', crop: 'rubber' });
  for (const p of ['p1', 'p2', 'p3']) add({ t: 'point_added', pointId: p, propertyId: 'fA', name: p });
  for (const [p, who] of [['p1', 'red'], ['p2', 'red'], ['p3', 'nat']]) add({ t: 'tapper_assigned', assignmentId: `a-${p}`, pointId: p, tapperId: who });
  return projectMaster(events);
}
const DAY = '2026-10-09';

/** A log like the owner's sale of 2026-11-20, small. */
function ownersCase(): SaleEvent[] {
  const b = new LogBuilder('sale-x');
  b.sys({ t: 'zone_added', zoneId: 'fA', name: 'ก' });
  for (const p of ['p1', 'p2', 'p3']) b.sys({ t: 'pile_added', pileId: p, zoneId: 'fA', name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt('p1', 1).acceptAt('p1', 2);
  // #3: 20 kg short, topped up to full at the same point.
  b.shortAt('p1', 3, 22_000);
  b.partAt(b.build().at(-1)!.id, 'p1', 3, 30_000);
  // #4: 25 kg short, topped up to full at the tapper's other point p2.
  b.shortAt('p1', 4, 27_000);
  b.partAt(b.build().at(-1)!.id, 'p2', 4, 25_000);
  // #5: 12 kg, really short — closed as scrap.
  b.shortAt('p1', 5, 14_000);
  b.sys({ t: 'basket_closed', basketId: b.build().at(-1)!.id, reason: 'scrap' });
  // nat #1: 20 kg, topped up by 12 kg and still short (32 kg), then closed.
  b.shortAt('p3', 1, 22_000);
  const nat1 = b.build().at(-1)!.id;
  b.shortPartAt(nat1, 'p3', 1, 14_000);
  b.sys({ t: 'basket_closed', basketId: nat1, reason: 'scrap' });
  return b.build();
}

const count = (t: Totals) => ({ baskets: t.baskets, standardBaskets: t.standardBaskets, shortBaskets: t.shortBaskets, netG: t.netG, standardNetG: t.standardNetG, shortNetG: t.shortNetG });

describe('E04-S25 — a topped-up basket is 1 full basket everywhere', () => {
  const events = ownersCase();
  const SALE = { baskets: 6, standardBaskets: 4, shortBaskets: 2, netG: 244_000, standardNetG: 200_000, shortNetG: 44_000 };

  it('TB-1/2/3/4: the top card (tally) counts 4 full + 2 short, 44 kg short; total weight unchanged', () => {
    expect(count(saleTotals(events))).toEqual(SALE);
  });

  it('TB-5: the short rows under the top card are as many as its short count, and sum to its short kg', () => {
    const rows = basketList(events).filter((r) => r.short && r.status === 'live');
    expect(rows.map((r) => r.basketNo).sort()).toEqual([1, 5]);
    expect(rows.reduce((s, r) => s + r.netG, 0)).toBe(saleTotals(events).shortNetG);
    expect(rows.length).toBe(saleTotals(events).shortBaskets);
  });

  it('TB-1/2: the rollup agrees with the top card; tapper cards add up to the top card', () => {
    const r = saleRollup(events, master(), DAY);
    expect(count(r.sale)).toEqual(SALE);
    const tappers = [...r.byTapper.values()];
    expect(tappers.reduce((s, t) => s + t.baskets, 0)).toBe(saleTotals(events).baskets);
    expect(count(r.byTapper.get('red')!)).toEqual({ baskets: 5, standardBaskets: 4, shortBaskets: 1, netG: 212_000, standardNetG: 200_000, shortNetG: 12_000 });
    expect(count(r.byTapper.get('nat')!)).toEqual({ baskets: 1, standardBaskets: 0, shortBaskets: 1, netG: 32_000, standardNetG: 0, shortNetG: 32_000 });
    expect(count(r.byFarm.get('fA')!)).toEqual(SALE);
  });

  it('S2: a top-up at another point counts its basket at the first part\'s point; its weight stays where it was weighed', () => {
    const r = saleRollup(events, master(), DAY);
    const P1 = { baskets: 5, standardBaskets: 4, shortBaskets: 1, netG: 187_000, standardNetG: 175_000, shortNetG: 12_000 };
    const P2 = { baskets: 0, standardBaskets: 0, shortBaskets: 0, netG: 25_000, standardNetG: 25_000, shortNetG: 0 };
    const P3 = { baskets: 1, standardBaskets: 0, shortBaskets: 1, netG: 32_000, standardNetG: 0, shortNetG: 32_000 };
    expect(count(r.byPoint.get('p1')!)).toEqual(P1);
    expect(count(r.byPoint.get('p2')!)).toEqual(P2);
    expect(count(r.byPoint.get('p3')!)).toEqual(P3);
    // Piles are the points (pointSetupPayloads): the pile model says the same.
    expect(count(pileTotals(events, 'p1'))).toEqual(P1);
    expect(count(pileTotals(events, 'p2'))).toEqual(P2);
    expect(count(pileTotals(events, 'p3'))).toEqual(P3);
    expect(count(zoneTotals(events, projectSale(events, 'sale-x'), 'fA'))).toEqual(SALE);
  });

  it('TB-3: a short basket nobody topped up stays short, as before', () => {
    const b = new LogBuilder('sale-y');
    b.sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt('p1', 1).shortAt('p1', 2, 22_000);
    expect(count(saleTotals(b.build()))).toEqual({ baskets: 2, standardBaskets: 1, shortBaskets: 1, netG: 70_000, standardNetG: 50_000, shortNetG: 20_000 });
  });
});
