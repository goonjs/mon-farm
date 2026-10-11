import { describe, expect, it } from 'vitest';

import { readyPile, setUpSale, workedExampleLog } from './fixtures';
import { projectSale } from './project';
import { settle } from './settle';
import { deletedIds, provenance } from './soft-delete';
import { saleTotals } from './totals';

describe('soft delete — one rule for every record (E01-S04, SYNC-10, D-27)', () => {
  it('delete → restore → delete leaves the record deleted, by log order not clock', () => {
    const b = setUpSale();
    b.remove('zB').restore('zB').remove('zB');
    const events = b.build();
    expect(deletedIds(events).has('zB')).toBe(true);

    // Restored last wins, even when that event's wall clock says it is oldest.
    const r = setUpSale().remove('zB').restore('zB').build();
    const skewed = r.map((e, i) => (i === r.length - 1 ? { ...e, ts: 0 } : e));
    expect(deletedIds(skewed).has('zB')).toBe(false);
  });

  it('hides a deleted zone and pile from the projection; restore brings them back as they were', () => {
    const b = setUpSale();
    const before = projectSale(b.build());
    b.remove('p2');
    const hidden = projectSale(b.build());
    expect(hidden.piles.map((p) => p.id)).not.toContain('p2');
    expect(hidden.zones.find((z) => z.id === 'zA')!.pileIds).not.toContain('p2');

    b.restore('p2');
    expect(projectSale(b.build()).piles).toEqual(before.piles);
  });

  it('marks a deleted sale without losing anything inside it', () => {
    const b = workedExampleLog();
    const totals = saleTotals(b.build());
    b.remove('sale-1');
    expect(projectSale(b.build()).deleted).toBe(true);
    expect(saleTotals(b.build())).toEqual(totals);
    b.restore('sale-1');
    expect(projectSale(b.build()).deleted).toBe(false);
  });

  it('keeps deleted records out of totals and money, and restores them exactly (NFR-3)', () => {
    const b = workedExampleLog();
    const full = settle(b.build(), projectSale(b.build()));
    const basket = b.build().find((e) => e.kind === 'accept')!;

    // Delete one basket, then all of zone B (74 baskets).
    b.remove(basket.id).remove('zB');
    const less = b.build();
    const cut = settle(less, projectSale(less));
    expect(cut.totals.baskets).toBe(full.totals.baskets - 1 - 74);
    expect(projectSale(less).zones.map((z) => z.id)).toEqual(['zA']);

    b.restore(basket.id).restore('zB');
    expect(settle(b.build(), projectSale(b.build()))).toEqual(full);
  });

  // D-44 (no deleting a zone whose worker has deductions) was dropped by D-58, E06-S07:
  // a zone delete is always allowed and folds as any other delete.
  it('lets a zone with a worker contract be deleted', () => {
    const b = workedExampleLog();
    b.remove('zB');
    expect(() => settle(b.build(), projectSale(b.build()))).not.toThrow();
    expect(projectSale(b.build()).zones.map((z) => z.id)).toEqual(['zA']);
  });

  it('a deleted deduction leaves the payout; a voided one is still a different thing', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1').deduction('person-x', 10_000, 'advance', 'สมชาย');
    const id = b.lastDeductionId();
    b.remove(id);
    expect(projectSale(b.build()).deductions).toEqual([]);
    b.restore(id);
    expect(projectSale(b.build()).deductions.map((d) => d.id)).toEqual([id]);
  });
});

describe('provenance — from the log, not stored separately (SYNC-11)', () => {
  it('names who created and who last changed a record, when, and through which channel', () => {
    const b = setUpSale();
    b.on('dev-B').remove('p3').restore('p3');
    const events = b.build();
    const p = provenance(events, 'p3')!;
    const added = events.find((e) => e.kind === 'sys' && e.payload.t === 'pile_added' && e.payload.pileId === 'p3')!;
    expect(p.created).toEqual({ actor: added.actor, ts: added.ts, source: 'app' });
    const last = events[events.length - 1];
    expect(p.changed).toEqual({ actor: last.actor, ts: last.ts, source: 'app' });
  });

  it('has no "changed" for a record nobody has touched since creating it', () => {
    const events = setUpSale().build();
    expect(provenance(events, 'p2')!.changed).toBeNull();
  });

  it('knows nothing about a record that is not in the log — not even after a delete names it', () => {
    expect(provenance(setUpSale().build(), 'nope')).toBeNull();
    expect(provenance(setUpSale().remove('nope').build(), 'nope')).toBeNull();
  });

  it('covers every record kind: basket (by correction), zone (by a pile added), deduction (by a void), sale', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.accept('p1');
    const basket = b.build()[b.build().length - 1];
    b.on('dev-B').void('p1', basket.id);
    b.deduction('person-x', 5_000, 'advance', 'สมชาย');
    const ded = b.lastDeductionId();
    b.voidDeduction();
    const events = b.build();
    const last = events[events.length - 1];

    expect(provenance(events, basket.id)!.changed!.actor.deviceId).toBe('dev-B');
    expect(provenance(events, 'zA')!.changed).not.toBeNull(); // p1, p2 were added to it
    expect(provenance(events, ded)!.changed!.ts).toBe(last.ts);
    expect(provenance(events, 'sale-1')!.changed!.ts).toBe(last.ts);
  });

  it('counts a pile force-closed by its zone as changed', () => {
    const b = setUpSale();
    readyPile(b, 'p1');
    b.sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: ['p1'] });
    const events = b.build();
    expect(provenance(events, 'p1')!.changed!.ts).toBe(events[events.length - 1].ts);
  });

  it('reads events from before the envelope had a channel as entered in the app', () => {
    const [e] = setUpSale().build();
    const { source: _s, ...old } = e;
    expect(provenance([old as typeof e], 'sale-1')!.created.source).toBe('app');
  });
});
