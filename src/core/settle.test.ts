import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale, workedExample } from './fixtures';
import { projectSale } from './project';
import { saleTotals, zoneTotals } from './totals';
import { settle, SettlementUnavailable } from './settle';

describe('settle — the worked example from the design docs', () => {
  const events = workedExample();
  const state = projectSale(events);
  const s = settle(events, state);

  it('reaches the net weight the design document shows', () => {
    // 223 standard × 50 kg = 11,150 kg, plus 41 + 38 + 44 = 123 kg
    expect(s.totals.standardBaskets).toBe(223);
    expect(s.totals.shortBaskets).toBe(3);
    expect(s.totals.baskets).toBe(226);
    expect(s.totals.standardNetG).toBe(11_150_000);
    expect(s.totals.shortNetG).toBe(123_000);
    expect(s.totals.netG).toBe(11_273_000);
  });

  it('reaches the gross the design document shows', () => {
    // 11,273 kg × ฿26.50 = ฿298,734.50 = 29,873,450 satang
    expect(s.grossSatang).toBe(29_873_450);
  });

  it('splits 60/40 to the figures the design document shows', () => {
    expect(s.ownerSatang).toBe(17_924_070); // ฿179,240.70
    expect(s.workerSatang).toBe(11_949_380); // ฿119,493.80
  });

  it('breaks down per zone to the figures the design document shows', () => {
    const [a, b] = s.perZone;
    expect(a.totals.netG).toBe(7_573_000);
    expect(a.grossSatang).toBe(20_068_450); // ฿200,684.50
    expect(a.ownerSatang).toBe(12_041_070); // ฿120,410.70
    expect(a.workerSatang).toBe(8_027_380); // ฿ 80,273.80

    expect(b.totals.netG).toBe(3_700_000);
    expect(b.grossSatang).toBe(9_805_000); // ฿ 98,050.00
    expect(b.ownerSatang).toBe(5_883_000); // ฿ 58,830.00
    expect(b.workerSatang).toBe(3_922_000); // ฿ 39,220.00
  });
});

describe('settle — rounding closes exactly', () => {
  it('per-zone gross sums to the sale gross, with no drift', () => {
    const events = workedExample();
    const s = settle(events, projectSale(events));
    const sum = s.perZone.reduce((n, z) => n + z.grossSatang, 0);
    expect(sum).toBe(s.grossSatang);
  });

  it('owner plus worker is exactly gross, per zone and overall', () => {
    const events = workedExample();
    const s = settle(events, projectSale(events));
    for (const z of s.perZone) {
      expect(z.ownerSatang + z.workerSatang).toBe(z.grossSatang);
    }
    expect(s.ownerSatang + s.workerSatang).toBe(s.grossSatang);
  });

  it('closes even at a split percentage that cannot divide evenly', () => {
    // A third of an odd number of satang is where naive rounding loses a unit.
    const b = setUpSale(new LogBuilder());
    // Rebuild with a 33% split by appending a later split_set.
    b.sys({ t: 'split_set', ownerPct: 33, basis: 'gross' });
    readyPile(b, 'p1');
    b.accept('p1', 33_333);
    readyPile(b, 'p3');
    b.accept('p3', 16_667);
    const events = b.build();
    const s = settle(events, projectSale(events));

    expect(s.ownerSatang + s.workerSatang).toBe(s.grossSatang);
    expect(s.perZone.reduce((n, z) => n + z.grossSatang, 0)).toBe(s.grossSatang);
    for (const z of s.perZone) {
      expect(z.ownerSatang + z.workerSatang).toBe(z.grossSatang);
    }
  });
});

describe('settle — refuses rather than guesses', () => {
  it('throws when no price was agreed', () => {
    const b = new LogBuilder()
      .sys({
        t: 'sale_started',
        farmName: 'f', buyer: 'b', manager: 'm', workerLead: 'w', where: 'farm',
      })
      .sys({ t: 'split_set', ownerPct: 60, basis: 'gross' });
    const events = b.build();
    expect(() => settle(events, projectSale(events))).toThrow(SettlementUnavailable);
  });

  it('throws when no split basis was recorded (FR-8.5 — no safe default)', () => {
    const b = new LogBuilder()
      .sys({
        t: 'sale_started',
        farmName: 'f', buyer: 'b', manager: 'm', workerLead: 'w', where: 'farm',
      })
      .sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'x' });
    const events = b.build();
    expect(() => settle(events, projectSale(events))).toThrow(SettlementUnavailable);
  });
});

describe('settle — voided baskets leave the money', () => {
  it('drops exactly the voided basket’s contribution', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    const target = b.nextSeq();
    b.accept('p1');
    b.accept('p1');

    const before = settle(b.build(), projectSale(b.build()));
    b.void('p1', target, 'double count');
    const after = settle(b.build(), projectSale(b.build()));

    expect(before.totals.baskets - after.totals.baskets).toBe(1);
    expect(before.totals.netG - after.totals.netG).toBe(50_000);
    expect(before.grossSatang - after.grossSatang).toBe(Math.round((50_000 * 2650) / 1000));
  });
});

describe('totals — the rollups agree with each other', () => {
  it('sale total equals the sum of its zones', () => {
    const events = workedExample();
    const state = projectSale(events);
    const sale = saleTotals(events);
    const sum = state.zones
      .map((z) => zoneTotals(events, state, z.id))
      .reduce((a, t) => ({ ...a, baskets: a.baskets + t.baskets, netG: a.netG + t.netG }), {
        baskets: 0,
        netG: 0,
      });
    expect(sum.baskets).toBe(sale.baskets);
    expect(sum.netG).toBe(sale.netG);
  });

  it('rejected holds never reach the totals', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    b.reject('p1', 800);
    b.reject('p1', 2999);
    const t = saleTotals(b.build());
    expect(t.baskets).toBe(1);
    expect(t.netG).toBe(50_000);
  });

  it('a short basket contributes reading minus tare, not the reading', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.short('p1', 43_000, 2_000);
    const t = saleTotals(b.build());
    expect(t.netG).toBe(41_000);
    expect(t.shortBaskets).toBe(1);
    expect(t.standardBaskets).toBe(0);
  });
});
