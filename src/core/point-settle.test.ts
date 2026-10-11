import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { isPointSale, settlePoints, unassignedPoints } from './point-settle';
import { projectSale } from './project';
import { SettlementUnavailable } from './settle';
import type { MasterPayload, SaleEvent } from './types';

const DAY = '2026-10-03';

/** จันทเขลม p1–p3 → แดง, p4 → นัด; คลองพลู k1 → นัด; k9 no tapper. */
function master(extra: MasterPayload[] = []) {
  const payloads: MasterPayload[] = [
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'property_added', propertyId: 'fB', name: 'คลองพลู', crop: 'rubber' },
    ...(['p1', 'p2', 'p3', 'p4'].map((p) => ({ t: 'point_added', pointId: p, propertyId: 'fA', name: p }) as MasterPayload)),
    ...(['k1', 'k9'].map((p) => ({ t: 'point_added', pointId: p, propertyId: 'fB', name: p }) as MasterPayload)),
    ...([['p1', 'red'], ['p2', 'red'], ['p3', 'red'], ['p4', 'nat'], ['k1', 'nat']].map(
      ([p, who]) => ({ t: 'tapper_assigned', assignmentId: `a-${p}`, pointId: p, tapperId: who }) as MasterPayload,
    )),
    ...extra,
  ];
  const events: SaleEvent[] = payloads.map((payload, i) => ({
    id: `m${i}`,
    groupId: 'group-1',
    saleId: MASTER_SCOPE,
    seq: i + 1,
    deviceSeq: i + 1,
    ts: 0,
    mono: 0,
    actor: { userId: 'u', deviceId: 'd' },
    source: 'app',
    kind: 'master',
    payload,
  }));
  return projectMaster(events);
}

/** The mockup's whole sale: แดง 31 baskets 1,520 kg, นัด 15 baskets 735 kg, 48.50 ฿/kg. */
function mockupSale() {
  const b = new LogBuilder('sale-1');
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of ['p1', 'p2', 'p3', 'p4', 'k1']) b.sys({ t: 'pile_added', pileId: p, zoneId: p.startsWith('k') ? 'fB' : 'fA', name: p, tareG: 2_000, stdNetG: 50_000 });
  // แดง: p1 24 full, p2 3 full, p3 3 full + 20 kg short → 1,520 kg.
  let n = 0;
  for (let i = 0; i < 24; i++) b.acceptAt('p1', ++n);
  for (let i = 0; i < 3; i++) b.acceptAt('p2', ++n);
  for (let i = 0; i < 3; i++) b.acceptAt('p3', ++n);
  b.shortAt('p3', ++n, 22_000);
  // นัด: p4 8 full + 35 kg, k1 tops it up by 15 kg, then 5 full + 35 kg short → 735 kg.
  for (let i = 1; i <= 8; i++) b.acceptAt('p4', i);
  b.shortAt('p4', 9, 37_000);
  const root = b.build().at(-1)!.id;
  b.partAt(root, 'k1', 9, 15_000);
  for (let i = 10; i <= 14; i++) b.acceptAt('k1', i);
  b.shortAt('k1', 15, 37_000);
  return b.build();
}

describe('settlePoints — the money of a point sale, per tapper (E05-S01 on points)', () => {
  it('matches the mockup to the satang: แดง 1,520 kg, นัด 735 kg at 48.50, 50/50', () => {
    const events = mockupSale();
    const s = settlePoints(events, projectSale(events, 'sale-1'), master(), DAY);
    expect(s.totals.netG).toBe(2_255_000);
    expect(s.grossSatang).toBe(10_936_750);
    const red = s.perWorker.find((w) => w.personId === 'red')!;
    const nat = s.perWorker.find((w) => w.personId === 'nat')!;
    expect(red.workerName).toBe('แดง');
    expect(red.workerSatang).toBe(3_686_000);
    expect(nat.workerSatang).toBe(1_782_375);
    expect(s.ownerSatang).toBe(3_686_000 + 1_782_375);
    expect(s.ownerSatang + s.workerSatang).toBe(s.grossSatang);
    // One row per tapper, in the order they first weighed.
    expect(s.perZone.map((z) => [z.personId, z.totals.netG, z.totals.baskets])).toEqual([
      ['red', 1_520_000, 31],
      ['nat', 735_000, 15],
    ]);
    expect(red.zoneIds).toEqual([s.perZone[0].zoneId]);
  });

  it('locks every money figure of the mockup sale, to the satang (E06-S07)', () => {
    const events = mockupSale();
    const s = settlePoints(events, projectSale(events, 'sale-1'), master(), DAY);
    expect(
      s.perZone.map((z) => [z.personId, z.grossSatang, z.ownerSatang, z.workerSatang]),
    ).toEqual([
      ['red', 7_372_000, 3_686_000, 3_686_000],
      ['nat', 3_564_750, 1_782_375, 1_782_375],
    ]);
    expect(s.perWorker.map((w) => [w.personId, w.workerSatang])).toEqual([
      ['red', 3_686_000],
      ['nat', 1_782_375],
    ]);
    expect([s.grossSatang, s.ownerSatang, s.workerSatang]).toEqual([10_936_750, 5_468_375, 5_468_375]);
  });

  it('uses the share in force on the sale day (MD-8)', () => {
    const events = mockupSale();
    const m = master([{ t: 'share_set', shareId: 's1', tapperId: 'red', tapperPct: 40, from: '2026-10-01' }]);
    const s = settlePoints(events, projectSale(events, 'sale-1'), m, DAY);
    const z = s.perZone.find((x) => x.personId === 'red')!;
    expect(z.ownerPct).toBe(60);
    expect(z.workerSatang).toBe(Math.round(7_372_000 * 0.4));
    expect(z.ownerSatang + z.workerSatang).toBe(z.grossSatang);
  });

  it('a share starting after the sale day does not apply', () => {
    const events = mockupSale();
    const m = master([{ t: 'share_set', shareId: 's1', tapperId: 'red', tapperPct: 40, from: '2026-10-04' }]);
    const s = settlePoints(events, projectSale(events, 'sale-1'), m, DAY);
    expect(s.perZone.find((x) => x.personId === 'red')!.ownerPct).toBe(50);
  });

  it('refuses without a price', () => {
    const b = new LogBuilder('sale-1');
    b.acceptAt('p1', 1);
    const events = b.build();
    expect(() => settlePoints(events, projectSale(events, 'sale-1'), master(), DAY)).toThrow(SettlementUnavailable);
  });

  it('refuses while a weighed point has no tapper on the sale day (D-63), and names it', () => {
    const b = new LogBuilder('sale-1');
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.acceptAt('p1', 1).acceptAt('k9', 1);
    const events = b.build();
    expect(unassignedPoints(events, master(), DAY)).toEqual(['k9']);
    expect(() => settlePoints(events, projectSale(events, 'sale-1'), master(), DAY)).toThrow(SettlementUnavailable);
  });

  it('voided baskets do not count', () => {
    const b = new LogBuilder('sale-1');
    b.sys({ t: 'price_set', satangPerKg: 10000, indexRef: '' });
    b.acceptAt('p1', 1).acceptAt('p1', 2);
    b.void('p1', b.build().at(-1)!.id);
    const events = b.build();
    expect(settlePoints(events, projectSale(events, 'sale-1'), master(), DAY).totals.netG).toBe(50_000);
  });

  it('refuses a sale mixing point baskets with pile baskets, never dropping weight (review #7)', () => {
    const b = new LogBuilder('sale-1');
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.acceptAt('p1', 1).accept('old-pile');
    const events = b.build();
    expect(() => settlePoints(events, projectSale(events, 'sale-1'), master(), DAY)).toThrow(SettlementUnavailable);
  });

  it('isPointSale: a sale with point baskets', () => {
    const b = new LogBuilder('sale-1');
    expect(isPointSale(b.build())).toBe(false);
    b.acceptAt('p1', 1);
    expect(isPointSale(b.build())).toBe(true);
  });
});
