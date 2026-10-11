import { describe, expect, it } from 'vitest';

import { backfillEvents, backfillPlan } from './backfill';
import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { basketList, nextBasketNo, saleRollup } from './sale-points';
import { saleTotals } from './totals';
import type { MasterPayload, SaleEvent } from './types';

function master() {
  const events: SaleEvent[] = [];
  let n = 0;
  const add = (payload: MasterPayload) => {
    n += 1;
    events.push({ id: `m${n}`, groupId: 'group-1', saleId: MASTER_SCOPE, seq: n, deviceSeq: n, ts: 0, mono: 0, actor: { userId: 'u', deviceId: 'd' }, source: 'app', kind: 'master', payload });
  };
  add({ t: 'property_added', propertyId: 'fA', name: 'ก', crop: 'rubber' });
  add({ t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 1' });
  add({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' });
  return projectMaster(events);
}
const DAY = '2026-10-09';
const pile = { stdNetG: 50_000, tareG: 2_000 };

describe('E04-S10 — backfill a point as a total (SALE-18, D-46, D-49)', () => {
  it('12 full + 23.5 kg short after basket 15 → baskets 16–27 and 28, totals and the backfill label', () => {
    const b = new LogBuilder('sale-x');
    for (let i = 1; i <= 15; i++) b.acceptAt('p1', i);
    const plan = backfillPlan(b.build(), master(), DAY, 'p1', 'per-tapper', pile, 12, 23_500);
    expect(plan).toEqual({ lastNo: 15, fullFrom: 16, fullTo: 27, fullG: 600_000, shortNo: 28, shortG: 23_500, baskets: 13, totalG: 623_500 });

    for (const e of backfillEvents(plan!, 'p1', pile)) {
      if (e.kind === 'accept') b.backfillAt('p1', e.basketNo, e.netG, e.tareG);
      else b.backfillShortAt('p1', e.basketNo, e.readingG, e.tareG);
    }
    const events = b.build();
    expect(saleTotals(events)).toMatchObject({ baskets: 28, netG: 15 * 50_000 + 623_500 });
    expect(saleRollup(events, master(), DAY).byTapper.get('red')?.netG).toBe(15 * 50_000 + 623_500);
    expect(nextBasketNo(events, 'p1', 'per-tapper', () => 'red')).toBe(29);
    expect(basketList(events)[0]).toMatchObject({ basketNo: 28, backfill: true, short: true, netG: 23_500 });
  });

  it('no short part: only the full baskets; nothing to enter = nothing to save', () => {
    expect(backfillPlan([], master(), DAY, 'p1', 'per-tapper', pile, 3, null)).toMatchObject({ fullFrom: 1, fullTo: 3, shortNo: null, baskets: 3 });
    expect(backfillPlan([], master(), DAY, 'p1', 'per-tapper', pile, 0, null)).toBeNull();
  });
});
