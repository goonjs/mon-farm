/**
 * One device-sequence allocator for the whole app (E01-S02).
 *
 * The store enforces a single high-water mark per install, so the numbers
 * must be handed out by one counter too. A counter per `SaleProvider` breaks
 * as soon as two are mounted — settlement links back to the sale list while
 * the sale's provider stays on the stack — and the stale one then stamps
 * numbers the store already used, which it rightly refuses.
 */

import type { DeviceId } from '../core/types';
import type { EventStore } from './store';

export interface DeviceClock {
  /** Reads the device id and next number from the store, once. */
  load(): Promise<DeviceId>;
  /** The next device sequence number. Only valid after `load()` resolves. */
  take(): number;
}

export function createDeviceClock(store: EventStore): DeviceClock {
  let loading: Promise<DeviceId> | null = null;
  let next: number | null = null;
  return {
    load() {
      loading ??= store.device().then((d) => {
        next = d.nextDeviceSeq;
        return d.deviceId;
      });
      return loading;
    },
    take() {
      if (next === null) throw new Error('Device clock used before load().');
      return next++;
    },
  };
}
