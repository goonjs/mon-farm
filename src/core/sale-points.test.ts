import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { projectSale } from './project';
import { nextBasketNo, parsePrice, pointChoices, pointSetupPayloads, saleNumbering, saleRollup } from './sale-points';
import type { MasterPayload, NumberingMode, SaleEvent } from './types';

/** Farm: สวน ก (p1, p2 → แดง; p4 → นัด), สวน ข (p3 → แดง). */
function master() {
  const events: SaleEvent[] = [];
  let n = 0;
  const add = (payload: MasterPayload) => {
    n += 1;
    events.push({
      id: `m${n}`,
      saleId: MASTER_SCOPE,
      seq: n,
      deviceSeq: n,
      ts: 0,
      mono: 0,
      actor: { userId: 'u', deviceId: 'd' },
      source: 'app',
      kind: 'master',
      payload,
    });
  };
  add({ t: 'property_added', propertyId: 'fA', name: 'ก', crop: 'rubber' });
  add({ t: 'property_added', propertyId: 'fB', name: 'ข', crop: 'rubber' });
  for (const [p, f] of [['p1', 'fA'], ['p2', 'fA'], ['p3', 'fB'], ['p4', 'fA']]) add({ t: 'point_added', pointId: p, propertyId: f, name: p });
  for (const [p, who] of [['p1', 'red'], ['p2', 'red'], ['p3', 'red'], ['p4', 'nat']]) {
    add({ t: 'tapper_assigned', assignmentId: `a-${p}`, pointId: p, tapperId: who });
  }
  return projectMaster(events);
}

const DAY = '2026-10-09';

function weigh(order: string[], mode: NumberingMode) {
  const m = master();
  const b = new LogBuilder('sale-x');
  const tapperOf = (pointId: string) => {
    const a = m.assignments.find((x) => x.pointId === pointId);
    return a?.tapperId ?? null;
  };
  for (const point of order) b.acceptAt(point, nextBasketNo(b.build(), point, mode, tapperOf));
  return { events: b.build(), m };
}

const numbers = (events: readonly SaleEvent[]) =>
  events.filter((e) => e.kind === 'accept').map((e) => `${(e as { pointId?: string }).pointId}#${(e as { basketNo?: number }).basketNo}`);

describe('E04-S01 — basket numbers (SALE-10, D-46, D-79)', () => {
  const order = ['p1', 'p4', 'p3', 'p1', 'p2', 'p4', 'p3'];

  it('(a) per tapper: แดง counts 1..n across her points and farms in any order; นัด starts at 1', () => {
    const { events } = weigh(order, 'per-tapper');
    expect(numbers(events)).toEqual(['p1#1', 'p4#1', 'p3#2', 'p1#3', 'p2#4', 'p4#2', 'p3#5']);
  });

  it('(b) per point: every point starts at 1', () => {
    const { events } = weigh(order, 'per-point');
    expect(numbers(events)).toEqual(['p1#1', 'p4#1', 'p3#1', 'p1#2', 'p2#1', 'p4#2', 'p3#2']);
  });

  it('a voided basket\'s number is never handed out again', () => {
    const { events } = weigh(['p1', 'p1'], 'per-point');
    const last = events[events.length - 1];
    const withVoid = [
      ...events,
      { ...last, id: 'void-1', seq: 99, deviceSeq: 99, kind: 'correction', targetId: last.id, mode: 'void', reason: 'x', pileId: 'p1' } as SaleEvent,
    ];
    expect(nextBasketNo(withVoid, 'p1', 'per-point', () => null)).toBe(3);
  });

  it('the sale\'s mode is chosen at start, defaulting to the group setting (D-53)', () => {
    const b = new LogBuilder('sale-x');
    expect(saleNumbering(b.build(), 'per-tapper')).toBe('per-tapper');
    b.sys({ t: 'numbering_set', numbering: 'per-point' });
    expect(saleNumbering(b.build(), 'per-tapper')).toBe('per-point');
  });
});

describe('E04-S01 — totals by point, tapper, farm and sale (SALE-4, NFR-3)', () => {
  it('both modes give the same totals for the same baskets, and every level adds up exactly', () => {
    const order = ['p1', 'p4', 'p3', 'p1', 'p2', 'p4', 'p3'];
    for (const mode of ['per-tapper', 'per-point'] as const) {
      const { events, m } = weigh(order, mode);
      const r = saleRollup(events, m, DAY);
      expect(r.byPoint.get('p1')?.netG).toBe(100_000);
      expect(r.byTapper.get('red')?.baskets).toBe(5);
      expect(r.byTapper.get('nat')?.baskets).toBe(2);
      expect(r.byFarm.get('fA')?.netG).toBe(250_000);
      expect(r.byFarm.get('fB')?.netG).toBe(100_000);
      expect(r.sale.netG).toBe(350_000);
      const sum = (map: ReadonlyMap<string, { netG: number }>) => [...map.values()].reduce((a, t) => a + t.netG, 0);
      expect([sum(r.byPoint), sum(r.byTapper), sum(r.byFarm)]).toEqual([350_000, 350_000, 350_000]);
    }
  });

  it('แดง and นัด never mix in per-tapper totals; a point with no tapper is kept apart, not dropped', () => {
    const { events, m } = weigh(['p1', 'p4'], 'per-tapper');
    const r = saleRollup([...events, ...new LogBuilder('sale-x').acceptAt('p-unassigned', 1).build().map((e) => ({ ...e, id: 'x1', seq: 50 }))], m, DAY);
    expect(r.byTapper.get('red')?.baskets).toBe(1);
    expect(r.byTapper.get('nat')?.baskets).toBe(1);
    expect(r.unassigned.baskets).toBe(1);
    expect(r.sale.baskets).toBe(3);
  });

  it('baskets keep their weight snapshot: totals read the event, not today\'s settings', () => {
    const b = new LogBuilder('sale-x').acceptAt('p1', 1, 60_000, 3_000);
    expect(saleRollup(b.build(), master(), DAY).byPoint.get('p1')?.netG).toBe(60_000);
  });
});

describe('E04-S02 — starting a sale from master data', () => {
  it('lists a farm\'s points by tapper on the sale day; points with no tapper sit apart (D-70)', () => {
    const m = master();
    const c = pointChoices(m, 'fA', DAY);
    expect(c.byTapper.map((g) => [g.tapperId, g.points.map((p) => p.id)])).toEqual([
      ['red', ['p1', 'p2']],
      ['nat', ['p4']],
    ]);
    expect(c.unassigned).toEqual([]);
    expect(pointChoices(m, 'fB', DAY).byTapper.map((g) => g.tapperId)).toEqual(['red']);
  });

  it('picking a point adds the farm and point to the sale once, with the default net + basket weights', () => {
    const m = master();
    const pair = { pairId: 'builtin-50', netG: 50_000, basketG: 2_000 };
    const first = pointSetupPayloads(projectSale([]), m, 'p1', pair);
    expect(first).toEqual([
      { t: 'zone_added', zoneId: 'fA', name: 'ก' },
      { t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2_000, stdNetG: 50_000 },
    ]);
    const b = new LogBuilder('s');
    for (const p of first) b.sys(p);
    expect(pointSetupPayloads(projectSale(b.build(), 's'), m, 'p1', pair)).toEqual([]);
    expect(pointSetupPayloads(projectSale(b.build(), 's'), m, 'p2', pair)).toEqual([
      { t: 'pile_added', pileId: 'p2', zoneId: 'fA', name: 'p2', tareG: 2_000, stdNetG: 50_000 },
    ]);
  });
});

describe('parsePrice — ฿/kg typed → integer satang (SALE-3)', () => {
  it('blank = no price yet; two decimals at most; above 0', () => {
    expect(parsePrice('')).toEqual({ ok: true, satang: null });
    expect(parsePrice('52.50')).toEqual({ ok: true, satang: 5250 });
    expect(parsePrice('52')).toEqual({ ok: true, satang: 5200 });
    expect(parsePrice('52.505')).toEqual({ ok: false });
    expect(parsePrice('0')).toEqual({ ok: false });
    expect(parsePrice('x')).toEqual({ ok: false });
  });
});
