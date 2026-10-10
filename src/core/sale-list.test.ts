import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { currentPoint, saleDay, saleListRows } from './sale-list';
import type { MasterPayload, SaleEvent } from './types';

function master() {
  const payloads: MasterPayload[] = [
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 1' },
    { t: 'point_added', pointId: 'p4', propertyId: 'fA', name: 'จุด 4' },
    { t: 'point_added', pointId: 'p9', propertyId: 'fA', name: 'จุด 9' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a4', pointId: 'p4', tapperId: 'nat' },
  ];
  return projectMaster(
    payloads.map((payload, i) => ({
      id: `m${i}`,
      saleId: MASTER_SCOPE,
      seq: i + 1,
      deviceSeq: i + 1,
      ts: 0,
      mono: 0,
      actor: { userId: 'u', deviceId: 'd' },
      source: 'app',
      kind: 'master',
      payload,
    })) as SaleEvent[],
  );
}

const started = (b: LogBuilder, buyer: string) =>
  b.sys({ t: 'sale_started', farmName: '', buyer, manager: '', workerLead: '', where: 'farm' });

/** LogBuilder stamps ts from a counter; pin the start time for the day. */
const at = (events: SaleEvent[], ts: number) => events.map((e) => ({ ...e, ts }));

describe('saleListRows — the sale list (mockup 4, D-78)', () => {
  it('newest first, with each tapper\'s kg adding up to the row total', () => {
    const a = new LogBuilder('sale-a');
    started(a, 'คนรับซื้อยาง ก');
    a.acceptAt('p1', 1).acceptAt('p1', 2).acceptAt('p4', 1);
    const b = new LogBuilder('sale-b');
    started(b, 'คนรับซื้อยาง ข');
    b.acceptAt('p4', 1);
    b.sys({ t: 'sale_status_set', status: 'completed' });
    const rows = saleListRows(
      [
        { id: 'sale-b', events: at(b.build(), Date.UTC(2026, 8, 4)) },
        { id: 'sale-a', events: at(a.build(), Date.UTC(2026, 8, 18)) },
      ],
      master(),
    );
    expect(rows.map((r) => r.id)).toEqual(['sale-a', 'sale-b']);
    expect(rows[0]).toMatchObject({ buyer: 'คนรับซื้อยาง ก', baskets: 3, netG: 150_000, closed: false });
    expect(rows[0].tappers).toEqual([
      { id: 'red', name: 'แดง', netG: 100_000 },
      { id: 'nat', name: 'นัด', netG: 50_000 },
    ]);
    expect(rows[1].closed).toBe(true);
  });

  it('leaves out deleted sales and sales never started', () => {
    const a = new LogBuilder('sale-a');
    started(a, 'x');
    a.remove('sale-a');
    const rows = saleListRows([{ id: 'sale-a', events: a.build() }, { id: 'sale-z', events: [] }], master());
    expect(rows).toEqual([]);
  });

  it('baskets at a point with no tapper show apart, never dropped (D-63)', () => {
    const a = new LogBuilder('sale-a');
    started(a, 'x');
    a.acceptAt('p9', 1);
    const [row] = saleListRows([{ id: 'sale-a', events: a.build() }], master());
    expect(row.netG).toBe(50_000);
    expect(row.unassignedG).toBe(50_000);
  });
});

describe('currentPoint — where a sale was last weighing', () => {
  it('is the point of the last basket or point step, in fold order', () => {
    const a = new LogBuilder('sale-a');
    a.sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2_000, stdNetG: 50_000 });
    expect(currentPoint(a.build())).toBe('p1');
    a.acceptAt('p4', 1);
    expect(currentPoint(a.build())).toBe('p4');
    a.sys({ t: 'ready', pileId: 'p1' });
    expect(currentPoint(a.build())).toBe('p1');
  });

  it('is null for a sale with no point yet', () => {
    expect(currentPoint(new LogBuilder('s').build())).toBeNull();
  });
});

describe('saleDay', () => {
  it('is the Bangkok day the sale started', () => {
    expect(saleDay(Date.UTC(2026, 9, 2, 18), 0)).toBe('2026-10-03');
    expect(saleDay(null, Date.UTC(2026, 9, 5, 1))).toBe('2026-10-05');
  });
});
