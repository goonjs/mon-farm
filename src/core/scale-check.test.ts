import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { projectSale } from './project';
import { expectedReadingG, gateNeeded, pointGateNeeded, saleSkewG } from './scale-check';
import { basketNetG } from './totals';
import type { ShortEvent } from './types';

/** Two farms: A has points a1, a2; B has b1. */
function sale() {
  return new LogBuilder('s')
    .sys({ t: 'zone_added', zoneId: 'A', name: 'A' })
    .sys({ t: 'zone_added', zoneId: 'B', name: 'B' })
    .sys({ t: 'pile_added', pileId: 'a1', zoneId: 'A', name: 'a1', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'a2', zoneId: 'A', name: 'a2', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'b1', zoneId: 'B', name: 'b1', tareG: 2_000, stdNetG: 50_000 });
}
const pass = (b: LogBuilder, pile: string) =>
  b.sys({ t: 'zero_check', pileId: pile, ok: true, readingG: 0 }).sys({ t: 'tare_confirmed', pileId: pile, tareG: 2_000 }).sys({ t: 'ready', pileId: pile });

describe('E04-S03 — when to ask for the zero/tare check (SALE-6)', () => {
  it('"every": every point before its first basket', () => {
    const b = pass(sale(), 'a1');
    const ev = b.build();
    expect(gateNeeded(projectSale(ev, 's'), ev, 'a2', 'every')).toBe(true);
  });

  it('"first-per-farm": only the first point weighed in each farm, across farms in any order', () => {
    const b = sale();
    let ev = b.build();
    expect(gateNeeded(projectSale(ev, 's'), ev, 'a2', 'first-per-farm')).toBe(true);
    ev = pass(b, 'a2').build();
    expect(gateNeeded(projectSale(ev, 's'), ev, 'a1', 'first-per-farm')).toBe(false);
    expect(gateNeeded(projectSale(ev, 's'), ev, 'b1', 'first-per-farm')).toBe(true);
  });

  it('"skip": never asks', () => {
    const ev = sale().build();
    expect(gateNeeded(projectSale(ev, 's'), ev, 'a1', 'skip')).toBe(false);
  });

  it('with a skew accepted in this sale, every point move asks again, whatever the mode (D-76)', () => {
    const b = sale()
      .sys({ t: 'zero_check', pileId: 'a1', ok: false, readingG: 1_000 })
      .sys({ t: 'skew_accepted', pileId: 'a1', skewG: 1_000 })
      .sys({ t: 'tare_confirmed', pileId: 'a1', tareG: 2_000 })
      .sys({ t: 'ready', pileId: 'a1' });
    const ev = b.build();
    for (const mode of ['skip', 'first-per-farm', 'every'] as const) {
      expect(gateNeeded(projectSale(ev, 's'), ev, 'a2', mode)).toBe(true);
    }
  });
});

describe('E04-S03 — the skew (D-75)', () => {
  it('lasts until the next passing zero check', () => {
    const b = sale().sys({ t: 'zero_check', pileId: 'a1', ok: false, readingG: 2_000 }).sys({ t: 'skew_accepted', pileId: 'a1', skewG: 2_000 });
    expect(saleSkewG(b.build())).toBe(2_000);
    b.sys({ t: 'zero_check', pileId: 'a2', ok: true, readingG: 0 });
    expect(saleSkewG(b.build())).toBe(0);
  });

  it('"the scale should read" includes it: +2 kg and −1 kg on 50 + 2 and 60 + 3', () => {
    expect(expectedReadingG(50_000, 2_000, 2_000)).toBe(54_000);
    expect(expectedReadingG(50_000, 2_000, -1_000)).toBe(51_000);
    expect(expectedReadingG(60_000, 3_000, 2_000)).toBe(65_000);
    expect(expectedReadingG(60_000, 3_000, 0)).toBe(63_000);
  });

  it('a short basket stores reading − basket − skew as its net', () => {
    const b = new LogBuilder('s').short('a1', 40_000, 2_000);
    const e = b.build()[0] as ShortEvent;
    expect(basketNetG({ ...e, skewG: 2_000 })).toBe(36_000);
    expect(basketNetG({ ...e, skewG: -1_000 })).toBe(39_000);
    expect(basketNetG(e)).toBe(38_000);
  });
});

describe('pointGateNeeded — the check on moving to a point (v2 picker, SALE-6, D-76)', () => {
  it('asks before a new point by mode, knowing its farm before it joins the sale', () => {
    const b = new LogBuilder('s').sys({ t: 'zone_added', zoneId: 'A', name: 'A' });
    let ev = b.build();
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a1', 'A', 'first-per-farm')).toBe(true);
    b.sys({ t: 'pile_added', pileId: 'a1', zoneId: 'A', name: 'a1', tareG: 2_000, stdNetG: 50_000 });
    ev = pass(b, 'a1').build();
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a2', 'A', 'first-per-farm')).toBe(false);
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'b1', 'B', 'first-per-farm')).toBe(true);
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a2', 'A', 'every')).toBe(true);
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a2', 'A', 'skip')).toBe(false);
  });

  it('does not ask again at a point already weighing, unless the sale took a skew (D-76)', () => {
    const b = pass(sale(), 'a1');
    let ev = b.build();
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a1', 'A', 'every')).toBe(false);
    ev = b.sys({ t: 'skew_accepted', pileId: 'a1', skewG: 2_000 }).build();
    expect(pointGateNeeded(projectSale(ev, 's'), ev, 'a1', 'A', 'skip')).toBe(true);
  });
});
