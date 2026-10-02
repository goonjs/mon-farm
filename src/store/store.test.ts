import { describe, expect, it } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import type { AcceptEvent } from '../core/types';
import { IntegrityError, MemoryStore } from './store';

const UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('MemoryStore — EventStore rules (E01-S02 AC2, AC3)', () => {
  it('re-appending the same id with the same content is a no-op (idempotent for sync)', async () => {
    const store = new MemoryStore();
    const [e] = new LogBuilder().accept('p1').build();
    await store.append(e);
    // Same content, keys in another order — as a pulled copy would arrive.
    const reordered = Object.fromEntries(Object.entries(e).reverse()) as typeof e;
    await store.append(reordered);
    expect(await store.load(e.saleId)).toHaveLength(1);
  });

  it('rejects the same id with different content, never overwriting', async () => {
    const store = new MemoryStore();
    const [e] = new LogBuilder().accept('p1').build() as AcceptEvent[];
    await store.append(e);
    await expect(store.append({ ...e, netG: 1 })).rejects.toBeInstanceOf(IntegrityError);
    expect((await store.load(e.saleId))[0]).toEqual(e);
  });

  it('mints one UUIDv7 device id per install and starts its sequence at 1', async () => {
    const store = new MemoryStore();
    const a = await store.device();
    const b = await store.device();
    expect(a.deviceId).toMatch(UUIDV7);
    expect(b.deviceId).toBe(a.deviceId);
    expect(a.nextDeviceSeq).toBe(1);
  });

  it('advances the device sequence past every event this device has stored', async () => {
    const store = new MemoryStore();
    const { deviceId } = await store.device();
    const events = new LogBuilder('s1', deviceId).accept('p1').accept('p1').build();
    for (const e of events) await store.append(e);
    expect((await store.device()).nextDeviceSeq).toBe(3);
  });

  it('rejects a second event claiming a device sequence this device already used', async () => {
    const store = new MemoryStore();
    const { deviceId } = await store.device();
    const [first] = new LogBuilder('s1', deviceId).accept('p1').build();
    const [clash] = new LogBuilder('s2', deviceId).accept('p1').build();
    await store.append(first);
    await expect(store.append(clash)).rejects.toBeInstanceOf(IntegrityError);
  });

  it('lists pending events in device order and clears them by id', async () => {
    const store = new MemoryStore();
    const events = new LogBuilder().accept('p1').accept('p1').accept('p1').build();
    for (const e of [...events].reverse()) await store.append(e);
    expect((await store.pending()).map((e) => e.id)).toEqual(events.map((e) => e.id));

    await store.markSynced([events[0].id]);
    expect((await store.pending()).map((e) => e.id)).toEqual([events[1].id, events[2].id]);
  });
});
