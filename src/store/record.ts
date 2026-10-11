/**
 * Writing an event from outside a sale's own screens (E01-S04): the sale
 * list deletes a sale, the "deleted" screen restores one. Same stamping as
 * `SaleProvider` — one device clock for the whole app, see device-clock.ts.
 */

import { requireGroupId } from '../core/scope';
import type { Actor, GroupId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import { createDeviceClock } from './device-clock';
import { sessionGroupId, sessionUserId } from './session';
import { store } from './store';

/** Shared by every writer — see device-clock.ts for why it cannot be per sale. */
export const deviceClock = createDeviceClock(store);

/** Who is writing, and into which farm group (E02-S01/S02). */
export interface Writer {
  readonly actor: Actor;
  readonly groupId: GroupId;
}

/** The envelope fields every event carries, for one event at per-sale position `seq`. */
export function stamp(saleId: string, seq: number, writer: Writer) {
  return {
    id: uuidv7(),
    groupId: requireGroupId(writer.groupId),
    saleId,
    seq,
    deviceSeq: deviceClock.take(),
    ts: Date.now(),
    // Monotonic, for interval evidence (FR-12.4) — see SaleProvider.
    mono: Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now()),
    actor: writer.actor,
    source: 'app' as const,
  };
}

/** The next per-sale position, as this device sees the log. */
export function nextSeq(events: readonly SaleEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}

/**
 * The signed-in user in the open group (option A: one session-level group,
 * stamped here and nowhere else). Throws `NotSignedInError` before sign-in
 * (E02-S01) and `NoGroupError` before a group is open (E02-S02).
 */
export async function writerNow(): Promise<Writer> {
  const userId = sessionUserId();
  const groupId = sessionGroupId();
  return { actor: { userId, deviceId: await deviceClock.load() }, groupId };
}

/** Soft-deletes or restores a record of `saleId` (the sale itself by default). */
export async function setDeleted(saleId: string, deleted: boolean, targetId = saleId): Promise<void> {
  const writer = await writerNow();
  const events = await store.load(saleId);
  await store.append({
    ...stamp(saleId, nextSeq(events), writer),
    kind: deleted ? 'delete' : 'restore',
    targetId,
  });
}
