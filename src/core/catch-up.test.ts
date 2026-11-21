import { describe, expect, it } from 'vitest';

import { basketGroups, openBasketIn, stdNetOfLog } from './bridge';
import { catchUpAllowed, catchUpPlan, writeCatchUp, type CatchUpOpen, type CatchUpOptions, type CatchUpPoint } from './catch-up';
import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { basketList, nextBasketNo, saleRollup } from './sale-points';
import { saleTotals } from './totals';
import type { FinanceEvent, FinancePayload } from './finance/types';
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

  it('review B1: each point weighs with its own basket pair; a carried basket is judged by its first point\'s', () => {
    // p1 is a 50 kg / 2 kg pile, p2 a 40 kg / 3 kg one.
    const b = new LogBuilder('sale-mixed');
    b.sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2 * KG, stdNetG: 50 * KG });
    b.sys({ t: 'pile_added', pileId: 'p2', zoneId: 'fA', name: 'p2', tareG: 3 * KG, stdNetG: 40 * KG });
    const p40 = { stdNetG: 40 * KG, tareG: 3 * KG };
    // p1: 1–2 full, 3 short 30 (of 50) · p2: 3 topped up by 20 → 50 = full by p1's standard; 4–5 full at 40; 6 short 35.
    const points: CatchUpPoint[] = [pt('p1', 3, 30 * KG), { ...pt('p2', 6, 35 * KG, 20 * KG), pair: p40 }];
    const { plan, events } = written(points, O, b);
    expect(plan.rows).toEqual([
      { kind: 'full', pointId: 'p1', from: 1, to: 2, count: 2, netG: 100 * KG },
      { kind: 'short', pointId: 'p1', basketNo: 3, firstG: 30 * KG, topUps: [{ pointId: 'p2', g: 20 * KG }], netG: 50 * KG, status: 'full' },
      { kind: 'full', pointId: 'p2', from: 4, to: 5, count: 2, netG: 80 * KG },
      { kind: 'short', pointId: 'p2', basketNo: 6, firstG: 35 * KG, topUps: [], netG: 35 * KG, status: 'open' },
    ]);
    // The plan agrees with the app's own fold, which reads each pile's standard.
    expect(saleTotals(events).netG).toBe(plan.totalG);
    expect(plan.totalG).toBe(265 * KG);
    const groups = [...basketGroups(events, stdNetOfLog(events)).values()];
    expect(groups.map((g) => [g.basketNo, g.status])).toEqual([[3, 'full'], [6, 'open']]);
    // p2's own baskets carry p2's tare.
    expect(events.filter((e) => e.kind === 'accept' && e.pointId === 'p2' && !e.partOf).map((e) => (e as { tareG: number }).tareG)).toEqual([3 * KG, 3 * KG]);
    // A short basket at p2 is judged against 40 kg: 45 is not short there.
    expect(catchUpPlan([pt('p1', 3, null), { ...pt('p2', 6, 45 * KG), pair: p40 }], O)).toBeNull();
  });

  it('numbers carry on from firstNo in the tapper\'s sequence', () => {
    expect(catchUpPlan([pt('p1', 14, null)], { ...O, firstNo: 4 })?.rows).toEqual([{ kind: 'full', pointId: 'p1', from: 4, to: 14, count: 11, netG: 550 * KG }]);
  });
});

/** The open short basket of a log, as the screen hands it to the plan (from `openBasketIn` and its root pile). */
function openOf(events: SaleEvent[], pointId: string, mode: 'per-tapper' | 'per-point'): CatchUpOpen {
  const o = openBasketIn(events, master(), DAY, pointId, mode, stdNetOfLog(events));
  if (!o) throw new Error('no open basket');
  return { rootId: o.rootId, basketNo: o.basketNo, pointId: o.pointId, haveG: o.haveG, stdNetG: o.haveG + o.missingG, tareG: o.tareG };
}
const tapperOf = (id: string) => (id === 'p9' ? 'nat' : 'red');

describe('E04-S26 AT-1/AT-2 — catch up at any time, numbered on from the last basket', () => {
  it('continuous: after แดง counted 1–3 live at p1, a catch-up at p2 runs on from 4, never inserting', () => {
    const b = sale().acceptAt('p1', 1).acceptAt('p1', 2).acceptAt('p1', 3);
    const firstNo = nextBasketNo(b.build(), 'p2', 'per-tapper', tapperOf);
    expect(firstNo).toBe(4);
    const { plan, events } = written([pt('p2', 6, null)], { ...O, firstNo }, b);
    expect(plan.rows).toEqual([{ kind: 'full', pointId: 'p2', from: 4, to: 6, count: 3, netG: 150 * KG }]);
    expect(basketList(events).map((r) => r.basketNo)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('two catch-ups one after the other: the numbers carry on each time', () => {
    const b = sale().acceptAt('p1', 1);
    written([pt('p2', 3, null)], { ...O, firstNo: nextBasketNo(b.build(), 'p2', 'per-tapper', tapperOf) }, b);
    b.acceptAt('p2', 4);
    const second = written([pt('p3', 7, null)], { ...O, firstNo: nextBasketNo(b.build(), 'p3', 'per-tapper', tapperOf) }, b);
    expect(second.plan.rows[0]).toMatchObject({ from: 5, to: 7 });
    expect(basketList(second.events).map((r) => r.basketNo)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it('review N1 — per point: each point starts at its own next basket, not at 1 and not at the options\' firstNo', () => {
    const b = sale().acceptAt('p1', 1).acceptAt('p1', 2);
    const points: CatchUpPoint[] = [{ ...pt('p1', 4, null), firstNo: 3 }, { ...pt('p2', 2, null), firstNo: 1 }];
    const { plan, events } = written(points, { ...O, mode: 'per-point', firstNo: 99 }, b);
    expect(plan.rows).toEqual([
      { kind: 'full', pointId: 'p1', from: 3, to: 4, count: 2, netG: 100 * KG },
      { kind: 'full', pointId: 'p2', from: 1, to: 2, count: 2, netG: 100 * KG },
    ]);
    expect(plan.baskets).toBe(4);
    expect(nextBasketNo(events, 'p1', 'per-point', tapperOf)).toBe(5);
  });
});

describe('E04-S26 AT-3 — a short basket still open from counting live is asked about first', () => {
  /** แดง counted 1–2 full and 3 short (30 kg) live at p1; basket 3 is open. */
  const live = () => sale().acceptAt('p1', 1).acceptAt('p1', 2).shortAt('p1', 3, 32 * KG);

  it('review N2 — topped up at the first point entered: the part names the basket already in the log, and it closes full', () => {
    const b = live();
    const open = openOf(b.build(), 'p2', 'per-tapper');
    expect(open).toMatchObject({ basketNo: 3, haveG: 30 * KG, stdNetG: 50 * KG, tareG: 2 * KG });
    const plan = catchUpPlan([{ ...pt('p2', 6, null, 20 * KG), open }], { ...O, firstNo: 4 });
    expect(plan?.drafts[0]).toEqual({ kind: 'accept', pointId: 'p2', basketNo: 3, netG: 20 * KG, tareG: 2 * KG, partOf: open.rootId });
    const { events } = written([{ ...pt('p2', 6, null, 20 * KG), open }], { ...O, firstNo: 4 }, b);
    const g3 = [...basketGroups(events, stdNetOfLog(events)).values()].find((g) => g.basketNo === 3);
    expect(g3).toMatchObject({ status: 'full', netG: 50 * KG, partsG: [30 * KG, 20 * KG] });
    // The summary shows the basket; the Σ adds only what this catch-up adds (the 30 kg was counted live).
    expect(plan?.rows[0]).toMatchObject({ kind: 'short', basketNo: 3, firstG: 30 * KG, liveG: 30 * KG, netG: 50 * KG, status: 'full' });
    expect(plan?.totalG).toBe(20 * KG + 3 * 50 * KG);
    expect(plan?.baskets).toBe(3);
    expect(saleTotals(events).netG).toBe(130 * KG + plan!.totalG);
  });

  it('not topped up: it is closed short by name, never by moving past it silently', () => {
    const b = live();
    const open = openOf(b.build(), 'p2', 'per-tapper');
    const { plan, events } = written([{ ...pt('p2', 5, null, 0), open }], { ...O, firstNo: 4 }, b);
    expect(plan.drafts[0]).toEqual({ kind: 'close', root: open.rootId });
    expect(plan.rows[0]).toMatchObject({ basketNo: 3, netG: 30 * KG, liveG: 30 * KG, status: 'closed' });
    expect(plan.totalG).toBe(100 * KG);
    const closes = events.filter((e) => e.kind === 'sys' && e.payload.t === 'basket_closed');
    expect(closes.map((e) => (e as { payload: { basketId: string } }).payload.basketId)).toEqual([open.rootId]);
  });

  it('nothing chosen for you: unanswered, there is no plan', () => {
    const open = openOf(live().build(), 'p2', 'per-tapper');
    expect(catchUpPlan([{ ...pt('p2', 6, null, null), open }], { ...O, firstNo: 4 })).toBeNull();
  });

  it('a top-up that still falls short and no new basket here: the basket stays open, to fill live', () => {
    const b = live();
    const open = openOf(b.build(), 'p2', 'per-tapper');
    const { plan, events } = written([{ ...pt('p2', 3, null, 10 * KG), open }], { ...O, firstNo: 4 }, b);
    expect(plan.rows).toEqual([{ kind: 'short', pointId: 'p1', basketNo: 3, firstG: 30 * KG, liveG: 30 * KG, topUps: [{ pointId: 'p2', g: 10 * KG }], netG: 40 * KG, status: 'open' }]);
    expect(plan.baskets).toBe(0);
    expect(openBasketIn(events, master(), DAY, 'p2', 'per-tapper', stdNetOfLog(events))).toMatchObject({ basketNo: 3, haveG: 40 * KG });
  });

  it('review note 3 — continuous: an open basket passed at a later point, with one already carried, gives no plan', () => {
    const open = openOf(live().build(), 'p2', 'per-tapper');
    expect(catchUpPlan([pt('p1', 5, 30 * KG), { ...pt('p2', 6, null, 20 * KG), open }], { ...O, firstNo: 4 })).toBeNull();
  });

  it('a top-up past one and a half full baskets is refused', () => {
    const open = openOf(live().build(), 'p2', 'per-tapper');
    expect(catchUpPlan([{ ...pt('p2', 6, null, 46 * KG), open }], { ...O, firstNo: 4 })).toBeNull();
  });

  it('review N4 — per point: the open basket is asked at that same point, before its new baskets', () => {
    const b = live();
    const open = openOf(b.build(), 'p1', 'per-point');
    const points: CatchUpPoint[] = [{ ...pt('p1', 5, null, 20 * KG), firstNo: 4, open }, { ...pt('p2', 2, null), firstNo: 1 }];
    const { plan, events } = written(points, { ...O, mode: 'per-point' }, b);
    expect(plan.rows).toEqual([
      { kind: 'short', pointId: 'p1', basketNo: 3, firstG: 30 * KG, liveG: 30 * KG, topUps: [{ pointId: 'p1', g: 20 * KG }], netG: 50 * KG, status: 'full' },
      { kind: 'full', pointId: 'p1', from: 4, to: 5, count: 2, netG: 100 * KG },
      { kind: 'full', pointId: 'p2', from: 1, to: 2, count: 2, netG: 100 * KG },
    ]);
    expect([...basketGroups(events, stdNetOfLog(events)).values()].find((g) => g.basketNo === 3)?.status).toBe('full');
    // Per point, a point with no open basket is not asked, and its top-up answer means nothing.
    expect(catchUpPlan([{ ...pt('p1', 5, null, null), firstNo: 4, open }], { ...O, mode: 'per-point' })).toBeNull();
    expect(catchUpPlan([{ ...pt('p2', 2, null, null), firstNo: 1 }], { ...O, mode: 'per-point' })).not.toBeNull();
  });

  it('per point, not topped up: closed by name at its own point', () => {
    const b = live();
    const open = openOf(b.build(), 'p1', 'per-point');
    const { plan } = written([{ ...pt('p1', 4, null, 0), firstNo: 4, open }], { ...O, mode: 'per-point' }, b);
    expect(plan.drafts[0]).toEqual({ kind: 'close', root: open.rootId });
  });
});

describe('E04-S26 AT-4 — not once clearing the money has started (replaces E04-S19 BF-8)', () => {
  let k = 0;
  const f = (payload: FinancePayload): FinanceEvent => {
    k += 1;
    return { id: `f${k}`, groupId: 'g', deviceSeq: k, ts: k, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId: `t${k}`, baseEventId: null, payload };
  };

  it('review N3 — allowed with baskets already counted; only a live payment tick or debt line of this sale blocks it', () => {
    expect(catchUpAllowed([], 'sale-x')).toBe(true);
    const tick = f({ t: 'payment_mark_set', saleId: 'sale-x', payee: 'red', done: true, amountSatang: 100 });
    expect(catchUpAllowed([tick], 'sale-x')).toBe(false);
    expect(catchUpAllowed([tick], 'sale-other')).toBe(true);
    const line = f({ t: 'debt_payment_recorded', fields: { saleId: 'sale-x', workerId: 'red', amountSatang: 50 } as never });
    expect(catchUpAllowed([line], 'sale-x')).toBe(false);
  });

  it('every tick and debt line taken back: allowed again', () => {
    const tick = f({ t: 'payment_mark_set', saleId: 'sale-x', payee: 'red', done: true, amountSatang: 100 });
    const untick = { ...f({ t: 'payment_mark_set', saleId: 'sale-x', payee: 'red', done: false, amountSatang: 100 }), targetId: tick.targetId, baseEventId: tick.id };
    const line = f({ t: 'debt_payment_recorded', fields: { saleId: 'sale-x', workerId: 'red', amountSatang: 50 } as never });
    const gone = { ...f({ t: 'debt_payment_changed', patch: { deleted: true } }), targetId: line.targetId, baseEventId: line.id };
    expect(catchUpAllowed([tick, untick, line], 'sale-x')).toBe(false);
    expect(catchUpAllowed([tick, untick, line, gone], 'sale-x')).toBe(true);
  });
});
