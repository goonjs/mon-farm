import { describe, expect, it } from 'vitest';

import { foldRecord, type ChangeNode } from './conflicts';
import { setUpSale } from './fixtures';
import { projectSale } from './project';
import { deletedIds } from './soft-delete';
import { saleTotals } from './totals';

/**
 * An event the server rejected stays on its phone and never reaches the others (E01-S09). Later events of
 * the same phone were recorded on top of it, so what a second phone sees is a log with a hole: a gap in the
 * phone's deviceSeq and events that point at something that never arrived. None of that may throw or
 * corrupt the rest.
 */
describe('a log with an event that never reached the server', () => {
  it('projects and totals without the missing event, and ignores references to it (deviceSeq gap)', () => {
    const b = setUpSale();
    const lostId = b.nextId();
    b.sys({ t: 'zone_added', zoneId: 'zLost', name: 'โซนที่ถูกปฏิเสธ' })
      .sys({ t: 'pile_added', pileId: 'pLost', zoneId: 'zLost', name: 'กอง', tareG: 2_000, stdNetG: 50_000 })
      .accept('pLost')
      .accept('p1')
      .remove('zLost')
      .restore('zLost');
    const all = b.build();
    const seen = all.filter((e) => e.id !== lostId);
    expect(seen).toHaveLength(all.length - 1);
    const seqs = seen.map((e) => e.deviceSeq).sort((x, y) => x - y);
    expect(seqs.at(-1)! - seqs[0] + 1).toBeGreaterThan(seqs.length); // a real hole in the sequence

    expect(() => projectSale(seen)).not.toThrow();
    const state = projectSale(seen);
    expect(state.piles.map((p) => p.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    expect(saleTotals(seen).baskets).toBe(2);
    expect(deletedIds(seen).has('zLost')).toBe(false);
  });

  it('a correction that voids a basket that never arrived changes nothing and does not throw', () => {
    const b = setUpSale();
    b.accept('p1');
    const lostId = b.nextId();
    b.accept('p1'); // rejected on the server, never seen by the other phone
    b.void('p1', lostId).accept('p1');
    const all = b.build();
    const seen = all.filter((e) => e.id !== lostId);
    expect(() => projectSale(seen)).not.toThrow();
    expect(() => saleTotals(seen)).not.toThrow();
    expect(saleTotals(seen).baskets).toBe(2); // the two baskets that did arrive; the void finds nothing to void
  });

  it('foldRecord: a change based on a rejected event waits, the rest of the record is intact', () => {
    const create: ChangeNode = { id: 'c', targetId: 'b1', baseEventId: null, patch: { netG: 50_000 } };
    // 'lost' was rejected; 'next' was recorded on top of it, 'other' on another phone, on the create.
    const next: ChangeNode = { id: 'next', targetId: 'b1', baseEventId: 'lost', patch: { netG: 52_000 } };
    const other: ChangeNode = { id: 'other', targetId: 'b1', baseEventId: 'c', patch: { note: 'wet' } };
    const r = foldRecord([create, next, other]);
    expect(r.waiting).toBe(true);
    expect(r.value).toMatchObject({ netG: 50_000, note: 'wet' });
    expect(r.heads).toEqual(['other']);
    expect(r.conflicts).toEqual([]);
  });
});
