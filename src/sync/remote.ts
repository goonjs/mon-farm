/**
 * The port the sync engine talks to the backend through (architecture §Sync
 * engine). Firestore sits behind it in the app; tests use `FakeRemote`.
 *
 * The backend is create-only: an event document is never updated, so writing
 * an id that already exists is refused (`permission-denied`, as the rules
 * `update: false` make Firestore do), whatever its content.
 */

import type { CreateGroupOp } from '../core/group';
import type { EventId, SaleEvent } from '../core/types';

export type RemoteErrorCode =
  | 'unavailable'
  | 'deadline-exceeded'
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'internal';

export class RemoteError extends Error {
  constructor(
    readonly code: RemoteErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

/** Worth retrying on its own: the network or the session, not the data. */
export const isTransient = (code: RemoteErrorCode) =>
  code === 'unavailable' || code === 'deadline-exceeded' || code === 'unauthenticated' || code === 'internal';

/** One event as the server holds it. `receivedAt` is null until the server stamps it. */
export interface PulledDoc {
  readonly event: SaleEvent;
  readonly receivedAt: number | null;
}

export interface RemoteEvents {
  /** Creates up to 500 events as one batch; resolves once the server confirmed all of them. */
  push(events: readonly SaleEvent[]): Promise<void>;
  /** The server's copy of one event, or null — never answered from a cache. */
  fetch(id: EventId): Promise<SaleEvent | null>;
  /** Every event with `receivedAt >= since`, ordered by `receivedAt`. */
  pull(since: number): Promise<PulledDoc[]>;
}

/**
 * Server writes that are not events: the batch that creates a group and its
 * creator's membership (architecture §การดำเนินการด้านสมาชิกภาพ). Sent before
 * that group's first event, because the rules only let members write events.
 */
export interface RemoteGroups {
  /**
   * Creates the group doc and the creator's owner member doc as one batch.
   * Idempotent: a group the same user already created counts as done (an ack
   * lost on the way). Another user's group, or a refusal, is `permission-denied`.
   */
  createGroup(op: CreateGroupOp): Promise<void>;
}
