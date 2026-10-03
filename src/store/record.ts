/**
 * Writing an event from outside a sale's own screens (E01-S04): the sale
 * list deletes a sale, the "deleted" screen restores one. Same stamping as
 * `SaleProvider` — one device clock for the whole app, see device-clock.ts.
 */

import type { Actor, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import { createDeviceClock } from './device-clock';
import { PRE_LOGIN_USER_ID } from './session';
import { store } from './store';

/** Shared by every writer — see device-clock.ts for why it cannot be per sale. */
export const deviceClock = createDeviceClock(store);

/** The envelope fields every event carries, for one event at per-sale position `seq`. */
export function stamp(saleId: string, seq: number, actor: Actor) {
  return {
    id: uuidv7(),
    saleId,
    seq,
    deviceSeq: deviceClock.take(),
    ts: Date.now(),
    // Monotonic, for interval evidence (FR-12.4) — see SaleProvider.
    mono: Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now()),
    actor,
    source: 'app' as const,
  };
}

/** The next per-sale position, as this device sees the log. */
export function nextSeq(events: readonly SaleEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}

export async function actorNow(): Promise<Actor> {
  return { userId: PRE_LOGIN_USER_ID, deviceId: await deviceClock.load() };
}

/** Soft-deletes or restores a record of `saleId` (the sale itself by default). */
export async function setDeleted(saleId: string, deleted: boolean, targetId = saleId): Promise<void> {
  const actor = await actorNow();
  const events = await store.load(saleId);
  await store.append({
    ...stamp(saleId, nextSeq(events), actor),
    kind: deleted ? 'delete' : 'restore',
    targetId,
  });
}
