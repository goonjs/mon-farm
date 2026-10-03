/**
 * One device-sequence allocator for the whole app (E01-S02).
 *
 * The store has the final word (it allocates this device's numbers inside
 * the append transaction, see append-rule.ts), but one counter per app keeps
 * its proposals right first time, so within one tab the stored numbers follow
 * recording order. A counter per `SaleProvider` would fall behind as soon as
 * two are mounted — settlement links back to the sale list while the sale's
 * provider stays on the stack. Other browser tabs have their own counter;
 * the store renumbers their collisions.
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
