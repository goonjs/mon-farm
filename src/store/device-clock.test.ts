import { describe, expect, it } from 'vitest';

import type { AcceptEvent } from '../core/types';
import { createDeviceClock } from './device-clock';
import { MemoryStore } from './store';

describe('device clock — one counter for every screen (E01-S02 AC3)', () => {
  it('two sales recording in turn get numbers the store accepts', async () => {
    const store = new MemoryStore();
    const clock = createDeviceClock(store);
    const deviceId = await clock.load();
    await clock.load(); // a second provider mounting reads the same clock

    const basket = (saleId: string, seq: number): AcceptEvent => ({
      id: `${saleId}-${seq}`,
      groupId: 'group-1',
      saleId,
      seq,
      deviceSeq: clock.take(),
      ts: 0,
      mono: 0,
      actor: { userId: 'u', deviceId },
      source: 'app',
      kind: 'accept',
      pileId: 'p1',
      input: 'hold',
      netG: 50_000,
      tareG: 2_000,
    });

    // Sale A, then sale B, then back to A — A's provider never remounted.
    for (const e of [basket('A', 1), basket('B', 1), basket('A', 2), basket('B', 2)]) {
      await store.append(e);
    }
    expect(await store.pending()).toHaveLength(4);
    expect((await store.device()).nextDeviceSeq).toBe(5);
  });

  it('refuses to hand out a number before it knows where the store is', () => {
    expect(() => createDeviceClock(new MemoryStore()).take()).toThrow(/before load/);
  });
});
