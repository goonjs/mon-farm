import { describe, expect, it } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import { DuplicateSeqError } from './errors';
import { MemoryStore } from './store';

/**
 * `appendAll` — the batch write S23 needs (see that story's Dev notes).
 *
 * One bulk entry is a sequence of events that only means anything whole: the
 * gate-skip, the baskets, the leftover and the close. Written one at a time,
 * a crash part-way through leaves a pile carrying baskets that the log says
 * was never started — numbers with no record of where they came from, which
 * is the one thing this log exists to prevent. So the port grows an
 * all-or-nothing write, proven here against the reference implementation and
 * mirrored by each adapter (one localStorage write on web, one SQLite
 * transaction on device).
 */
describe('EventStore.appendAll — all or nothing', () => {
  const batch = () => {
    const b = new LogBuilder('s1').sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'ย้อนหลัง' });
    b.accept('p1', 50_000, 2_000, 'bulk');
    b.accept('p1', 50_000, 2_000, 'bulk');
    b.short('p1', 10_400);
    b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    return b.build();
  };

  it('writes every event in the batch', async () => {
    const store = new MemoryStore();
    await store.appendAll(batch());
    expect((await store.load('s1')).map((e) => e.kind)).toEqual([
      'sys',
      'accept',
      'accept',
      'short',
      'sys',
    ]);
  });

  it('writes NOTHING when any event in the batch collides on seq', async () => {
    const store = new MemoryStore();
    const events = batch();
    await store.append(events[3]); // the leftover lands first, on its own

    await expect(store.appendAll(events)).rejects.toBeInstanceOf(DuplicateSeqError);
    // Not a partial pile: the earlier events in the batch were not kept.
    expect(await store.load('s1')).toEqual([events[3]]);
  });

  it('is a no-op for an empty batch', async () => {
    const store = new MemoryStore();
    await store.appendAll([]);
    expect(await store.load('s1')).toEqual([]);
  });
});
