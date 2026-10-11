/**
 * The points wizard and the first pull (E01-S09, decision 2026-10-10, review fix).
 *
 * Two phones that are offline and empty would otherwise each create "จุด 1".
 * Once this device has pulled the group's events it can see the other phone's
 * points and the wizard refuses the duplicate name. So while a first pull is
 * still expected the wizard waits for it.
 *
 * But the app is offline-first: a person must always be able to set up their
 * points. So the wait is bounded and never a trap. It ends as soon as
 *  - sync is not running here at all (nothing to wait for);
 *  - the first pull is done;
 *  - the group was created on this device and is not on the server yet: no other
 *    phone can be in it, so there is nobody to duplicate;
 *  - the device knows it is offline, or sync reports an error (rules, database,
 *    refusal), or `GRACE_MS` of trying has passed: the wizard then says plainly
 *    that sync is not available and lets the person go on, warning that a
 *    name another phone already used may repeat.
 */

import type { SyncMode } from './changed';

/** How long to keep trying before telling the person sync is not available. */
export const GRACE_MS = 20_000;

export type FirstPullGate =
  /** Create freely. */
  | { readonly kind: 'ready' }
  /** Online and trying: create is disabled for a moment. */
  | { readonly kind: 'waiting' }
  /** Cannot sync now: create is allowed, with a warning. */
  | { readonly kind: 'unavailable'; readonly reason: 'offline' | 'error' };

export interface GateInput {
  readonly mode: SyncMode;
  /** The store's pull cursor for the open group: 0 = never completed a pull. */
  readonly cursor: number;
  /** A `create_group` for the open group is still waiting to be sent: the group exists only here. */
  readonly groupOnlyHere: boolean;
  readonly online: boolean;
  /** The engine is in an error state (denied, database missing, invalid …). */
  readonly syncError: boolean;
  /** Milliseconds since sync started trying. */
  readonly elapsedMs: number;
}

export function firstPullGate(i: GateInput): FirstPullGate {
  if (i.mode === 'off') return { kind: 'ready' };
  // A stored cursor is a completed pull of this group, whether or not the engine is up yet.
  if (i.cursor > 0) return { kind: 'ready' };
  if (i.groupOnlyHere) return { kind: 'ready' };
  if (!i.online) return { kind: 'unavailable', reason: 'offline' };
  if (i.syncError || i.elapsedMs >= GRACE_MS) return { kind: 'unavailable', reason: 'error' };
  return { kind: 'waiting' };
}
