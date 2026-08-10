import { describe, expect, it } from 'vitest';

import { readyPile, setUpSale, withZoneContract, workedExample } from './fixtures';
import {
  canCount,
  canReady,
  canReopenPile,
  detectClockAnomaly,
  pilesStillCounting,
  projectSale,
} from './project';
import { saleTotals } from './totals';

const pile = (s: ReturnType<typeof projectSale>, id: string) =>
  s.piles.find((p) => p.id === id)!;
const zone = (s: ReturnType<typeof projectSale>, id: string) =>
  s.zones.find((z) => z.id === id)!;

describe('pile lifecycle — docs/ux/pile-zone-sale-lifecycle.md §8', () => {
  it('a new pile is not-started', () => {
    const s = projectSale(setUpSale().build());
    expect(pile(s, 'p1').status).toBe('not-started');
    expect(canCount(s, 'p1')).toBe(false);
  });

  it('not-started → counting only after both checks and ready', () => {
    const b = setUpSale();
    expect(canReady(projectSale(b.build()), 'p1')).toBe(false);

    b.sys({ t: 'zero_check', pileId: 'p1', ok: true, readingG: 0 });
    expect(canReady(projectSale(b.build()), 'p1')).toBe(false);

    b.sys({ t: 'tare_confirmed', pileId: 'p1', tareG: 2_000 });
    expect(canReady(projectSale(b.build()), 'p1')).toBe(true);

    b.sys({ t: 'ready', pileId: 'p1' });
    const s = projectSale(b.build());
    expect(pile(s, 'p1').status).toBe('counting');
    expect(canCount(s, 'p1')).toBe(true);
  });

  it('a failed zero check still counts as checked and never blocks', () => {
    const b = setUpSale()
      .sys({ t: 'zero_check', pileId: 'p1', ok: false, readingG: 300 })
      .sys({ t: 'tare_confirmed', pileId: 'p1', tareG: 2_000 });
    expect(canReady(projectSale(b.build()), 'p1')).toBe(true);
  });

  it('counting → closed, and a closed pile cannot be counted into', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    const s = projectSale(b.build());
    expect(pile(s, 'p1').status).toBe('closed');
    expect(canCount(s, 'p1')).toBe(false);
  });

  it('closed → counting on reopen', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    expect(canReopenPile(projectSale(b.build()), 'p1')).toBe(true);

    b.sys({ t: 'pile_reopened', pileId: 'p1', reason: 'miscounted the last row' });
    const s = projectSale(b.build());
    expect(pile(s, 'p1').status).toBe('counting');
    expect(canCount(s, 'p1')).toBe(true);
  });

  it('the first basket locks the pile configuration (FR-3.4)', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    expect(pile(projectSale(b.build()), 'p1').locked).toBe(false);
    b.accept('p1');
    expect(pile(projectSale(b.build()), 'p1').locked).toBe(true);
  });
});

describe('per-zone contracts', () => {
  it('a new zone has no contract — settle() falls back to the sale default', () => {
    const s = projectSale(setUpSale().build());
    expect(zone(s, 'zA').contract).toBeNull();
  });

  it('zone_contract_set records the contract on that zone only', () => {
    const b = setUpSale();
    withZoneContract(b, 'zA', 'p1', 'ประยุทธ', 70);
    const s = projectSale(b.build());
    expect(zone(s, 'zA').contract).toEqual({ personId: 'p1', workerName: 'ประยุทธ', ownerPct: 70 });
    expect(zone(s, 'zB').contract).toBeNull();
  });

  it('a later zone_contract_set replaces the earlier one for the same zone', () => {
    const b = setUpSale();
    withZoneContract(b, 'zA', 'p1', 'ประยุทธ', 70);
    withZoneContract(b, 'zA', 'p2', 'สมหญิง', 60); // renegotiated before counting started
    const s = projectSale(b.build());
    expect(zone(s, 'zA').contract).toEqual({ personId: 'p2', workerName: 'สมหญิง', ownerPct: 60 });
  });
});

describe('zone lifecycle', () => {
  it('closing a zone force-closes the piles still counting in it', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    readyPile(b, 'p2');

    const before = projectSale(b.build());
    expect(pilesStillCounting(before, 'zA').map((p) => p.id)).toEqual(['p1', 'p2']);

    b.sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: ['p1', 'p2'] });
    const s = projectSale(b.build());
    expect(zone(s, 'zA').status).toBe('closed');
    expect(pile(s, 'p1').status).toBe('closed');
    expect(pile(s, 'p2').status).toBe('closed');
  });

  it('a closed zone blocks counting in its piles', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: ['p1'] });
    expect(canCount(projectSale(b.build()), 'p1')).toBe(false);
  });

  it('reopening a zone does NOT reopen its closed piles', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: ['p1'] });
    b.sys({ t: 'zone_reopened', zoneId: 'zA', reason: 'one more pile to weigh' });

    const s = projectSale(b.build());
    expect(zone(s, 'zA').status).toBe('open');
    expect(pile(s, 'p1').status).toBe('closed');
    expect(canCount(s, 'p1')).toBe(false);
  });
});

describe('sale lifecycle — the hard boundary', () => {
  it('a closed sale blocks reopening any pile beneath it', () => {
    const events = workedExample(); // ends with sale_closed
    const s = projectSale(events);
    expect(s.status).toBe('closed');
    expect(canReopenPile(s, 'p1')).toBe(false);
    expect(canCount(s, 'p1')).toBe(false);
  });

  it('reopening the sale restores the ability to reopen a pile', () => {
    const events = [...workedExample()];
    const last = events[events.length - 1];
    events.push({
      saleId: last.saleId,
      seq: last.seq + 1,
      ts: last.ts + 1000,
      mono: last.mono + 1000,
      actor: 'somchai',
      kind: 'sys',
      payload: { t: 'sale_reopened', reason: 'buyer disputes กอง 2' },
    });
    const s = projectSale(events);
    expect(s.status).toBe('open');
    // Zone A is still closed, so its pile stays unreopenable — reopening the
    // sale is not a blanket undo.
    expect(canReopenPile(s, 'p1')).toBe(false);
    expect(canReopenPile(s, 'p3')).toBe(false);
  });
});

describe('ordering', () => {
  it('folds by seq, not by timestamp', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    const events = b.build();

    // Scramble the wall clock, hard: strictly decreasing timestamps, so a
    // fold that sorted by time would process the log exactly backwards.
    const scrambled = events.map((e, i) => ({ ...e, ts: 1_000_000 - i * 7 }));

    // `startedTs` is a wall-clock record and legitimately follows the scramble
    // — it is what a human reads, never what orders anything. Everything that
    // describes *what happened* must be identical.
    const { startedTs: _a, ...fromScrambled } = projectSale(scrambled);
    const { startedTs: _b, ...fromOriginal } = projectSale(events);
    expect(fromScrambled).toEqual(fromOriginal);
    expect(saleTotals(scrambled)).toEqual(saleTotals(events));
  });

  it('rejects a duplicate sequence number rather than guessing', () => {
    const events = setUpSale().build();
    const dup = [...events, { ...events[0], seq: events[0].seq }];
    expect(() => projectSale(dup)).toThrow(/[Dd]uplicate sequence/);
  });

  it('is idempotent — projecting twice gives the same state', () => {
    const events = workedExample();
    expect(projectSale(events)).toEqual(projectSale(events));
  });
});

describe('clock anomalies (FR-12.6) — flagged, never ordering', () => {
  const ev = (ts: number) =>
    ({ saleId: 's', seq: 1, ts, mono: 0, actor: 'a', kind: 'reject', pileId: 'p',
       source: 'hold', reason: 'released-early', heldMs: 1 }) as const;

  it('detects the clock going backwards', () => {
    expect(detectClockAnomaly(ev(2000), 1000, null)?.anomaly).toBe('backwards');
  });

  it('detects a timestamp before the sale started', () => {
    expect(detectClockAnomaly(null, 500, 1000)?.anomaly).toBe('before-sale-start');
  });

  it('detects an implausible forward jump', () => {
    const eightHours = 8 * 60 * 60 * 1000;
    expect(detectClockAnomaly(ev(0), eightHours, null)?.anomaly).toBe('implausible-jump');
  });

  it('is quiet about a normal gap', () => {
    expect(detectClockAnomaly(ev(1000), 9000, 0)).toBeNull();
  });

  it('surfaces on the state as a non-blocking flag', () => {
    const b = setUpSale().sys({ t: 'clock_anomaly', anomaly: 'backwards', deltaMs: -5000 });
    readyPile(b, 'p1');
    const s = projectSale(b.build());
    expect(s.clockSuspect).toBe(true);
    // The whole point: a suspect clock does not stop anyone counting.
    expect(canCount(s, 'p1')).toBe(true);
  });
});
