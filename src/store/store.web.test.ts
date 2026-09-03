import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import { DuplicateSeqError } from './errors';
import { WebStore } from './store.web';

/**
 * `WebStore` against a fake `localStorage` (S23 review, finding 1).
 *
 * `store.test.ts` proves the port's contract on `MemoryStore` — the reference
 * implementation nothing ships. This file proves the one that actually runs in
 * the browser, and in particular the claim its own comment makes: a batch is
 * ONE `setItem`, so there is no window in which half a bulk entry is stored.
 * That is measured here by counting calls, not read off the comment.
 *
 * The adapter reads `globalThis.localStorage` at call time, so a fake object
 * is enough — no jsdom, and the vitest node environment stays as it is.
 */

interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'mon-farm:events:s1';

let backing: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  backing = new Map();
  setItem = vi.fn((key: string, value: string) => {
    backing.set(key, value);
  });
  const fake: FakeStorage = {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => setItem(key, value),
  };
  vi.stubGlobal('localStorage', fake);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const batch = () => {
  const b = new LogBuilder('s1').sys({ t: 'bulk_gate_skipped', pileId: 'p1', reason: 'ย้อนหลัง' });
  b.accept('p1', 50_000, 2_000, 'bulk');
  b.accept('p1', 50_000, 2_000, 'bulk');
  b.short('p1', 10_400);
  b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });
  return b.build();
};

describe('WebStore.appendAll', () => {
  it('writes every event in the batch', async () => {
    const store = new WebStore();
    await store.appendAll(batch());
    expect((await store.load('s1')).map((e) => e.kind)).toEqual([
      'sys',
      'accept',
      'accept',
      'short',
      'sys',
    ]);
  });

  it('stores the whole batch in a SINGLE write to the log key', async () => {
    const store = new WebStore();
    await store.appendAll(batch());
    // One write of the log, plus the sale index the first append registers.
    // What matters is the first number: five events, one setItem, no window.
    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
  });

  it('writes NOTHING when any event in the batch collides on seq', async () => {
    const store = new WebStore();
    const events = batch();
    await store.append(events[3]); // the leftover lands first, on its own
    setItem.mockClear();

    await expect(store.appendAll(events)).rejects.toBeInstanceOf(DuplicateSeqError);
    // Not a partial pile, and not a rewritten log either: no write happened.
    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(0);
    expect(await store.load('s1')).toEqual([events[3]]);
  });

  it('is a no-op for an empty batch', async () => {
    const store = new WebStore();
    await store.appendAll([]);
    expect(setItem).not.toHaveBeenCalled();
    expect(await store.load('s1')).toEqual([]);
  });

  it('registers the sale in the index exactly once', async () => {
    const store = new WebStore();
    const events = batch();
    await store.appendAll(events.slice(0, 4));
    await store.append(events[4]);
    expect(await store.listSales()).toEqual(['s1']);
  });
});
