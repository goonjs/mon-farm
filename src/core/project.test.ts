import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale, withZoneContract, workedExample } from './fixtures';
import {
  canCount,
  canReady,
  canReopenPile,
  detectClockAnomaly,
  lastAnnounceOk,
  pilesStillCounting,
  projectSale,
} from './project';
import { pileTotals, saleTotals } from './totals';

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
      id: 'reopen-1',
      groupId: 'group-1',
      saleId: last.saleId,
      seq: last.seq + 1,
      deviceSeq: last.deviceSeq + 1,
      ts: last.ts + 1000,
      mono: last.mono + 1000,
      actor: last.actor,
      source: 'app',
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

  it('is idempotent — projecting twice gives the same state', () => {
    const events = workedExample();
    expect(projectSale(events)).toEqual(projectSale(events));
  });
});

describe('speech preference (S10, FR-11.11) — logged when toggled mid-sale', () => {
  it('defaults to on before any speech_set event', () => {
    const s = projectSale(setUpSale().build());
    expect(s.speechOn).toBe(true);
  });

  it('speech_set flips the projected flag', () => {
    const b = setUpSale().sys({ t: 'speech_set', on: false });
    expect(projectSale(b.build()).speechOn).toBe(false);
  });

  it('the latest speech_set wins', () => {
    const b = setUpSale()
      .sys({ t: 'speech_set', on: false })
      .sys({ t: 'speech_set', on: true });
    expect(projectSale(b.build()).speechOn).toBe(true);
  });

  it('announced events never affect projected state — evidence only', () => {
    const withAnnounce = setUpSale().sys({ t: 'announced', thai: 'หนึ่ง', ok: true }).build();
    const without = setUpSale().build();
    expect(projectSale(withAnnounce)).toEqual(projectSale(without));
  });
});

describe('lastAnnounceOk — derives the degraded-speech pill from the log', () => {
  it('is null before any announce attempt', () => {
    expect(lastAnnounceOk(setUpSale().build())).toBeNull();
  });

  it('reflects the most recent attempt, not the first', () => {
    const b = setUpSale()
      .sys({ t: 'announced', thai: 'หนึ่ง', ok: true })
      .sys({ t: 'announced', thai: 'สอง', ok: false });
    expect(lastAnnounceOk(b.build())).toBe(false);

    b.sys({ t: 'announced', thai: 'สาม', ok: true });
    expect(lastAnnounceOk(b.build())).toBe(true);
  });

  it('goes by seq, not array order', () => {
    const b = setUpSale()
      .sys({ t: 'announced', thai: 'หนึ่ง', ok: true })
      .sys({ t: 'announced', thai: 'สอง', ok: false });
    const events = b.build();
    const reversed = [...events].reverse();
    expect(lastAnnounceOk(reversed)).toBe(false);
  });
});

describe('deductions (S29) — projected, voided by mark not removal', () => {
  it('a deduction_added projects onto state.deductions', () => {
    const b = setUpSale();
    b.deduction('person-prayuth', 5_000, 'ค่าปุ๋ย', 'สมชาย');
    const s = projectSale(b.build());
    expect(s.deductions).toHaveLength(1);
    expect(s.deductions[0]).toEqual({
      id: b.lastDeductionId(),
      personId: 'person-prayuth',
      personName: 'person-prayuth',
      satang: 5_000,
      reason: 'ค่าปุ๋ย',
      agreedBy: 'สมชาย',
      voided: false,
      voidReason: null,
    });
  });

  it('voiding marks the deduction rather than removing it', () => {
    const b = setUpSale();
    b.deduction('person-prayuth', 5_000, 'ค่าปุ๋ย', 'สมชาย');
    const id = b.lastDeductionId();
    b.voidDeduction('จ่ายผิดคน');
    const s = projectSale(b.build());
    expect(s.deductions).toHaveLength(1); // still present
    expect(s.deductions[0]).toEqual({
      id,
      personId: 'person-prayuth',
      personName: 'person-prayuth',
      satang: 5_000,
      reason: 'ค่าปุ๋ย',
      agreedBy: 'สมชาย',
      voided: true,
      voidReason: 'จ่ายผิดคน',
    });
  });

  it('voiding an unknown deductionId is a silent no-op', () => {
    const b = setUpSale();
    b.sys({ t: 'deduction_voided', deductionId: 'no-such-id', reason: 'whatever' });
    const s = projectSale(b.build());
    expect(s.deductions).toEqual([]);
  });

  it('voiding twice is a no-op — the second void changes nothing further', () => {
    const b = setUpSale();
    b.deduction('person-prayuth', 5_000, 'ค่าปุ๋ย', 'สมชาย');
    b.voidDeduction('เหตุผลแรก');
    b.voidDeduction('เหตุผลที่สอง');
    const s = projectSale(b.build());
    expect(s.deductions).toHaveLength(1);
    expect(s.deductions[0].voided).toBe(true);
    expect(s.deductions[0].voidReason).toBe('เหตุผลแรก'); // first void wins, not last
  });

  it('a new sale has an empty deductions list', () => {
    expect(projectSale(setUpSale().build()).deductions).toEqual([]);
  });

  it('projection is identical under scrambled timestamps, deductions included', () => {
    const b = setUpSale();
    b.deduction('person-prayuth', 5_000, 'ค่าปุ๋ย', 'สมชาย');
    b.voidDeduction('เหตุผล');
    b.deduction('person-manop', 3_000, 'ค่าน้ำมัน', 'สมชาย');
    const events = b.build();
    const scrambled = events.map((e, i) => ({ ...e, ts: 1_000_000 - i * 7 }));

    const { startedTs: _a, ...fromScrambled } = projectSale(scrambled);
    const { startedTs: _b, ...fromOriginal } = projectSale(events);
    expect(fromScrambled).toEqual(fromOriginal);
  });
});

describe('clock anomalies (FR-12.6) — flagged, never ordering', () => {
  const ev = (ts: number) =>
    ({ id: 'e1', groupId: 'group-1', saleId: 's', seq: 1, deviceSeq: 1, ts, mono: 0, actor: { userId: 'u', deviceId: 'd' }, source: 'app',
       kind: 'reject', pileId: 'p',
       input: 'hold', reason: 'released-early', heldMs: 1 }) as const;

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

describe('events from more than one device — E01-S02 AC5, NFR-3', () => {
  /** Two phones counting the same sale: device B joins and counts pile p3. */
  function twoDeviceSale() {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1').accept('p1');
    b.on('dev-B');
    readyPile(b, 'p3');
    b.accept('p3').short('p3', 43_000);
    b.on('dev-A');
    b.accept('p1').sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    return b.build();
  }

  it('gives every event a unique id and a per-device sequence', () => {
    const events = twoDeviceSale();
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    const seqsOfB = events.filter((e) => e.actor.deviceId === 'dev-B').map((e) => e.deviceSeq);
    expect(seqsOfB).toEqual([1, 2, 3, 4, 5]);
  });

  it('projects the same state whatever the wall clocks say and whatever order rows arrive in', () => {
    const events = twoDeviceSale();
    const expected = projectSale(events);
    const expectedTotals = saleTotals(events);

    // Device B's clock is a day behind, and the rows arrive reversed.
    const skewed = events
      .map((e) => (e.actor.deviceId === 'dev-B' ? { ...e, ts: e.ts - 86_400_000 } : e))
      .reverse();
    const s = projectSale(skewed);

    expect(s.piles).toEqual(expected.piles);
    expect(s.zones).toEqual(expected.zones);
    expect(s.status).toBe(expected.status);
    expect(saleTotals(skewed)).toEqual(expectedTotals);
  });

  it('accepts two devices reaching the same per-sale position independently', () => {
    const shared = setUpSale();
    readyPile(shared, 'p1');
    readyPile(shared, 'p3');
    const prefix = shared.build();

    // Both phones were offline and each counted one basket "next".
    const onA = shared.fork('dev-A').accept('p1').build().slice(prefix.length);
    const onB = shared.fork('dev-B').accept('p3').build().slice(prefix.length);
    expect(onA[0].seq).toBe(onB[0].seq);

    const merged = [...prefix, ...onA, ...onB];
    expect(saleTotals(merged).baskets).toBe(2);

    // Undoing A's basket must not take B's with it just because they share a seq.
    const undo = shared.fork('dev-A');
    undo.accept('p1');
    undo.void('p1', onA[0].id);
    const voidOnA = undo.build().slice(-1);
    expect(saleTotals([...merged, ...voidOnA]).baskets).toBe(1);
    expect(pileTotals([...merged, ...voidOnA], 'p3').baskets).toBe(1);
  });

  it('still refuses a log carrying the same event id twice', () => {
    const events = setUpSale().build();
    expect(() => projectSale([...events, { ...events[0], seq: 99 }])).toThrow(/Duplicate event id/);
  });
});

describe('sale header buyer reference (E03-S01, MD-6)', () => {
  it('keeps the buyer id next to the name snapshot when one was picked', () => {
    const b = new LogBuilder().sys({
      t: 'sale_started',
      farmName: 'สวน',
      buyer: 'ล้ง ก',
      buyerId: 'b1',
      manager: '',
      workerLead: '',
      where: 'farm',
    });
    expect(projectSale(b.build()).parties).toMatchObject({ buyer: 'ล้ง ก', buyerId: 'b1' });
  });

  it('a typed buyer with no id projects without one', () => {
    const s = projectSale(setUpSale().build());
    expect(s.parties && 'buyerId' in s.parties).toBe(false);
  });
});
