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
 * The append rule every adapter shares. Returns the device state to persist
 * with the insert, or null when the event is already stored (the idempotent
 * no-op); throws `IntegrityError` when the append would rewrite history.
 *
 * "Already used" for this device's own sequence means anything below the
 * persisted high-water mark, which is written in the same transaction as the
 * event, so no stored number can be handed out again after a force-close
 * (NFR-2). A number whose event never reached storage may be reused — no
 * event ever carried it.
 * Events from other devices are not checked: two installs restored from one
 * backup can share a device id, and refusing their events would wedge sync
 * (architecture §Schema — native).
 */
export function checkAppend(
  event: SaleEvent,
  existing: SaleEvent | undefined,
  device: DeviceState,
): DeviceState | null {
  if (existing) {
    if (canonicalJson(existing) === canonicalJson(event)) return null;
    throw new IntegrityError(`Event ${event.id} already exists with different content.`);
  }
  if (event.actor.deviceId !== device.deviceId) return device;
  if (event.deviceSeq < device.nextDeviceSeq) {
    throw new IntegrityError(`Device sequence ${event.deviceSeq} was already used on this device.`);
  }
  return { ...device, nextDeviceSeq: event.deviceSeq + 1 };
}
