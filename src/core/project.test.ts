import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale, withZoneContract, workedExample } from './fixtures';
import {
  canBulkEnter,
  canCount,
  canEditPileNet,
  canReady,
  canReopenPile,
  canRemoveZone,
  pileNeedsVoidReason,
  zoneNeedsVoidReason,
  detectClockAnomaly,
  lastAnnounceOk,
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

describe('bulk entry (S23) — the one deliberate way past the zero/tare gate', () => {
  it('canBulkEnter is true only for a not-started pile in an open zone and sale', () => {
    const b = setUpSale();
    expect(canBulkEnter(projectSale(b.build()), 'p1')).toBe(true);

    // Unknown pile.
    expect(canBulkEnter(projectSale(b.build()), 'nope')).toBe(false);
  });

  it('is false once the pile is counting or closed', () => {
    const b = readyPile(setUpSale(), 'p1');
    expect(canBulkEnter(projectSale(b.build()), 'p1')).toBe(false);

    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    expect(canBulkEnter(projectSale(b.build()), 'p1')).toBe(false);
  });

  it('is false once the zone or the sale is closed', () => {
    const zoneClosed = setUpSale().sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: [] });
    expect(canBulkEnter(projectSale(zoneClosed.build()), 'p1')).toBe(false);

    const saleClosed = setUpSale().sys({ t: 'sale_closed' });
    expect(canBulkEnter(projectSale(saleClosed.build()), 'p1')).toBe(false);
  });

  it('projecting bulk_gate_skipped changes no pile field — it is evidence, not state', () => {
    const without = setUpSale().build();
    const withSkip = setUpSale()
      .sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'นับไว้ในกระดาษ' })
      .build();

    // Same pile, gate flags included: the skip records that the check did not
    // happen, and must not fake its result.
    expect(projectSale(withSkip).piles).toEqual(projectSale(without).piles);
    expect(pile(projectSale(withSkip), 'p1').zeroChecked).toBe(false);
    expect(pile(projectSale(withSkip), 'p1').tareConfirmed).toBe(false);
  });

  it('the full bulk sequence leaves the pile closed and locked, like any counted pile', () => {
    const b = setUpSale().sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'ไม่ได้เปิดแอป' });
    for (let i = 0; i < 12; i++) b.accept('p1', 50_000, 2_000, 'bulk');
    b.short('p1', 10_400); // 8.4 kg leftover
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });

    const s = projectSale(b.build());
    expect(pile(s, 'p1').status).toBe('closed');
    expect(pile(s, 'p1').locked).toBe(true);
    expect(canCount(s, 'p1')).toBe(false);
    // S13's reopen is the way back in, unchanged by how the pile was filled.
    expect(canReopenPile(s, 'p1')).toBe(true);
  });

  it('a reopened bulk pile counts live again, gate untouched', () => {
    const b = setUpSale().sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'มาสาย' });
    b.accept('p1', 50_000, 2_000, 'bulk');
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    b.sys({ t: 'pile_reopened', pileId: 'p1', reason: 'ตกไปเข่งหนึ่ง' });

    const s = projectSale(b.build());
    expect(pile(s, 'p1').status).toBe('counting');
    expect(canCount(s, 'p1')).toBe(true);
    expect(pile(s, 'p1').zeroChecked).toBe(false);
  });
});

/**
 * S26 — editing and removing piles and zones.
 *
 * The whole point of these events is that they are appended, never applied to
 * `pile_added` in place. So every test below asserts on the PROJECTION while
 * the original event stays where it was in the log.
 */
describe('pile_edited (S26) — a rename is a new event, never a rewrite', () => {
  it('renames a not-started pile and touches nothing else', () => {
    const b = setUpSale().sys({
      t: 'pile_edited',
      pileId: 'p1',
      name: 'กองหน้าบ้าน',
      tareG: 2_000,
      stdNetG: 50_000,
    });
    const p = pile(projectSale(b.build()), 'p1');
    expect(p.name).toBe('กองหน้าบ้าน');
    expect(p.tareG).toBe(2_000);
    expect(p.stdNetG).toBe(50_000);
    expect(p.status).toBe('not-started');
  });

  it('renames a counting, locked pile, leaving tare and std as counted', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1');
    b.sys({ t: 'pile_edited', pileId: 'p1', name: 'กองใหม่', tareG: 9_000, stdNetG: 30_000 });

    const p = pile(projectSale(b.build()), 'p1');
    expect(p.name).toBe('กองใหม่');
    // FR-3.4: the lock holds even against an event that asks otherwise.
    expect(p.locked).toBe(true);
    expect(p.tareG).toBe(2_000);
    expect(p.stdNetG).toBe(50_000);
  });

  it('changes tare and std on an unlocked pile', () => {
    const b = setUpSale().sys({
      t: 'pile_edited',
      pileId: 'p1',
      name: 'กอง 1',
      tareG: 2_500,
      stdNetG: 45_000,
    });
    const p = pile(projectSale(b.build()), 'p1');
    expect(p.tareG).toBe(2_500);
    expect(p.stdNetG).toBe(45_000);
  });

  it('takes the latest edit by seq, and leaves pile_added in the log untouched', () => {
    const b = setUpSale()
      .sys({ t: 'pile_edited', pileId: 'p1', name: 'ก', tareG: 2_100, stdNetG: 46_000 })
      .sys({ t: 'pile_edited', pileId: 'p1', name: 'ข', tareG: 2_200, stdNetG: 47_000 });
    const events = b.build();

    const p = pile(projectSale(events), 'p1');
    expect(p.name).toBe('ข');
    expect(p.tareG).toBe(2_200);

    const added = events.find((e) => e.kind === 'sys' && e.payload.t === 'pile_added');
    expect(added && added.kind === 'sys' && added.payload.t === 'pile_added' && added.payload.name).toBe('กอง 1');
  });

  it('an edit before the first basket does not pre-empt the zero/tare gate', () => {
    const b = setUpSale().sys({
      t: 'pile_edited',
      pileId: 'p1',
      name: 'กอง 1',
      tareG: 2_500,
      stdNetG: 50_000,
    });
    const s = projectSale(b.build());
    expect(s.piles.find((p) => p.id === 'p1')!.zeroChecked).toBe(false);
    expect(canReady(s, 'p1')).toBe(false);
  });
});

describe('canEditPileNet (S26) — FR-3.4 enforced in code, not only in the UI', () => {
  it('is true before the first basket and false after it', () => {
    const b = readyPile(setUpSale(), 'p1');
    expect(canEditPileNet(projectSale(b.build()), 'p1')).toBe(true);

    b.accept('p1');
    expect(canEditPileNet(projectSale(b.build()), 'p1')).toBe(false);
  });

  it('stays false once a locked pile is closed, and for an unknown or removed pile', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1');
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    expect(canEditPileNet(projectSale(b.build()), 'p1')).toBe(false);
    expect(canEditPileNet(projectSale(b.build()), 'nope')).toBe(false);

    const removed = setUpSale().sys({ t: 'pile_removed', pileId: 'p2', reason: '' });
    expect(canEditPileNet(projectSale(removed.build()), 'p2')).toBe(false);
  });
});

describe('pile_removed (S26) — a void with a reason, never a delete', () => {
  it('flags an empty pile removed with no reason, and keeps it in the projection', () => {
    const b = setUpSale().sys({ t: 'pile_removed', pileId: 'p2', reason: '' });
    const s = projectSale(b.build());
    expect(s.piles.map((p) => p.id)).toContain('p2');
    expect(pile(s, 'p2').removed).toBe(true);
    expect(pile(s, 'p1').removed).toBe(false);
  });

  it('leaves a removed pile’s baskets in the raw log, untouched', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1', 50_000);
    b.sys({ t: 'pile_removed', pileId: 'p1', reason: 'นับซ้ำกับกอง 2' });
    const events = b.build();

    expect(pile(projectSale(events), 'p1').removed).toBe(true);
    const accepts = events.filter((e) => e.kind === 'accept');
    expect(accepts).toHaveLength(1);
    expect(accepts[0].kind === 'accept' && accepts[0].netG).toBe(50_000);
  });

  it('removal is allowed from any status and survives it', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1');
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    b.sys({ t: 'pile_removed', pileId: 'p1', reason: 'กองนี้ไม่ได้ขาย' });
    const p = pile(projectSale(b.build()), 'p1');
    expect(p.removed).toBe(true);
    expect(p.status).toBe('closed');
  });

  it('cannot be brought back by re-adding the same id — a new pile needs a new id', () => {
    const b = setUpSale()
      .sys({ t: 'pile_removed', pileId: 'p2', reason: '' })
      .sys({ t: 'pile_added', pileId: 'p2', zoneId: 'zA', name: 'กอง 2 อีกที', tareG: 2_000, stdNetG: 50_000 });
    const s = projectSale(b.build());
    expect(pile(s, 'p2').removed).toBe(true);
    expect(pile(s, 'p2').name).toBe('กอง 2');
    expect(canCount(s, 'p2')).toBe(false);
  });

  it('a removed pile can never be counted into again', () => {
    const b = readyPile(setUpSale(), 'p1');
    expect(canCount(projectSale(b.build()), 'p1')).toBe(true);
    b.sys({ t: 'pile_removed', pileId: 'p1', reason: 'ผิดกอง' });
    expect(canCount(projectSale(b.build()), 'p1')).toBe(false);
    expect(canReopenPile(projectSale(b.build()), 'p1')).toBe(false);
    expect(canBulkEnter(projectSale(b.build()), 'p1')).toBe(false);
  });
});

describe('pileNeedsVoidReason (S26) — which removal path the UI must offer', () => {
  it('is false for a pile that never had a basket', () => {
    const b = readyPile(setUpSale(), 'p1');
    expect(pileNeedsVoidReason(b.build(), 'p1')).toBe(false);
  });

  it('is true once any basket has been counted into it', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1');
    expect(pileNeedsVoidReason(b.build(), 'p1')).toBe(true);
  });

  it('is true for a short basket too, and stays true after it is voided', () => {
    const b = readyPile(setUpSale(), 'p1');
    const target = b.nextSeq();
    b.short('p1', 10_000);
    b.void('p1', target, 'กดพลาด');
    // The basket happened. Voiding it does not un-happen it.
    expect(pileNeedsVoidReason(b.build(), 'p1')).toBe(true);
  });

  it('is per pile, not per sale', () => {
    const b = readyPile(setUpSale(), 'p1');
    b.accept('p1');
    expect(pileNeedsVoidReason(b.build(), 'p2')).toBe(false);
  });

  it('is true for a pile filled in bulk (S23), the same as one counted live', () => {
    const b = setUpSale().sys({ t: 'bulk_gate_skipped', pileId: 'p2', reason: 'นับในกระดาษ' });
    b.accept('p2', 50_000, 2_000, 'bulk');
    expect(pileNeedsVoidReason(b.build(), 'p2')).toBe(true);
  });
});

describe('zone_edited / zone_removed (S26)', () => {
  it('renames a zone without touching its piles', () => {
    const b = setUpSale().sys({ t: 'zone_edited', zoneId: 'zA', name: 'โซนหลัง' });
    const s = projectSale(b.build());
    expect(zone(s, 'zA').name).toBe('โซนหลัง');
    expect(zone(s, 'zA').pileIds).toEqual(['p1', 'p2']);
  });

  it('flags a removed zone without deleting it', () => {
    const b = new LogBuilder()
      .sys({ t: 'zone_added', zoneId: 'zEmpty', name: 'โซนว่าง' })
      .sys({ t: 'zone_removed', zoneId: 'zEmpty', reason: '' });
    const s = projectSale(b.build());
    expect(s.zones.map((z) => z.id)).toContain('zEmpty');
    expect(zone(s, 'zEmpty').removed).toBe(true);
  });
});

describe('canRemoveZone (S26) — a zone is emptied of piles first, never cascaded', () => {
  it('is false while the zone still has a live pile', () => {
    const s = projectSale(setUpSale().build());
    expect(canRemoveZone(s, 'zA')).toBe(false);
  });

  it('is true once every pile under it has been removed', () => {
    const b = setUpSale()
      .sys({ t: 'pile_removed', pileId: 'p1', reason: '' })
      .sys({ t: 'pile_removed', pileId: 'p2', reason: '' });
    expect(canRemoveZone(projectSale(b.build()), 'zA')).toBe(true);
    // zB still has กอง 3.
    expect(canRemoveZone(projectSale(b.build()), 'zB')).toBe(false);
  });

  it('is true for a zone that never had a pile, and false for an unknown or already-removed zone', () => {
    const b = new LogBuilder().sys({ t: 'zone_added', zoneId: 'zEmpty', name: 'โซนว่าง' });
    expect(canRemoveZone(projectSale(b.build()), 'zEmpty')).toBe(true);
    expect(canRemoveZone(projectSale(b.build()), 'nope')).toBe(false);

    b.sys({ t: 'zone_removed', zoneId: 'zEmpty', reason: '' });
    expect(canRemoveZone(projectSale(b.build()), 'zEmpty')).toBe(false);
  });
});

describe('zoneNeedsVoidReason (S26) — the same fork as piles, one level up', () => {
  it('is false for a zone that never held a pile', () => {
    const b = new LogBuilder().sys({ t: 'zone_added', zoneId: 'zEmpty', name: 'โซนว่าง' });
    expect(zoneNeedsVoidReason(projectSale(b.build()), 'zEmpty')).toBe(false);
  });

  it('is true for a zone whose piles were removed to empty it', () => {
    const b = setUpSale()
      .sys({ t: 'pile_removed', pileId: 'p1', reason: '' })
      .sys({ t: 'pile_removed', pileId: 'p2', reason: '' });
    expect(zoneNeedsVoidReason(projectSale(b.build()), 'zA')).toBe(true);
  });
});
