import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newGroup } from '../core/group';
import { FIXTURE_GROUP_ID, LogBuilder } from '../core/fixtures';
import type { AcceptEvent, SaleEvent } from '../core/types';
import { userFromSignIn } from '../core/user';
import { MemoryAccountStore } from '../store/account-memory';
import { MemoryStore } from '../store/memory-store';
import { backoffMs, FIRST_PULL_DONE, MemoryCursor, PULL_OVERLAP_MS, storeCursor, SyncEngine } from './engine';
import { RemoteError } from './remote';
import { FakeRemote, FakeServer } from './fake-remote';

/** The user and group the fixtures record under (`LogBuilder`). */
const SCOPE = { userId: 'user-somchai', groupId: FIXTURE_GROUP_ID };
const somchai = userFromSignIn(SCOPE.userId, 'สมชาย', { provider: 'google', subject: 'g-1' });

/** A phone: its own store and cursor, talking to a shared server. */
async function phone(server = new FakeServer()) {
  const store = new MemoryStore();
  const accounts = new MemoryAccountStore();
  const remote = new FakeRemote(server);
  const cursor = new MemoryCursor();
  const engine = new SyncEngine({ store, accounts, scope: SCOPE, remote, cursor, random: () => 0 });
  const { deviceId } = await store.device();
  return { store, accounts, remote, cursor, engine, deviceId, server };
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

  it('leaves an event recorded before groups existed on the device (E02-S02)', async () => {
    const p = await phone();
    const [e] = new LogBuilder('s1', p.deviceId).accept('p1').build();
    const { groupId: _none, ...old } = e;
    vi.spyOn(p.store, 'pending').mockResolvedValue([old as SaleEvent]);
    await p.engine.sync();
    expect(p.server.docs.size).toBe(0);
    // ...and it is not counted as waiting: nothing can ever send it.
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
    expect(pull).toHaveBeenLastCalledWith(2_000_000 - PULL_OVERLAP_MS, undefined, expect.any(Number));
  });

  it('remembers a first pull that found an empty group, so "never pulled" and "nothing there" differ', async () => {
    const p = await phone();
    const pull = vi.spyOn(p.remote, 'pull');
    expect(await p.cursor.get()).toBe(0);
    await p.engine.sync();
    expect(await p.cursor.get()).toBe(FIRST_PULL_DONE);
    await p.engine.sync();
    expect(pull).toHaveBeenLastCalledWith(0, undefined, expect.any(Number)); // never before the epoch
  });

  it('a pull that failed is not a first pull', async () => {
    const p = await phone();
    p.remote.failNext('unavailable');
    await p.engine.sync();
    expect(await p.cursor.get()).toBe(0);
  });

  it('tells the app after each successful pull', async () => {
    const onPulled = vi.fn();
    const p = await phone();
    const engine = new SyncEngine({ store: p.store, accounts: p.accounts, scope: SCOPE, remote: p.remote, cursor: p.cursor, onPulled, random: () => 0 });
    p.remote.failNext('unavailable');
    await engine.sync();
    expect(onPulled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onPulled).toHaveBeenCalledTimes(1);
    engine.stop();
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
    const relaunched = new SyncEngine({ store, accounts: p.accounts, scope: SCOPE, remote: new FakeRemote(p.server), cursor: p.cursor, random: () => 0 });
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

describe('media through the engine (E01-S12 AC2, AC5)', () => {
  it('queued files count as pending, upload after the events, and retry with backoff', async () => {
    const { MemoryMediaQueue, FakeStorage } = await import('./media');
    const store = new MemoryStore();
    const queue = new MemoryMediaQueue();
    const storage = new FakeStorage();
    const engine = new SyncEngine({
      store,
      accounts: new MemoryAccountStore(),
      scope: SCOPE,
      remote: new FakeRemote(),
      cursor: new MemoryCursor(),
      media: { queue, remote: storage },
      random: () => 0,
    });
    await queue.enqueue({ mediaId: 'm1', groupId: 'g1', contentType: 'image/jpeg', hash: 'h' }, new Uint8Array([1]));
    storage.failNext('unavailable');
    await engine.sync();
    expect(engine.status()).toMatchObject({ state: 'pending', pending: 1 });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(storage.objects.has('groups/g1/media/m1')).toBe(true);
    expect(engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });
});

describe('review fixes', () => {
  it('a pull that never answers times out instead of wedging every later sync', async () => {
    const p = await phone();
    p.remote.pull = () => new Promise(() => undefined);
    const first = p.engine.sync();
    await vi.advanceTimersByTimeAsync(60_000);
    await first;
    expect(p.engine.status().state).toBe('pending');
  });

  it('a corrupt pulled doc keeps the error showing on later clean runs, until retry finds it fixed', async () => {
    const p = await phone();
    const [mine] = new LogBuilder('s1', 'dev-x').accept('p1').build() as AcceptEvent[];
    await p.store.insertPulled(mine);
    p.server.docs.set(mine.id, { event: { ...mine, netG: 1 }, receivedAt: 10 });
    await p.engine.sync();
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'integrity' });
    expect(p.engine.integrityIds()).toEqual([mine.id]);

    p.server.docs.set(mine.id, { event: mine, receivedAt: 11 });
    await p.engine.retry();
    expect(p.engine.status().state).toBe('synced');
    expect(p.engine.integrityIds()).toEqual([]);
  });

  it('a local failure on a timer path is not an unhandled rejection', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.store.pending = async () => {
      throw new Error('disk');
    };
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    p.engine.poke();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(10);
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('one refused event does not hold back the rest of the outbox', async () => {
    const p = await phone();
    const events = new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').accept('p1').build() as AcceptEvent[];
    await record(p.store, events);
    p.server.docs.set(events[1].id, { event: { ...events[1], netG: 1 }, receivedAt: 5 });
    await p.engine.sync();
    expect((await p.store.pending()).map((e) => e.id)).toEqual([events[1].id]);
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'integrity', pending: 1 });
  });

  it('after stop(), an in-flight failure schedules no more retries', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.offline = true;
    const run = p.engine.sync();
    p.engine.stop();
    await run;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the cursor never moves backwards when a listener and a sync interleave', async () => {
    const p = await phone();
    await p.cursor.set(500);
    const [e] = new LogBuilder('s1', 'dev-x').accept('p1').build();
    await p.engine.ingest([{ event: e, receivedAt: 100 }]);
    expect(await p.cursor.get()).toBe(500);
  });
});

describe('storeCursor', () => {
  it('keeps the pull cursor in the store, so a restart resumes instead of re-downloading', async () => {
    const { storeCursor } = await import('./engine');
    const store = new MemoryStore();
    const cursor = storeCursor(store, 'g1');
    await cursor.set(99);
    expect(await storeCursor(store, 'g1').get()).toBe(99);
  });

  it('a second group on the device starts from the beginning, not from the first group\'s position', async () => {
    const { storeCursor } = await import('./engine');
    const store = new MemoryStore();
    await storeCursor(store, 'g1').set(99);
    expect(await storeCursor(store, 'g2').get()).toBe(0);
  });
});

describe('scope and group creation (E01-S09, E02-S02 review gaps)', () => {
  const created = () => newGroup(FIXTURE_GROUP_ID, 'สวนบ้านนา', somchai, 1_790_000_000_000);

  it('sends the pending create_group first, and only then that group\'s events', async () => {
    const p = await phone();
    p.server.requireGroups = true;
    const { membership, op } = created();
    await p.accounts.createGroup(membership, op);
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').build());

    await p.engine.sync();
    expect(p.remote.calls).toEqual([`group:${FIXTURE_GROUP_ID}`, 'push']);
    expect(p.server.groups.get(FIXTURE_GROUP_ID)).toBe(SCOPE.userId);
    expect(await p.accounts.pendingOps()).toEqual([]);
    expect(await p.accounts.memberships()).toEqual([membership]);
    expect(p.server.docs.size).toBe(2);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('while the group cannot be created, no event is sent and the badge counts the op too', async () => {
    const p = await phone();
    const { membership, op } = created();
    await p.accounts.createGroup(membership, op);
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.offline = true;

    await p.engine.sync();
    expect(p.remote.calls).toEqual([]); // not even the group: the server was not reached
    expect(p.engine.status()).toMatchObject({ state: 'pending', pending: 2 });

    p.remote.offline = false;
    await p.engine.sync();
    expect(p.server.docs.size).toBe(1);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('a create_group that failed once is sent again, and sending it twice is harmless', async () => {
    const p = await phone();
    const { membership, op } = created();
    await p.accounts.createGroup(membership, op);
    p.remote.failNext('unavailable');
    await p.engine.sync();
    expect(await p.accounts.pendingOps()).toEqual([op]);
    await vi.advanceTimersByTimeAsync(2_000);
    await p.engine.sync();
    expect(await p.accounts.pendingOps()).toEqual([]);
    expect(p.server.groups.size).toBe(1);
  });

  it('a refused create_group is an error with a retry, sends no events and does not pull', async () => {
    const p = await phone();
    const { membership, op } = created();
    await p.accounts.createGroup(membership, op);
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true;
    const pull = vi.spyOn(p.remote, 'pull');

    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'denied', pending: 2 });
    expect(p.remote.batches).toEqual([]);
    expect(pull).not.toHaveBeenCalled();
    expect(await p.accounts.pendingOps()).toEqual([op]);

    p.remote.denied = false;
    await p.engine.retry();
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('never sends or counts events of another group or another user', async () => {
    const p = await phone();
    const mine = new LogBuilder('s1', p.deviceId).accept('p1').build();
    const [other] = new LogBuilder('s2', p.deviceId).accept('p1').build();
    const elsewhere = { ...other, id: 'x-1', groupId: 'group-9' } as SaleEvent;
    const someoneElse = { ...other, id: 'x-2', actor: { ...other.actor, userId: 'user-mallory' } } as SaleEvent;
    await record(p.store, [...mine, elsewhere, someoneElse]);

    await p.engine.sync();
    expect([...p.server.docs.keys()]).toEqual(mine.map((e) => e.id));
    expect((await p.store.pending()).map((e) => e.id).sort()).toEqual(['x-1', 'x-2']);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('does not send another user\'s or another group\'s pending create_group', async () => {
    const p = await phone();
    const stranger = userFromSignIn('user-mallory', null, { provider: 'google', subject: 'g-9' });
    const theirs = newGroup(FIXTURE_GROUP_ID, 'ของคนอื่น', stranger, 1);
    const elsewhere = newGroup('group-8', 'อีกกลุ่ม', somchai, 2);
    await p.accounts.createGroup(theirs.membership, theirs.op);
    await p.accounts.createGroup(elsewhere.membership, elsewhere.op);

    await p.engine.sync();
    expect(p.remote.calls).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });
});

describe('one bad event never wedges the outbox (review A F1)', () => {
  it('the server calls one event invalid: the rest go, pulling goes on, the bad one shows as an error and is kept', async () => {
    const p = await phone();
    const [a, bad, c] = new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').accept('p1').build();
    p.remote.invalidIds.add(bad.id);
    await record(p.store, [a, bad, c]);
    const other = new LogBuilder('s9', 'dev-other').accept('p1').build()[0];
    p.server.docs.set(other.id, { event: other, receivedAt: 5 });

    await p.engine.sync();
    expect([...p.server.docs.keys()].sort()).toEqual([a.id, c.id, other.id].sort());
    expect((await p.store.pending()).map((e) => e.id)).toEqual([bad.id]); // kept, never dropped
    expect(await p.store.load('s9')).toEqual([other]); // pulled although the push had a bad event
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid', pending: 1 });
  });

  it('does not keep re-sending the rejected event on every run; retry() tries it again', async () => {
    const p = await phone();
    const [bad, ok] = new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').build();
    p.remote.invalidIds.add(bad.id);
    await record(p.store, [bad]);
    await p.engine.sync();
    p.remote.calls.length = 0;

    await record(p.store, [ok]);
    await p.engine.sync();
    expect(p.remote.batches.at(-1)!.map((e) => e.id)).toEqual([ok.id]); // the bad one is not in the batch
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid', pending: 1 });

    p.remote.invalidIds.clear(); // fixed server side
    await p.engine.retry();
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(p.server.docs.has(bad.id)).toBe(true);
  });
});

describe('a rules-rejected event (follow-up 1)', () => {
  it('a member whose malformed event is refused as permission-denied: that event is rejected and skipped on later runs, the rest go', async () => {
    const p = await phone();
    const [a, bad, c] = new LogBuilder('s1', p.deviceId).accept('p1').accept('p1').accept('p1').build();
    p.remote.rulesRejectIds.add(bad.id); // the rules say permission-denied, but the user can read the group
    await record(p.store, [a, bad, c]);
    await p.engine.sync();
    expect([...p.server.docs.keys()].sort()).toEqual([a.id, c.id].sort());
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid', pending: 1 });

    // later runs do not push it again, not even alone
    const [d] = new LogBuilder('s2', p.deviceId).accept('p1').build();
    await record(p.store, [d]);
    p.remote.batches.length = 0;
    await p.engine.sync();
    expect(p.remote.batches.flat().map((e) => e.id)).toEqual([d.id]);
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid', pending: 1 });
  });

  it('a user who cannot read the group (not a member) stays denied, nothing is marked rejected', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true; // writes refused and the group unreadable
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'denied', pending: 1 });
    p.remote.denied = false;
    await p.engine.retry();
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });
});

describe('fail fast before writing (review A F3/F4)', () => {
  it('offline: reads the server first and queues no write at all', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.offline = true;
    await p.engine.sync();
    expect(p.remote.checks).toBe(1);
    expect(p.remote.calls).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'pending', pending: 1 });
  });

  it('a database that does not exist is an error state with the events kept, not endless Pending', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.check = async () => {
      throw new RemoteError('invalid-argument', 'database does not exist');
    };
    await p.engine.sync();
    expect(p.remote.calls).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid', pending: 1 });
    expect(await p.store.pending()).toHaveLength(1);
  });
});

describe('pulling a big group (review A F5)', () => {
  const docs = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const event = new LogBuilder(`s${i}`, 'dev-other').accept('p1').build()[0];
      return { event, receivedAt: 1_000 + Math.floor(i / 2) }; // pairs share a stamp, as a batch does
    });

  function engineWith(p: Awaited<ReturnType<typeof phone>>, pullPageSize: number) {
    const engine = new SyncEngine({ store: p.store, accounts: p.accounts, scope: SCOPE, remote: p.remote, cursor: p.cursor, pullPageSize, random: () => 0 });
    return engine;
  }

  it('reads page by page, every doc once even when a page ends inside one timestamp, moving the cursor after each page', async () => {
    const p = await phone();
    for (const d of docs(5)) p.server.docs.set(d.event.id, d);
    const sets: number[] = [];
    const set = p.cursor.set.bind(p.cursor);
    p.cursor.set = async (v) => {
      sets.push(v);
      await set(v);
    };
    const pull = vi.spyOn(p.remote, 'pull');

    await engineWith(p, 2).sync();
    expect(pull).toHaveBeenCalledTimes(3);
    expect((await Promise.all(docs(5).map((d) => p.store.load(d.event.saleId)))).flat()).toHaveLength(5);
    expect(sets).toEqual([1_000, 1_001, 1_002]); // after each page, not once at the end
  });

  it('a failure on a later page keeps the earlier pages and the next run carries on', async () => {
    const p = await phone();
    for (const d of docs(5)) p.server.docs.set(d.event.id, d);
    const real = p.remote.pull.bind(p.remote);
    let calls = 0;
    p.remote.pull = async (...args) => {
      if (++calls === 2) throw new RemoteError('unavailable');
      return real(...args);
    };
    const engine = engineWith(p, 2);
    await engine.sync();
    expect(await p.cursor.get()).toBe(1_000); // page 1 is safe
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await Promise.all(docs(5).map((d) => p.store.load(d.event.saleId)))).flat()).toHaveLength(5);
    engine.stop();
  });

  it('re-reads no more than two minutes behind the cursor', () => {
    expect(PULL_OVERLAP_MS).toBeLessThanOrEqual(120_000);
  });
});

describe('corrupt documents survive a restart (follow-up 3)', () => {
  const T = 1_800_000_000_000; // stamps far past the 2-minute overlap, so a restart does not re-read them

  async function corruptGroup() {
    const p = await phone();
    const persisted = storeCursor(p.store, SCOPE.groupId);
    const [mine] = new LogBuilder('s1', 'dev-x').accept('p1').build() as AcceptEvent[];
    await p.store.insertPulled(mine);
    const [good] = new LogBuilder('s2', 'dev-y').accept('p1').build();
    p.server.docs.set(mine.id, { event: { ...mine, netG: 1 }, receivedAt: T });
    p.server.docs.set(good.id, { event: good, receivedAt: T + 10 });
    const engine = () =>
      new SyncEngine({ store: p.store, accounts: p.accounts, scope: SCOPE, remote: p.remote, cursor: persisted, random: () => 0 });
    return { p, mine, engine, persisted };
  }

  it('the id is stored with the group; a new engine on the same store still shows the integrity error', async () => {
    const { p, mine, engine, persisted } = await corruptGroup();
    const first = engine();
    await first.sync();
    expect(first.integrityIds()).toEqual([mine.id]);
    expect(await p.store.syncCorrupt(SCOPE.groupId)).toEqual([mine.id]);
    expect(await persisted.get()).toBe(T + 10); // the cursor did move past it

    const restarted = engine(); // app restarted: nothing in memory
    await restarted.sync();
    expect(restarted.status()).toMatchObject({ state: 'error', error: 'integrity' });
    expect(restarted.integrityIds()).toEqual([mine.id]);
  });

  it('retry() on a restarted engine finds it fixed on the server and forgets it for good', async () => {
    const { p, mine, engine } = await corruptGroup();
    await engine().sync();
    p.server.docs.set(mine.id, { event: mine, receivedAt: T + 20 });

    const restarted = engine();
    await restarted.retry();
    expect(restarted.status().state).toBe('synced');
    expect(await p.store.syncCorrupt(SCOPE.groupId)).toEqual([]);
    const again = engine();
    await again.sync();
    expect(again.status().state).toBe('synced');
  });
});

describe('a stopped engine writes no cursor (follow-up 5)', () => {
  it('an in-flight page that comes back after stop() leaves the cursor alone', async () => {
    const p = await phone();
    const [other] = new LogBuilder('s9', 'dev-other').accept('p1').build();
    p.server.docs.set(other.id, { event: other, receivedAt: 5_000_000 });
    let release: () => void = () => undefined;
    const real = p.remote.pull.bind(p.remote);
    p.remote.pull = async (...args: Parameters<typeof real>) => {
      const page = await real(...args);
      await new Promise<void>((resolve) => (release = resolve));
      return page;
    };
    const run = p.engine.sync();
    await vi.advanceTimersByTimeAsync(0);
    p.engine.stop();
    release();
    await run;
    expect(await p.cursor.get()).toBe(0);
  });
});

describe('telling the wizard the group reached the server (follow-up 4)', () => {
  it('completing the create_group op emits onChanged, so the wizard gate re-reads', async () => {
    const p = await phone();
    const { membership, op } = newGroup(FIXTURE_GROUP_ID, 'สวนบ้านนา', somchai, 1_790_000_000_000);
    await p.accounts.createGroup(membership, op);
    const onChanged = vi.fn();
    const engine = new SyncEngine({ store: p.store, accounts: p.accounts, scope: SCOPE, remote: p.remote, cursor: p.cursor, onChanged, random: () => 0 });
    await engine.sync();
    expect(await p.accounts.pendingOps()).toEqual([]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

describe('slow retry of a permanent error (follow-up 2)', () => {
  const SLOW = 5 * 60_000;

  it('an error clears itself once the cause is fixed, within about five minutes and with no trigger', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true;
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'denied' });

    p.remote.denied = false; // rules deployed, membership added ...
    await vi.advanceTimersByTimeAsync(SLOW - 1_000);
    expect(p.engine.status().state).toBe('error'); // not before its time
    await vi.advanceTimersByTimeAsync(2_000 + 60_000); // ... plus the jitter
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(p.server.docs.size).toBe(1);
  });

  it('never a hot loop: while the cause stays, one attempt per ~5 minutes, and none after stop()', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true;
    await p.engine.sync();
    const first = p.remote.checks;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    const runs = (p.remote.checks - first) / 2; // two reads per run here: the check, then the "can I read the group" probe
    expect(runs).toBeGreaterThanOrEqual(4);
    expect(runs).toBeLessThanOrEqual(6);

    p.engine.stop();
    const after = p.remote.checks;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(p.remote.checks).toBe(after);
  });

  it('a transient failure does not use it (its own backoff does), and a clean run schedules nothing', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.offline = true;
    await p.engine.sync();
    p.remote.offline = false;
    await vi.advanceTimersByTimeAsync(5_000); // backoff (2 s) sends it
    expect(p.engine.status().state).toBe('synced');
    const checks = p.remote.checks;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(p.remote.checks).toBe(checks);
  });

  it('keeps skipping a rejected event: only retry() or a restart sends it again', async () => {
    const p = await phone();
    const [bad] = new LogBuilder('s1', p.deviceId).accept('p1').build();
    p.remote.invalidIds.add(bad.id);
    await record(p.store, [bad]);
    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid' });
    const sent = p.remote.batches.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(p.remote.batches.length).toBe(sent); // not one more push for it, and no run loop for it either
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'invalid' });
  });

  it('nudge() (app back in the foreground) retries a permanent error at once, but not more than every 30 s', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    p.remote.denied = true;
    await p.engine.sync();
    p.remote.denied = false;

    p.engine.nudge(); // too soon after the attempt that just failed
    await vi.advanceTimersByTimeAsync(0);
    expect(p.engine.status().state).toBe('error');

    await vi.advanceTimersByTimeAsync(31_000);
    p.engine.nudge();
    await vi.advanceTimersByTimeAsync(10);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('nudge() does nothing when there is no permanent error', async () => {
    const p = await phone();
    await p.engine.sync();
    const checks = p.remote.checks;
    p.engine.nudge();
    await vi.advanceTimersByTimeAsync(100);
    expect(p.remote.checks).toBe(checks);
  });
});

describe('stop() (review B M2)', () => {
  it('stops an in-flight run: nothing more is sent or pulled and nobody is told after it', async () => {
    const p = await phone();
    await record(p.store, new LogBuilder('s1', p.deviceId).accept('p1').build());
    let release: () => void = () => undefined;
    const real = p.remote.push.bind(p.remote);
    p.remote.push = async (events) => {
      await new Promise<void>((resolve) => (release = resolve));
      return real(events);
    };
    const heard = vi.fn();
    const onPulled = vi.fn();
    const engine = new SyncEngine({ store: p.store, accounts: p.accounts, scope: SCOPE, remote: p.remote, cursor: p.cursor, onPulled, random: () => 0 });
    engine.subscribe(heard);
    const pull = vi.spyOn(p.remote, 'pull');

    const run = engine.sync();
    await vi.advanceTimersByTimeAsync(0);
    engine.stop();
    release();
    await run;
    expect(pull).not.toHaveBeenCalled();
    expect(onPulled).not.toHaveBeenCalled();
    expect(heard).not.toHaveBeenCalled();
  });
});
