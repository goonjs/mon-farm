import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import type { AcceptEvent, SaleEvent } from '../core/types';
import { MemoryStore } from '../store/memory-store';
import { backoffMs, MemoryCursor, PULL_OVERLAP_MS, SyncEngine } from './engine';
import { FakeRemote, FakeServer } from './fake-remote';

/** A phone: its own store and cursor, talking to a shared server. */
async function phone(server = new FakeServer()) {
  const store = new MemoryStore();
  const remote = new FakeRemote(server);
  const cursor = new MemoryCursor();
  const engine = new SyncEngine({ store, remote, cursor, random: () => 0 });
  const { deviceId } = await store.device();
  return { store, remote, cursor, engine, deviceId, server };
}

async function record(store: MemoryStore, events: SaleEvent[]) {
  for (const e of events) await store.append(e);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('backoffMs', () => {
  it('starts at 2 s, doubles, and stops at 60 s plus jitter', () => {
    expect(backoffMs(0, () => 0)).toBe(2_000);
    expect(backoffMs(1, () => 0)).toBe(4_000);
    expect(backoffMs(4, () => 0)).toBe(32_000);
    expect(backoffMs(5, () => 0)).toBe(60_000);
    expect(backoffMs(30, () => 0)).toBe(60_000);
    expect(backoffMs(0, () => 0.999)).toBeLessThan(3_000);
    expect(backoffMs(0, () => 0.999)).toBeGreaterThan(2_000);
  });
});

describe('push (SYNC-1, SYNC-2)', () => {
  it('records offline into the outbox, then sends it and empties the outbox', async () => {
    const p = await phone();
    p.remote.offline = true;
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').build());
    await p.engine.sync();
    expect(await p.store.pending()).toHaveLength(2);
    expect(p.engine.status()).toMatchObject({ state: 'pending', pending: 2 });

    p.remote.offline = false;
    await p.engine.sync();
    expect(await p.store.pending()).toEqual([]);
    expect(p.server.docs.size).toBe(2);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('sends in batches of at most 500, one batch at a time, in device order', async () => {
    const p = await phone();
    const b = new LogBuilder('s1', p.deviceId);
    for (let i = 0; i < 1_201; i++) b.accept('p1');
    await record(p.store, b.build());
    await p.engine.sync();
    expect(p.remote.batches.map((x) => x.length)).toEqual([500, 500, 201]);
    expect(p.remote.maxInFlight).toBe(1);
    const seqs = p.remote.batches.flat().map((e) => e.deviceSeq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
  });

  it('a transient failure stays Pending, retries on its own with backoff, and never touches local data', async () => {
    const p = await phone();
    const events = new LogBuilder('s1', p.deviceId).accept('p1').build();
    await record(p.store, events);
    p.remote.failNext('unavailable', 'unavailable');

    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'pending', pending: 1 });
    expect(await p.store.load('s1')).toEqual(events);

    await vi.advanceTimersByTimeAsync(2_000); // attempt 2 fails
    expect(p.server.docs.size).toBe(0);
    await vi.advanceTimersByTimeAsync(4_000); // attempt 3 succeeds
    expect(p.server.docs.size).toBe(1);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('an ack lost in transit is recognised on retry, not sent twice and not an error', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.loseNextAck();
    await p.engine.sync();
    expect(p.engine.status().state).toBe('pending');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(p.server.docs.size).toBe(1);
    expect(await p.store.pending()).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'synced' });
  });

  it('refused for real (not a member): error with retry, outbox kept, no automatic retry', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true;
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'denied', pending: 1 });

    const before = p.remote.batches.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(p.remote.batches.length).toBe(before);

    p.remote.denied = false;
    await p.engine.retry();
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('the server holding different content under our id is an integrity error, never overwritten', async () => {
    const p = await phone();
    const [e] = new LogBuilder('s1', p.deviceId).accept('p1').build() as AcceptEvent[];
    p.server.docs.set(e.id, { event: { ...e, netG: 1 }, receivedAt: 5 });
    await record(p.store, [e]);
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'integrity', pending: 1 });
    expect((p.server.docs.get(e.id)!.event as AcceptEvent).netG).toBe(1);
  });

  it('a push that never answers times out after 30 s and stays Pending', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.push = () => new Promise(() => undefined);
    const done = p.engine.sync();
    await vi.advanceTimersByTimeAsync(30_000);
    await done;
    expect(p.engine.status()).toMatchObject({ state: 'pending', pending: 1 });
  });

  it('calls while a sync runs fold into one follow-up run', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    await Promise.all([p.engine.sync(), p.engine.sync(), p.engine.sync()]);
    expect(p.remote.batches.length).toBe(1);
    expect(p.remote.maxInFlight).toBe(1);
  });

  it('a local append triggers a sync after a short debounce, with no Sync button', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.engine.poke();
    p.engine.poke();
    expect(p.server.docs.size).toBe(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(p.server.docs.size).toBe(1);
    expect(p.remote.batches.length).toBe(1);
  });
});

describe('pull', () => {
  it('stores other devices\' events and pulling again adds no duplicates', async () => {
    const server = new FakeServer();
    const a = await phone(server);
    const b = await phone(server);
    await record(a.store, new LogBuilder('s1', a.deviceId).accept('p1').accept('p1').build());
    await a.engine.sync();

    await b.engine.sync();
    await b.engine.sync();
    expect(await b.store.load('s1')).toEqual(await a.store.load('s1'));
    expect(await b.store.pending()).toEqual([]);
  });

  it('moves the cursor to the newest receivedAt, and re-reads a 10-minute overlap', async () => {
    const p = await phone();
    const other = new LogBuilder('s1', 'dev-other').accept('p1').build();
    p.server.docs.set(other[0].id, { event: other[0], receivedAt: 2_000_000 });
    const pull = vi.spyOn(p.remote, 'pull');
    await p.engine.sync();
    expect(await p.cursor.get()).toBe(2_000_000);
    await p.engine.sync();
    expect(pull).toHaveBeenLastCalledWith(2_000_000 - PULL_OVERLAP_MS);
  });

  it('skips a document with the same id but different content and keeps going', async () => {
    const p = await phone();
    const [mine] = new LogBuilder('s1', 'dev-x').accept('p1').build() as AcceptEvent[];
    await p.store.insertPulled(mine);
    const [good] = new LogBuilder('s2', 'dev-y').accept('p1').build();
    p.server.docs.set(mine.id, { event: { ...mine, netG: 1 }, receivedAt: 10 });
    p.server.docs.set(good.id, { event: good, receivedAt: 20 });

    await p.engine.sync();
    expect(await p.store.load('s2')).toEqual([good]);
    expect((await p.store.load('s1'))[0]).toEqual(mine);
    expect(await p.cursor.get()).toBe(20);
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'integrity' });
  });

  it('ignores documents the server has not stamped yet', async () => {
    const p = await phone();
    const [e] = new LogBuilder('s1', 'dev-x').accept('p1').build();
    await p.engine.ingest([{ event: e, receivedAt: null }]);
    expect(await p.store.load('s1')).toEqual([]);
    expect(await p.cursor.get()).toBe(0);
  });

  it('a pull failure is transient: Pending, then retried', async () => {
    const p = await phone();
    const [e] = new LogBuilder('s1', 'dev-x').accept('p1').build();
    p.server.docs.set(e.id, { event: e, receivedAt: 10 });
    p.remote.failNext('unavailable');
    await p.engine.sync();
    expect(p.engine.status().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await p.store.load('s1')).toEqual([e]);
    expect(p.engine.status().state).toBe('synced');
  });
});

describe('several phones (SYNC-4, NFR-2)', () => {
  it('baskets from three phones in one sale merge into one set without asking', async () => {
    const server = new FakeServer();
    const phones = [await phone(server), await phone(server), await phone(server)];
    const shared = new LogBuilder('s1', phones[0].deviceId).accept('p1');
    await record(phones[0].store, shared.build());
    for (const [i, p] of phones.entries()) {
      await record(p.store, shared.fork(p.deviceId).accept(`p${i}`).accept(`p${i}`).build().slice(1));
    }
    for (const p of phones) await p.engine.sync();
    for (const p of phones) await p.engine.sync();

    const logs = await Promise.all(phones.map((p) => p.store.load('s1')));
    expect(logs[0]).toHaveLength(7);
    expect(logs[1]).toEqual(logs[0]);
    expect(logs[2]).toEqual(logs[0]);
    expect(server.docs.size).toBe(7);
  });

  it('force-closed after the server took the batch but before markSynced: no loss, no duplicate', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').build());
    // The app dies between the server's commit and the local markSynced.
    p.store.markSynced = async () => {
      throw new Error('killed');
    };
    await p.engine.sync().catch(() => undefined);
    expect(p.server.docs.size).toBe(2);

    // Relaunch: same durable store, new engine.
    const store = p.store;
    store.markSynced = MemoryStore.prototype.markSynced.bind(store);
    const relaunched = new SyncEngine({ store, remote: new FakeRemote(p.server), cursor: p.cursor, random: () => 0 });
    await relaunched.sync();
    expect(await store.pending()).toEqual([]);
    expect(p.server.docs.size).toBe(2);
    expect(relaunched.status().state).toBe('synced');
  });
});

describe('status listeners', () => {
  it('tell subscribers when the state changes, and stop after unsubscribe', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    const seen: string[] = [];
    const off = p.engine.subscribe((s) => seen.push(s.state));
    p.remote.offline = true;
    await p.engine.sync();
    p.remote.offline = false;
    await p.engine.sync();
    expect(seen).toEqual(['pending', 'synced']);

    off();
    p.remote.offline = true;
    await record(p.store, new LogBuilder('s9', p.deviceId).accept('p1').build());
    await p.engine.sync();
    expect(seen).toEqual(['pending', 'synced']);
  });
});
