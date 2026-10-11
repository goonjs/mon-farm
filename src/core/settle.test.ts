import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale, withZoneContract, workedExample } from './fixtures';
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

  it('reaches the gross the design document shows — unaffected by per-zone splits', () => {
    // 11,273 kg × ฿26.50 = ฿298,734.50 = 29,873,450 satang
    expect(s.grossSatang).toBe(29_873_450);
  });

  it('each zone applies its own 50/50 contract, not one sale-wide split', () => {
    expect(s.ownerSatang).toBe(14_936_725); // ฿149,367.25
    expect(s.workerSatang).toBe(14_936_725); // exactly equal at 50/50
  });

  it('breaks down per zone with each zone’s own worker and percentage', () => {
    const [a, b] = s.perZone;
    expect(a.zoneName).toBe('โซน A');
    expect(a.workerName).toBe('ประยุทธ');
    expect(a.personId).toBe('person-prayuth');
    expect(a.ownerPct).toBe(50);
    expect(a.fromSaleDefault).toBe(false);
    expect(a.totals.netG).toBe(7_573_000);
    expect(a.grossSatang).toBe(20_068_450); // ฿200,684.50
    expect(a.ownerSatang).toBe(10_034_225); // ฿100,342.25
    expect(a.workerSatang).toBe(10_034_225);

    expect(b.zoneName).toBe('โซน B');
    expect(b.workerName).toBe('มานพ');
    expect(b.totals.netG).toBe(3_700_000);
    expect(b.grossSatang).toBe(9_805_000); // ฿ 98,050.00
    expect(b.ownerSatang).toBe(4_902_500); // ฿ 49,025.00
    expect(b.workerSatang).toBe(4_902_500);
  });

  it('groups per-worker totals by personId, one row per named worker', () => {
    expect(s.perWorker).toHaveLength(2);
    const prayuth = s.perWorker.find((w) => w.personId === 'person-prayuth')!;
    expect(prayuth.workerName).toBe('ประยุทธ');
    expect(prayuth.zoneIds).toEqual(['zA']);
    expect(prayuth.workerSatang).toBe(10_034_225);

    const manop = s.perWorker.find((w) => w.personId === 'person-manop')!;
    expect(manop.zoneIds).toEqual(['zB']);
    expect(manop.workerSatang).toBe(4_902_500);
  });
});

describe('settle — per-zone contracts actually vary', () => {
  it('a zone with its own contract overrides the sale default', () => {
    const b = setUpSale(); // sale default is 50/50
    withZoneContract(b, 'zA', 'p1', 'สมหญิง', 70); // zone A pays the owner 70%
    // zone B gets no contract — uses the 50/50 default
    readyPile(b, 'p1');
    b.accept('p1', 100_000); // 100 kg net
    readyPile(b, 'p3');
    b.accept('p3', 100_000); // 100 kg net, same weight, different zone

    const events = b.build();
    const s = settle(events, projectSale(events));
    const [a, other] = s.perZone;

    expect(a.ownerPct).toBe(70);
    expect(a.fromSaleDefault).toBe(false);
    expect(other.ownerPct).toBe(50);
    expect(other.fromSaleDefault).toBe(true);
    expect(other.personId).toBeNull();
    expect(other.workerName).toBeNull();

    // Same net weight, same price, different split -> different owner share.
    expect(a.ownerSatang).toBeGreaterThan(other.ownerSatang);
  });

  it('a zone using the sale default is excluded from perWorker (no one was named)', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    const events = b.build();
    const s = settle(events, projectSale(events));
    expect(s.perWorker).toHaveLength(0);
  });

  it('two zones paid to the same person are grouped into one worker total', () => {
    const b = setUpSale();
    withZoneContract(b, 'zA', 'shared-person', 'บุญมี', 50);
    withZoneContract(b, 'zB', 'shared-person', 'บุญมี', 50);
    readyPile(b, 'p1');
    b.accept('p1', 100_000);
    readyPile(b, 'p3');
    b.accept('p3', 100_000);

    const events = b.build();
    const s = settle(events, projectSale(events));

    expect(s.perWorker).toHaveLength(1);
    expect([...s.perWorker[0].zoneIds].sort()).toEqual(['zA', 'zB']);
    expect(s.perWorker[0].workerSatang).toBe(s.workerSatang);
  });

  it('refuses when a zone has neither its own contract nor a sale default', () => {
    const b = new LogBuilder()
      .sys({ t: 'sale_started', farmName: 'f', buyer: 'b', manager: 'm', workerLead: 'w', where: 'farm' })
      .sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'x' })
      .sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' })
      .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 });
    // No split_set, no zone_contract_set — zA cannot be settled.
    const events = b.build();
    expect(() => settle(events, projectSale(events))).toThrow(SettlementUnavailable);
    expect(() => settle(events, projectSale(events))).toThrow(/โซน A/);
  });

  it('settles fine with per-zone contracts alone, no sale-level split at all', () => {
    const b = new LogBuilder()
      .sys({ t: 'sale_started', farmName: 'f', buyer: 'b', manager: 'm', workerLead: 'w', where: 'farm' })
      .sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'x' })
      .sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' })
      .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 });
    withZoneContract(b, 'zA', 'p1', 'worker', 60);
    readyPile(b, 'p1');
    b.accept('p1');
    const events = b.build();
    expect(() => settle(events, projectSale(events))).not.toThrow();
  });

  it('a cleared zone contract pays by the sale default, and nobody by name', () => {
    const b = setUpSale(new LogBuilder());
    withZoneContract(b, 'zA', 'somying', 'สมหญิง', 70);
    readyPile(b, 'p1');
    b.accept('p1');

    const withContract = settle(b.build(), projectSale(b.build()));
    expect(withContract.perZone.find((z) => z.zoneId === 'zA')?.workerName).toBe('สมหญิง');
    expect(withContract.perWorker.map((w) => w.personId)).toContain('somying');

    // Clearing is an appended event, never an erasure — but from here on the
    // zone must settle on the sale-level 50/50 and attribute nothing to her.
    b.sys({ t: 'zone_contract_cleared', zoneId: 'zA' });
    const events = b.build();
    const s = settle(events, projectSale(events));
    const zA = s.perZone.find((z) => z.zoneId === 'zA');

    expect(zA?.workerName).toBeNull();
    expect(zA?.ownerSatang).toBe(zA!.workerSatang); // the sale default is 50/50
    expect(s.perWorker.map((w) => w.personId)).not.toContain('somying');
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
    b.sys({ t: 'split_set', ownerPct: 33 });
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
      .sys({ t: 'split_set', ownerPct: 60 });
    const events = b.build();
    expect(() => settle(events, projectSale(events))).toThrow(SettlementUnavailable);
  });

  // The "no split recorded" case is now necessarily per-zone — a sale with no
  // zones at all has nothing to refuse. See "settle — per-zone contracts
  // actually vary > refuses when a zone has neither its own contract nor a
  // sale default" below, which is the FR-8.5 case with a real zone in it.
});

describe('settle — voided baskets leave the money', () => {
  it('drops exactly the voided basket’s contribution', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    const target = b.nextId();
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

describe('settle — a log written before `basis` was removed (E03-S06)', () => {
  it('loads and settles exactly as before: the extra field is ignored', () => {
    const current = workedExample();
    // The same log as an older build wrote it: every split_set also carried basis: 'gross'.
    const old = current.map((e) =>
      e.kind === 'sys' && e.payload.t === 'split_set' ? ({ ...e, payload: { ...e.payload, basis: 'gross' } } as typeof e) : e,
    );
    expect(old.some((e) => e.kind === 'sys' && 'basis' in e.payload)).toBe(true);
    const stateOld = projectSale(old);
    expect(stateOld).toEqual(projectSale(current));
    expect(settle(old, stateOld)).toEqual(settle(current, projectSale(current)));
  });
});
