/**
 * The port the sync engine talks to the backend through (architecture §Sync
 * engine). Firestore sits behind it in the app; tests use `FakeRemote`.
 *
 * The backend is create-only: an event document is never updated, so writing
 * an id that already exists is refused (`permission-denied`, as the rules
 * `update: false` make Firestore do), whatever its content.
 */

import type { CreateGroupOp, Role } from '../core/group';
import type { EventId, GroupId, SaleEvent } from '../core/types';

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

/** Where the next page of a pull starts; opaque to the engine, only the adapter that issued it reads it. */
export type PullToken = unknown;

export interface PulledPage {
  readonly docs: PulledDoc[];
  /** Pass to `pull` for the next page; null when this was the last. */
  readonly next: PullToken | null;
}

export interface RemoteEvents {
  /**
   * Cheap read from the server, made before anything is sent: resolves when the
   * server answered. Fails fast with `unavailable` when offline (so no write is
   * queued behind the SDK's back) and with the real code when the database does
   * not exist. A refusal to read the group (not a member yet, rules) is not a
   * failure here: the operation that follows reports it. Resolves `true` when the
   * user can read the group, `false` when the rules refused that read — which is
   * how the engine tells "not a member" from "a member whose event was refused".
   */
  check(): Promise<boolean>;
  /** Creates up to 500 events as one batch; resolves once the server confirmed all of them. */
  push(events: readonly SaleEvent[]): Promise<void>;
  /** The server's copy of one event, or null — never answered from a cache. */
  fetch(id: EventId): Promise<SaleEvent | null>;
  /** Events with `receivedAt >= since`, ordered by `receivedAt`, at most `limit` per page. */
  pull(since: number, after?: PullToken, limit?: number): Promise<PulledPage>;
}

/** A farm group the signed-in user belongs to, as the server holds it. */
export interface RemoteGroupRef {
  readonly groupId: GroupId;
  readonly name: string;
  /** From the user's own member document; an unknown value reads as `member` (least privilege). */
  readonly role: Role;
}

/**
 * Which groups this user is in, asked of the server when the device knows
 * none (E02-S05, architecture §การดำเนินการด้านสมาชิกภาพ, "my groups"). It is
 * not tied to one group: it runs before any group is open.
 */
export interface RemoteMemberships {
  /**
   * The user's groups, oldest id first. An empty list is the server's answer
   * "none"; anything that stops it answering (offline, refused, no index) is a
   * `RemoteError` — never an empty list, because "none" lets a person create a
   * second group.
   */
  myGroups(): Promise<RemoteGroupRef[]>;
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
