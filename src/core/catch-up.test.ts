import { describe, expect, it } from 'vitest';

import { basketGroups, openBasketIn, stdNetOfLog } from './bridge';
import { catchUpAllowed, catchUpPlan, writeCatchUp, type CatchUpOptions, type CatchUpPoint } from './catch-up';
import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { basketList, saleRollup } from './sale-points';
import { saleTotals } from './totals';
import type { MasterPayload, SaleEvent } from './types';

/** แดง: p1, p2, p3 · นัด: p9. Standard net 50 kg, basket 2 kg. */
function master() {
  const events: SaleEvent[] = [];
  let n = 0;
  const add = (payload: MasterPayload) => {
    n += 1;
    events.push({ id: `m${n}`, groupId: 'group-1', saleId: MASTER_SCOPE, seq: n, deviceSeq: n, ts: 0, mono: 0, actor: { userId: 'u', deviceId: 'd' }, source: 'app', kind: 'master', payload });
  };
  add({ t: 'property_added', propertyId: 'fA', name: 'ก', crop: 'rubber' });
  for (const p of ['p1', 'p2', 'p3', 'p9']) add({ t: 'point_added', pointId: p, propertyId: 'fA', name: p });
  for (const [p, who] of [['p1', 'red'], ['p2', 'red'], ['p3', 'red'], ['p9', 'nat']]) add({ t: 'tapper_assigned', assignmentId: `a-${p}`, pointId: p, tapperId: who });
  return projectMaster(events);
}
const DAY = '2026-10-09';
const KG = 1000;
const O: CatchUpOptions = { mode: 'per-tapper', firstNo: 1, stdNetG: 50 * KG, tareG: 2 * KG };
const pt = (pointId: string, endNo: number, lastShortG: number | null, topUpG: number | null = null): CatchUpPoint => ({ pointId, endNo, lastShortG, topUpG });

function sale() {
  const b = new LogBuilder('sale-x');
  for (const p of ['p1', 'p2', 'p3', 'p9']) b.sys({ t: 'pile_added', pileId: p, zoneId: 'fA', name: p, tareG: 2 * KG, stdNetG: 50 * KG });
  return b;
}
/** Writes a plan into a log the way the screen's `append` does. */
function written(points: CatchUpPoint[], o = O, b = sale()) {
  const plan = catchUpPlan(points, o);
  if (!plan) throw new Error('no plan');
  writeCatchUp(plan.drafts, (body) => b.push(body));
  return { plan, events: b.build() };
}

describe('E04-S19 — catch up from the paper, point by point (continuous per tapper)', () => {
  it('the paper sample: 1–11 full, 12 = 30 + 20 at p3, 13–20 full, 21 still open at 22 → 1,022 kg in 21 baskets', () => {
    const { plan, events } = written([pt('p1', 12, 30 * KG), pt('p3', 21, 22 * KG, 20 * KG)]);
    expect(plan.totalG).toBe(1_022 * KG);
    expect(plan.baskets).toBe(21);
    expect(plan.lastNo).toBe(21);
    expect(plan.rows).toEqual([
      { kind: 'full', pointId: 'p1', from: 1, to: 11, count: 11, netG: 550 * KG },
      { kind: 'short', pointId: 'p1', basketNo: 12, firstG: 30 * KG, topUps: [{ pointId: 'p3', g: 20 * KG }], netG: 50 * KG, status: 'full' },
      { kind: 'full', pointId: 'p3', from: 13, to: 20, count: 8, netG: 400 * KG },
      { kind: 'short', pointId: 'p3', basketNo: 21, firstG: 22 * KG, topUps: [], netG: 22 * KG, status: 'open' },
    ]);
    // The log agrees: same total, basket 12 full across two points, 21 open to fill live (BF-5).
    expect(saleTotals(events)).toMatchObject({ netG: 1_022 * KG });
    expect(saleRollup(events, master(), DAY).byTapper.get('red')?.netG).toBe(1_022 * KG);
    // p3's own share: the 20 kg top-up, 13–20 and the 22 kg in basket 21.
    expect(saleRollup(events, master(), DAY).byPoint.get('p3')?.netG).toBe(442 * KG);
    const groups = [...basketGroups(events, stdNetOfLog(events)).values()];
    expect(groups.map((g) => [g.basketNo, g.status, g.netG])).toEqual([[12, 'full', 50 * KG], [21, 'open', 22 * KG]]);
    expect(openBasketIn(events, master(), DAY, 'p3', 'per-tapper', stdNetOfLog(events))).toMatchObject({ basketNo: 21, haveG: 22 * KG, missingG: 28 * KG });
    // Every basket says "บันทึกย้อนหลัง" (BF-12).
    expect(basketList(events).every((r) => r.backfill)).toBe(true);
    expect(basketList(events).map((r) => r.basketNo)).toEqual([21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('not topped up: basket 12 closes at 30 kg, nothing is added → 1,002 kg', () => {
    const { plan, events } = written([pt('p1', 12, 30 * KG), pt('p3', 21, 22 * KG, 0)]);
    expect(plan.totalG).toBe(1_002 * KG);
    expect(plan.rows[1]).toMatchObject({ basketNo: 12, topUps: [], netG: 30 * KG, status: 'closed' });
    expect(saleTotals(events).netG).toBe(1_002 * KG);
    const g12 = [...basketGroups(events, stdNetOfLog(events)).values()].find((g) => g.basketNo === 12);
    expect(g12?.status).toBe('closed');
  });

  it('a short basket at the very first point, topped up at the next', () => {
    const { plan } = written([pt('p1', 1, 30 * KG), pt('p2', 9, null, 20 * KG)]);
    expect(plan.totalG).toBe(450 * KG);
    expect(plan.rows).toEqual([
      { kind: 'short', pointId: 'p1', basketNo: 1, firstG: 30 * KG, topUps: [{ pointId: 'p2', g: 20 * KG }], netG: 50 * KG, status: 'full' },
      { kind: 'full', pointId: 'p2', from: 2, to: 9, count: 8, netG: 400 * KG },
    ]);
  });

  it('an over-fill keeps its extra in the total (30 + 25 = 55)', () => {
    const { plan, events } = written([pt('p1', 8, 30 * KG), pt('p2', 12, null, 25 * KG)]);
    expect(plan.rows[1]).toMatchObject({ basketNo: 8, netG: 55 * KG, status: 'full' });
    expect(plan.totalG).toBe(7 * 50 * KG + 55 * KG + 4 * 50 * KG);
    expect(saleTotals(events).netG).toBe(plan.totalG);
  });

  it('a top-up that does not reach full carries on; a point that only tops up adds no basket', () => {
    // p2 adds 12 and starts nothing (ends at 6 = its start − 1); p3 adds the last 8, then 7–9.
    const { plan, events } = written([pt('p1', 6, 30 * KG), pt('p2', 6, null, 12 * KG), pt('p3', 9, null, 8 * KG)]);
    expect(plan.rows).toEqual([
      { kind: 'full', pointId: 'p1', from: 1, to: 5, count: 5, netG: 250 * KG },
      { kind: 'short', pointId: 'p1', basketNo: 6, firstG: 30 * KG, topUps: [{ pointId: 'p2', g: 12 * KG }, { pointId: 'p3', g: 8 * KG }], netG: 50 * KG, status: 'full' },
      { kind: 'full', pointId: 'p3', from: 7, to: 9, count: 3, netG: 150 * KG },
    ]);
    expect(plan.totalG).toBe(450 * KG);
    expect(saleTotals(events).netG).toBe(450 * KG);
  });

  it('a top-up that falls short and then new baskets at that point: the basket closes short there', () => {
    const { plan } = written([pt('p1', 6, 30 * KG), pt('p2', 8, null, 12 * KG)]);
    expect(plan.rows[1]).toMatchObject({ basketNo: 6, netG: 42 * KG, status: 'closed' });
    expect(plan.totalG).toBe(5 * 50 * KG + 42 * KG + 2 * 50 * KG);
  });

  it('per point: every point starts at basket 1, a short basket stays open at its own point, nothing is topped up across', () => {
    const { plan, events } = written([pt('p1', 12, 18_500), pt('p2', 7, null, 99 * KG)], { ...O, mode: 'per-point' });
    expect(plan.rows).toEqual([
      { kind: 'full', pointId: 'p1', from: 1, to: 11, count: 11, netG: 550 * KG },
      { kind: 'short', pointId: 'p1', basketNo: 12, firstG: 18_500, topUps: [], netG: 18_500, status: 'open' },
      { kind: 'full', pointId: 'p2', from: 1, to: 7, count: 7, netG: 350 * KG },
    ]);
    expect(plan.totalG).toBe(918_500);
    expect(openBasketIn(events, master(), DAY, 'p1', 'per-point', stdNetOfLog(events))).toMatchObject({ basketNo: 12 });
  });

  it('nothing that cannot be right is planned', () => {
    expect(catchUpPlan([], O)).toBeNull();
    // An end before the start, or a "top-up only" point with nothing to top up.
    expect(catchUpPlan([pt('p1', 0, null)], O)).toBeNull();
    expect(catchUpPlan([pt('p1', 5, null), pt('p2', 5, null)], O)).toBeNull();
    expect(catchUpPlan([pt('p1', 5, null), pt('p2', 3, null)], O)).toBeNull();
    // A short basket is more than 0 and less than a full one.
    expect(catchUpPlan([pt('p1', 5, 0)], O)).toBeNull();
    expect(catchUpPlan([pt('p1', 5, 50 * KG)], O)).toBeNull();
    // The basket left short must be answered at the next point (BF-4).
    expect(catchUpPlan([pt('p1', 5, 30 * KG), pt('p2', 8, null)], O)).toBeNull();
    // A top-up cannot make one basket more than 1.5 full ones.
    expect(catchUpPlan([pt('p1', 5, 30 * KG), pt('p2', 8, null, 46 * KG)], O)).toBeNull();
    expect(catchUpPlan([pt('p1', 5, 30 * KG), pt('p2', 8, null, 45 * KG)], O)).not.toBeNull();
  });

  it('numbers carry on from firstNo in the tapper\'s sequence', () => {
    expect(catchUpPlan([pt('p1', 14, null)], { ...O, firstNo: 4 })?.rows).toEqual([{ kind: 'full', pointId: 'p1', from: 4, to: 14, count: 11, netG: 550 * KG }]);
  });
});

describe('E04-S19 BF-8 — only before live counting', () => {
  it('continuous: allowed while the tapper has no basket; another tapper\'s baskets do not matter', () => {
    const b = sale();
    expect(catchUpAllowed(b.build(), master(), DAY, 'p1', 'per-tapper')).toBe(true);
    b.acceptAt('p9', 1);
    expect(catchUpAllowed(b.build(), master(), DAY, 'p1', 'per-tapper')).toBe(true);
    b.acceptAt('p2', 1);
    expect(catchUpAllowed(b.build(), master(), DAY, 'p1', 'per-tapper')).toBe(false);
  });

  it('per point: only the point\'s own baskets block it', () => {
    const b = sale().acceptAt('p2', 1);
    expect(catchUpAllowed(b.build(), master(), DAY, 'p1', 'per-point')).toBe(true);
    expect(catchUpAllowed(b.build(), master(), DAY, 'p2', 'per-point')).toBe(false);
  });
});
