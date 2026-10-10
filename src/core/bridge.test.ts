import { describe, expect, it } from 'vitest';

import { basketGroups, openBasketIn, tapperChangeClosures } from './bridge';
import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { basketList, nextBasketNo, recorderFigures } from './sale-points';
import { saleTotals } from './totals';
import type { MasterPayload, SaleEvent } from './types';

/** สวน ก: p1, p2 → แดง; p3 → นัด. Standard net 50 kg, basket 2 kg. */
function master() {
  const events: SaleEvent[] = [];
  let n = 0;
  const add = (payload: MasterPayload) => {
    n += 1;
    events.push({ id: `m${n}`, saleId: MASTER_SCOPE, seq: n, deviceSeq: n, ts: 0, mono: 0, actor: { userId: 'u', deviceId: 'd' }, source: 'app', kind: 'master', payload });
  };
  add({ t: 'property_added', propertyId: 'fA', name: 'ก', crop: 'rubber' });
  for (const p of ['p1', 'p2', 'p3']) add({ t: 'point_added', pointId: p, propertyId: 'fA', name: p });
  for (const [p, who] of [['p1', 'red'], ['p2', 'red'], ['p3', 'nat']]) add({ t: 'tapper_assigned', assignmentId: `a-${p}`, pointId: p, tapperId: who });
  return projectMaster(events);
}
const DAY = '2026-10-09';
const STD = () => 50_000;

function sale() {
  const b = new LogBuilder('sale-x');
  for (const p of ['p1', 'p2', 'p3']) b.sys({ t: 'pile_added', pileId: p, zoneId: 'fA', name: p, tareG: 2_000, stdNetG: 50_000 });
  return b;
}

describe('E04-S06 — open short baskets and bridge baskets (SALE-9…13, D-42)', () => {
  it('a short basket stays open by default; its card says how much is still missing', () => {
    const b = sale().acceptAt('p1', 1).shortAt('p1', 2, 37_000);
    const open = openBasketIn(b.build(), master(), DAY, 'p1', 'per-tapper', STD)!;
    expect(open).toMatchObject({ basketNo: 2, haveG: 35_000, missingG: 15_000, pointId: 'p1' });
    const f = recorderFigures(b.build(), master(), DAY, 'p1', 'per-tapper', null);
    expect(f).toMatchObject({ currentNo: 2, done: 1, openShortG: 35_000, missingG: 15_000 });
  });

  it('topped up at the tapper\'s next point: (20 + 30) = 50 closes it as a full basket, one basket in totals', () => {
    const b = sale().shortAt('p1', 1, 22_000);
    const root = b.build().at(-1)!;
    b.partAt(root.id, 'p2', 1, 30_000);
    const g = basketGroups(b.build(), STD).get(root.id)!;
    expect(g).toMatchObject({ basketNo: 1, netG: 50_000, status: 'full', partsG: [20_000, 30_000] });
    expect(openBasketIn(b.build(), master(), DAY, 'p2', 'per-tapper', STD)).toBeNull();
    expect(saleTotals(b.build())).toMatchObject({ baskets: 1, netG: 50_000 });
    expect(nextBasketNo(b.build(), 'p2', 'per-tapper', () => 'red')).toBe(2);
    expect(basketList(b.build())).toMatchObject([{ basketNo: 1, netG: 50_000, partsG: [20_000, 30_000] }]);
  });

  it('each point keeps only its own part', () => {
    const b = sale().shortAt('p1', 1, 22_000);
    b.partAt(b.build().at(-1)!.id, 'p2', 1, 30_000);
    const f1 = recorderFigures(b.build(), master(), DAY, 'p1', 'per-point', null);
    const f2 = recorderFigures(b.build(), master(), DAY, 'p2', 'per-point', null);
    expect([f1.netG, f2.netG]).toEqual([20_000, 30_000]);
  });

  it('"จบเข่งแล้ว / เป็นเศษ" closes it short; the next number is ready and nothing offers to fill it', () => {
    const b = sale().shortAt('p1', 1, 22_000);
    const root = b.build().at(-1)!;
    b.sys({ t: 'basket_closed', basketId: root.id, reason: 'scrap' });
    expect(basketGroups(b.build(), STD).get(root.id)?.status).toBe('closed');
    expect(openBasketIn(b.build(), master(), DAY, 'p2', 'per-tapper', STD)).toBeNull();
    expect(recorderFigures(b.build(), master(), DAY, 'p1', 'per-tapper', null).currentNo).toBe(2);
  });

  it('moving to another tapper\'s point closes the open basket as a short one, without asking (SALE-12)', () => {
    const b = sale().shortAt('p1', 1, 22_000);
    const root = b.build().at(-1)!;
    expect(tapperChangeClosures(b.build(), master(), DAY, 'p3', 'per-tapper', STD)).toEqual([root.id]);
    expect(tapperChangeClosures(b.build(), master(), DAY, 'p2', 'per-tapper', STD)).toEqual([]);
  });

  it('per point (D-46): each point starts at 1 and keeps its own open basket', () => {
    const b = sale().shortAt('p1', 1, 22_000).shortAt('p2', 1, 12_000);
    expect(openBasketIn(b.build(), master(), DAY, 'p1', 'per-point', STD)).toMatchObject({ haveG: 20_000 });
    expect(openBasketIn(b.build(), master(), DAY, 'p2', 'per-point', STD)).toMatchObject({ haveG: 10_000 });
    expect(saleTotals(b.build())).toMatchObject({ baskets: 2, netG: 30_000 });
  });
});
