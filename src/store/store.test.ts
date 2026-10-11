import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import type { AcceptEvent } from '../core/types';
import { canonicalJson } from '../core/canonical';
import { IntegrityError, MemoryStore, type EventStore } from './store';
import { openDb } from './idb';
import { IndexedDbStore } from './store.web';

const UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * One contract, every adapter (E01-S03 AC2: the web store behaves like the
 * others). Each case gets a fresh store; IndexedDB runs on fake-indexeddb, a
 * new database per case. SQLite is covered on device (E01-S06).
 */
const adapters: [string, () => EventStore][] = [
  ['MemoryStore', () => new MemoryStore()],
  ['IndexedDbStore', () => new IndexedDbStore(new IDBFactory())],
];

describe.each(adapters)('%s — EventStore rules (E01-S02 AC2/AC3, E01-S03 AC2)', (_name, makeStore) => {
  it('re-appending the same id with the same content is a no-op (idempotent for sync)', async () => {
    const store = makeStore();
    const [e] = new LogBuilder().accept('p1').build();
    await store.append(e);
    // Same content, keys in another order — as a pulled copy would arrive.
    const reordered = Object.fromEntries(Object.entries(e).reverse()) as typeof e;
    await store.append(reordered);
    expect(await store.load(e.saleId)).toHaveLength(1);
  });

  it('rejects the same id with different content, never overwriting', async () => {
    const store = makeStore();
    const [e] = new LogBuilder().accept('p1').build() as AcceptEvent[];
    await store.append(e);
    await expect(store.append({ ...e, netG: 1 })).rejects.toBeInstanceOf(IntegrityError);
    expect((await store.load(e.saleId))[0]).toEqual(e);
  });

  it('mints one UUIDv7 device id per install and starts its sequence at 1', async () => {
    const store = makeStore();
    const a = await store.device();
    const b = await store.device();
    expect(a.deviceId).toMatch(UUIDV7);
    expect(b.deviceId).toBe(a.deviceId);
    expect(a.nextDeviceSeq).toBe(1);
  });

  it('advances the device sequence past every event this device has stored', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const events = new LogBuilder('s1', deviceId).accept('p1').accept('p1').build();
    for (const e of events) await store.append(e);
    expect((await store.device()).nextDeviceSeq).toBe(3);
  });

  it('gives an event claiming an already-used device sequence the next free one, never repeating', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const [first] = new LogBuilder('s1', deviceId).accept('p1').build();
    const [clash] = new LogBuilder('s2', deviceId).accept('p1').build(); // also proposes 1
    await store.append(first);
    await store.append(clash);
    expect((await store.load('s2'))[0]).toMatchObject({ id: clash.id, deviceSeq: 2 });
    expect((await store.device()).nextDeviceSeq).toBe(3);

    // Re-appending the caller's copy (still numbered 1) is the same event, not a conflict.
    await store.append(clash);
    expect(await store.pending()).toHaveLength(2);
  });

  it('one id, one body: what is stored and what the outbox sends both carry the allocated number', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const [first] = new LogBuilder('s1', deviceId).accept('p1').build();
    const [clash] = new LogBuilder('s2', deviceId).accept('p2').build(); // proposes 1, gets 2
    await store.append(first);
    await store.append(clash);

    const loaded = (await store.load('s2')).find((e) => e.id === clash.id)!;
    const queued = (await store.pending()).find((e) => e.id === clash.id)!;
    expect(loaded.deviceSeq).toBe(2);
    expect(canonicalJson(queued)).toBe(canonicalJson(loaded));
  });

  it('still refuses the same id with different content after renumbering', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const [first] = new LogBuilder('s1', deviceId).accept('p1').build();
    const [clash] = new LogBuilder('s2', deviceId).accept('p1').build();
    await store.append(first);
    await store.append(clash); // stored as deviceSeq 2
    await expect(store.append({ ...clash, ts: clash.ts + 1 })).rejects.toBeInstanceOf(IntegrityError);
  });

  it('stores other devices\' events exactly as received and leaves this device\'s counter alone', async () => {
    const store = makeStore();
    const [theirs] = new LogBuilder('s1', 'dev-other').accept('p1').accept('p1').build().slice(1);
    await store.append(theirs);
    expect((await store.load('s1'))[0]).toEqual(theirs);
    expect((await store.device()).nextDeviceSeq).toBe(1);
  });

  it('lists pending events in device order and clears them by id', async () => {
    const store = makeStore();
    const events = new LogBuilder().accept('p1').accept('p1').accept('p1').build();
    for (const e of [...events].reverse()) await store.append(e);
    expect((await store.pending()).map((e) => e.id)).toEqual(events.map((e) => e.id));

    await store.markSynced([events[0].id]);
    expect((await store.pending()).map((e) => e.id)).toEqual([events[1].id, events[2].id]);
  });

  it('lists sales newest first by their first event — not by id or insertion order', async () => {
    const store = makeStore();
    // Ids sort the other way round, and the older sale is appended first.
    const older = new LogBuilder('a-old').accept('p1').build();
    const newer = new LogBuilder('z-new').accept('p1').build().map((e) => ({ ...e, ts: e.ts + 86_400_000 }));
    for (const e of [...older, ...newer]) await store.append(e);
    expect(await store.listSales()).toEqual(['z-new', 'a-old']);
  });

  it('drains the outbox in numeric device order, past 9 (not string order)', async () => {
    const store = makeStore();
    // Another device's events: stored as received (this device's own would be
    // renumbered when appended out of order, by design).
    const b = new LogBuilder('s1', 'dev-other');
    for (let i = 0; i < 12; i++) b.accept('p1');
    const events = b.build();
    for (const e of [...events].reverse()) await store.append(e);
    expect((await store.pending()).map((e) => e.deviceSeq)).toEqual(events.map((e) => e.deviceSeq));
  });

  it('loads in fold order whatever order events were appended in', async () => {
    const store = makeStore();
    const events = new LogBuilder('s1').accept('p1').accept('p1').on('dev-B').accept('p1').build();
    for (const e of [...events].reverse()) await store.append(e);
    expect((await store.load('s1')).map((e) => e.id)).toEqual(events.map((e) => e.id));
  });

  it('marking synced tolerates nothing, unknown ids and repeats', async () => {
    const store = makeStore();
    const [e] = new LogBuilder().accept('p1').build();
    await store.append(e);
    await store.markSynced([]);
    await store.markSynced(['no-such-id', e.id]);
    await store.markSynced([e.id]);
    expect(await store.pending()).toEqual([]);
    expect(await store.load(e.saleId)).toHaveLength(1);
  });
});

describe.each(adapters)('%s — insertPulled (E01-S09)', (_name, makeStore) => {
  it('stores another device\'s event verbatim, already synced, without touching this device\'s counter', async () => {
    const store = makeStore();
    const before = await store.device();
    const [e] = new LogBuilder('s1', 'dev-other').accept('p1').build();
    await store.insertPulled(e);
    expect(await store.load('s1')).toEqual([e]);
    expect(await store.pending()).toEqual([]);
    expect(await store.device()).toEqual(before);
  });

  it('is idempotent: pulling the same event twice keeps one copy', async () => {
    const store = makeStore();
    const [e] = new LogBuilder('s1', 'dev-other').accept('p1').build();
    await store.insertPulled(e);
    await store.insertPulled(Object.fromEntries(Object.entries(e).reverse()) as typeof e);
    expect(await store.load('s1')).toHaveLength(1);
  });

  it('refuses the same id with different content, keeping what is stored', async () => {
    const store = makeStore();
    const [e] = new LogBuilder('s1', 'dev-other').accept('p1').build() as AcceptEvent[];
    await store.insertPulled(e);
    await expect(store.insertPulled({ ...e, netG: 1 })).rejects.toBeInstanceOf(IntegrityError);
    expect((await store.load('s1'))[0]).toEqual(e);
  });

  // The server has it, so the ack was only lost: the outbox can let it go.
  it('pulling back an own event still in the outbox marks it synced', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const [e] = new LogBuilder('s1', deviceId).accept('p1').build();
    await store.append(e);
    await store.insertPulled(e);
    expect(await store.pending()).toEqual([]);
    expect(await store.load('s1')).toHaveLength(1);
  });

  it('never renumbers a pulled event carrying this device\'s id (cloned install)', async () => {
    const store = makeStore();
    const { deviceId } = await store.device();
    const [a, b] = new LogBuilder('s1', deviceId).accept('p1').accept('p1').build();
    await store.append(a);
    const clash = { ...b, deviceSeq: a.deviceSeq };
    await store.insertPulled(clash);
    expect((await store.load('s1')).find((e) => e.id === b.id)).toEqual(clash);
  });
});

describe.each(adapters)('%s — sync cursor (E01-S09)', (_name, makeStore) => {
  it('starts at 0 and keeps what it is given', async () => {
    const store = makeStore();
    expect(await store.syncCursor('g1')).toBe(0);
    await store.setSyncCursor('g1', 1_234);
    expect(await store.syncCursor('g1')).toBe(1_234);
  });

  it('is only right for the group it was stored for: another group starts from 0 (no silent skipping)', async () => {
    const store = makeStore();
    await store.setSyncCursor('g1', 1_234);
    expect(await store.syncCursor('g2')).toBe(0);
    await store.setSyncCursor('g2', 99);
    expect(await store.syncCursor('g2')).toBe(99);
    expect(await store.syncCursor('g1')).toBe(0); // one slot: the newer group replaced it, a re-download is safe
  });
});

describe('IndexedDbStore — what only a persistent store must do', () => {
  it('a reopened store resumes the device and its sequence (force-close, NFR-2)', async () => {
    const factory = new IDBFactory();
    const first = new IndexedDbStore(factory);
    const { deviceId } = await first.device();
    for (const e of new LogBuilder('s1', deviceId).accept('p1').accept('p1').build()) await first.append(e);

    await first.markSynced([(await first.load('s1'))[0].id]);

    const reopened = new IndexedDbStore(factory);
    expect(await reopened.device()).toEqual({ deviceId, nextDeviceSeq: 3 });
    expect(await reopened.load('s1')).toHaveLength(2);
    expect(await reopened.pending()).toHaveLength(1); // synced state survived too
  });

  it('a reopened store resumes pulling where it stopped, not from the start', async () => {
    const factory = new IDBFactory();
    await new IndexedDbStore(factory).setSyncCursor('g1', 42);
    expect(await new IndexedDbStore(factory).syncCursor('g1')).toBe(42);
  });

  it('a cursor stored before it was scoped to a group (a bare number) reads as 0: one safe re-download', async () => {
    const factory = new IDBFactory();
    const store = new IndexedDbStore(factory);
    await store.device();
    const db = await openDb(factory);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(42, 'syncCursor');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    expect(await new IndexedDbStore(factory).syncCursor('g1')).toBe(0);
  });
});
