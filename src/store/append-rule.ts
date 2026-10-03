/**
 * The append rule, shared by every `EventStore` adapter. Its own unsuffixed
 * file for the same reason as ./errors: `store.web.ts` importing from
 * `./store` would resolve to itself on web.
 */

import { canonicalJson } from '../core/canonical';
import type { DeviceId, SaleEvent } from '../core/types';
import { IntegrityError } from './errors';

/** This install's identity and the next sequence number it will use. */
export interface DeviceState {
  readonly deviceId: DeviceId;
  readonly nextDeviceSeq: number;
}

/**
 * The append rule every adapter shares. Returns what to store — the event
 * and the device state to persist with it in the same transaction — or null
 * when the event is already stored (the idempotent no-op). Throws
 * `IntegrityError` when the append would rewrite history.
 *
 * This device's own sequence numbers are ALLOCATED here, inside the store's
 * transaction, not trusted from the caller: the number the caller proposes is
 * kept when it is free (always, with one writer), and otherwise the event gets
 * the next free one. Two browser tabs each keep their own counter in memory;
 * IndexedDB serialises their transactions, so this is what turns "two tabs
 * collide" into "both tabs' events are stored, numbered in commit order"
 * rather than one being refused (NFR-2). The high-water mark is written with
 * the event, so no stored number is ever handed out again, even across a
 * force-close.
 *
 * Events from other devices are stored as they are: two installs restored
 * from one backup can share a device id, and refusing their events would
 * wedge sync (architecture §Schema — native).
 *
 * LOCAL APPENDS ONLY. Pulled events (E01-S09 `insertPulled`) must be stored
 * verbatim, never renumbered — a pulled event carrying this device's id
 * (a cloned install) would otherwise drift from the server copy.
 */
export function checkAppend(
  event: SaleEvent,
  existing: SaleEvent | undefined,
  device: DeviceState,
): { event: SaleEvent; device: DeviceState } | null {
  const own = event.actor.deviceId === device.deviceId;
  if (existing) {
    // An own event may have been renumbered on its way in; its number is the
    // store's to decide, so it is not part of "same content".
    const comparable = (e: SaleEvent) => canonicalJson(own ? { ...e, deviceSeq: 0 } : e);
    if (comparable(existing) === comparable(event)) return null;
    throw new IntegrityError(`Event ${event.id} already exists with different content.`);
  }
  if (!own) return { event, device };
  const deviceSeq = Math.max(event.deviceSeq, device.nextDeviceSeq);
  if (deviceSeq !== event.deviceSeq) {
    // Expected with two tabs open; anywhere else it means appends committed
    // out of order, which deserves a trace.
    console.warn(`Device sequence ${event.deviceSeq} already used; stored as ${deviceSeq}.`);
  }
  return {
    event: deviceSeq === event.deviceSeq ? event : { ...event, deviceSeq },
    device: { ...device, nextDeviceSeq: deviceSeq + 1 },
  };
}
