import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { MASTER_SCOPE, projectMaster, saleSettings } from './master';
import { projectSale } from './project';
import { pairForNewPoint, planMove } from './sale-move';
import type { MasterPayload, SaleEvent } from './types';

const DAY = '2026-10-03';

/** fA: p1, p2 → red; p4 → nat. */
function master() {
  const payloads: MasterPayload[] = [
    { t: 'property_added', propertyId: 'fA', name: 'A', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'p1' },
    { t: 'point_added', pointId: 'p2', propertyId: 'fA', name: 'p2' },
    { t: 'point_added', pointId: 'p4', propertyId: 'fA', name: 'p4' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p2', tapperId: 'red' },
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

/** red has basket 3 open at p1 with 35 kg. */
function openAtP1() {
  const b = new LogBuilder('s');
  b.sys({ t: 'zone_added', zoneId: 'fA', name: 'A' });
  b.sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2_000, stdNetG: 50_000 });
  b.sys({ t: 'ready', pileId: 'p1' });
  b.acceptAt('p1', 1).acceptAt('p1', 2).shortAt('p1', 3, 37_000);
  return b.build();
}

describe('planMove — moving to a point (D-57, SALE-12, SALE-6)', () => {
  it('the same tapper\'s next point asks about the open basket', () => {
    const ev = openAtP1();
    const plan = planMove(ev, projectSale(ev, 's'), master(), DAY, 'p2', 'per-tapper', 'skip');
    expect(plan.ask).toMatchObject({ basketNo: 3, haveG: 35_000, missingG: 15_000, pointId: 'p1' });
    expect(plan.closes).toEqual([]);
  });

  it('another tapper\'s point closes it without asking', () => {
    const ev = openAtP1();
    const plan = planMove(ev, projectSale(ev, 's'), master(), DAY, 'p4', 'per-tapper', 'skip');
    expect(plan.ask).toBeNull();
    expect(plan.closes).toHaveLength(1);
  });

  it('per point: nothing asked, nothing closed (D-70 S2)', () => {
    const ev = openAtP1();
    const plan = planMove(ev, projectSale(ev, 's'), master(), DAY, 'p4', 'per-point', 'skip');
    expect(plan).toMatchObject({ ask: null, closes: [] });
  });

  it('staying at the open basket\'s own point asks nothing', () => {
    const ev = openAtP1();
    expect(planMove(ev, projectSale(ev, 's'), master(), DAY, 'p1', 'per-tapper', 'every').ask).toBeNull();
  });

  it('gates by mode: a new point under "every", not the point already weighing', () => {
    const ev = openAtP1();
    const s = projectSale(ev, 's');
    expect(planMove(ev, s, master(), DAY, 'p2', 'per-tapper', 'every').gate).toBe(true);
    expect(planMove(ev, s, master(), DAY, 'p1', 'per-tapper', 'every').gate).toBe(false);
    expect(planMove(ev, s, master(), DAY, 'p2', 'per-tapper', 'first-per-farm').gate).toBe(false);
  });
});

describe('pairForNewPoint (MD-7)', () => {
  const settings = saleSettings(master());
  it('the picked pair, else the last point\'s, else the default', () => {
    expect(pairForNewPoint([], settings, 'builtin-60')).toMatchObject({ netG: 60_000, basketG: 3_000 });
    expect(pairForNewPoint([], settings, null)).toMatchObject({ netG: 50_000, basketG: 2_000 });
    const ev = new LogBuilder('s').sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 3_000, stdNetG: 60_000 }).build();
    expect(pairForNewPoint(ev, settings, null)).toMatchObject({ netG: 60_000, basketG: 3_000 });
  });

  it('the pair the sale started with is read from the log, not the URL (review #10)', () => {
    const ev = new LogBuilder('s').sys({ t: 'pair_set', netG: 60_000, basketG: 3_000 }).build();
    expect(pairForNewPoint(ev, settings, null)).toMatchObject({ netG: 60_000, basketG: 3_000 });
    const later = new LogBuilder('s')
      .sys({ t: 'pair_set', netG: 60_000, basketG: 3_000 })
      .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'p1', tareG: 2_000, stdNetG: 50_000 })
      .build();
    expect(pairForNewPoint(later, settings, null)).toMatchObject({ netG: 50_000, basketG: 2_000 });
  });
});
