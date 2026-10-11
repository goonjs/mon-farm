/**
 * The Firestore side of the `RemoteEvents` / `RemoteGroups` ports (E01-S09).
 *
 * Everything that is a decision lives here and imports no Firebase code, so
 * Vitest checks it against a fake `FirestoreLayer`: how a local event becomes
 * the envelope `firestore.rules` demands (and back, losslessly), which
 * Firestore error means "try later" and which means "stop and tell the user",
 * and why re-sending is safe. The Firebase SDK is behind the layer
 * (`firestore-sdk.ts`) and is proven against the emulator.
 *
 * One remote serves one group: documents live at `groups/{gid}/events/{id}`.
 */

import { createGroupWrites, type CreateGroupOp } from '../core/group';
import type { EventId, GroupId, SaleEvent, UserId } from '../core/types';
import {
  RemoteError,
  type PullToken,
  type PulledPage,
  type RemoteErrorCode,
  type RemoteEvents,
  type RemoteGroups,
} from './remote';

/** In a write's data, "let the server stamp this" (`serverTimestamp()` in the SDK layer). */
export const SERVER_TIMESTAMP = Symbol('serverTimestamp');

export interface DocWrite {
  /** Full document path, e.g. `groups/g1/events/<id>`. */
  readonly path: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * The few Firestore operations the remote needs. Reads are always answered by
 * the server, never a cache (architecture §Sync engine: our store owns
 * durability, not the SDK). Timestamps come back as epoch milliseconds, or
 * null when the server has not stamped the document yet.
 */
export interface FirestoreLayer {
  /** One atomic batch of creates; resolves when the server confirmed it. */
  commit(writes: readonly DocWrite[]): Promise<void>;
  get(path: string): Promise<Readonly<Record<string, unknown>> | null>;
  /**
   * Documents of `groups/{groupId}/events` with `receivedAt >= sinceMs`, ordered by `receivedAt` (then id),
   * at most `limit`, after the position `after`. `next` is the position after the last document, or null when
   * there is no more.
   */
  eventsSince(
    groupId: GroupId,
    sinceMs: number,
    after?: PullToken,
    limit?: number,
  ): Promise<{ readonly docs: readonly Readonly<Record<string, unknown>>[]; readonly next: PullToken | null }>;
}

// ── event ⇄ envelope ───────────────────────────────────────────────────────

/** The fields the envelope names itself; everything else of a local event goes in `payload`. */
const ENVELOPE_KEYS = [
  'id',
  'groupId',
  'actor',
  'deviceSeq',
  'kind',
  'targetId',
  'baseEventId',
  'alsoBasedOn',
  'saleId',
  'source',
  'ts',
  'mono',
] as const;

/** Firestore refuses `undefined`; JSON also drops it, which is what canonical JSON ignores. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * A local event as the document the rules accept (architecture §Event
 * envelope). The event's own fields that are not envelope fields (`seq`,
 * `netG`, a sys event's own `payload`, …) go whole into `payload`, so nothing
 * is renamed or lost. An event with no `targetId` of its own targets itself,
 * as a create does.
 */
export function toEnvelope(event: SaleEvent): Record<string, unknown> {
  const e = event as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = { ...e };
  for (const key of ENVELOPE_KEYS) delete payload[key];
  const doc: Record<string, unknown> = {
    schema: 1,
    id: e.id,
    groupId: e.groupId,
    actor: e.actor,
    deviceSeq: e.deviceSeq,
    kind: e.kind,
    targetId: e.targetId ?? e.id,
    baseEventId: e.baseEventId ?? null,
    saleId: e.saleId ?? null,
    source: e.source,
    ts: e.ts,
    payload,
    receivedAt: SERVER_TIMESTAMP,
  };
  if (e.mono !== undefined) doc.mono = e.mono;
  if (e.alsoBasedOn !== undefined) doc.alsoBasedOn = e.alsoBasedOn;
  const { receivedAt, ...rest } = doc;
  return { ...clean(rest), receivedAt };
}

export class MalformedDocError extends Error {
  constructor(readonly id: string) {
    super(`Event document ${id} is not a valid envelope.`);
    this.name = 'MalformedDocError';
  }
}

/** The inverse of `toEnvelope`: the local event, exactly as it was sent. */
export function fromEnvelope(data: Readonly<Record<string, unknown>>): SaleEvent {
  const { id, payload, targetId, baseEventId, alsoBasedOn, saleId, mono } = data;
  if (
    typeof id !== 'string' ||
    data.schema !== 1 ||
    typeof data.groupId !== 'string' ||
    typeof data.kind !== 'string' ||
    typeof data.deviceSeq !== 'number' ||
    typeof data.ts !== 'number' ||
    typeof data.actor !== 'object' ||
    data.actor === null ||
    typeof payload !== 'object' ||
    payload === null
  ) {
    throw new MalformedDocError(typeof id === 'string' ? id : '?');
  }
  const event: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
    id,
    groupId: data.groupId,
    actor: data.actor,
    deviceSeq: data.deviceSeq,
    kind: data.kind,
    source: data.source,
    ts: data.ts,
  };
  if (saleId !== null && saleId !== undefined) event.saleId = saleId;
  if (mono !== undefined) event.mono = mono;
  if (typeof targetId === 'string' && targetId !== id) event.targetId = targetId;
  if (baseEventId !== null && baseEventId !== undefined) event.baseEventId = baseEventId;
  if (alsoBasedOn !== undefined) event.alsoBasedOn = alsoBasedOn;
  return event as unknown as SaleEvent;
}

// ── errors ─────────────────────────────────────────────────────────────────

/**
 * Firestore's error codes onto the engine's. Transient ones retry on their own;
 * the rest stop and wait for the person (`isTransient`).
 *
 * - `already-exists`: the id is taken; for a create-only collection that is a
 *   refusal, handled like `permission-denied` (the engine then compares).
 * - A query without its index, a missing database and the like cannot fix
 *   themselves: `invalid-argument`, shown as an error with a retry.
 * - Everything else the server may say (`resource-exhausted`, `aborted`,
 *   `cancelled`, `unknown`, …) is worth trying again later: `internal`.
 */
export function remoteErrorCode(code: unknown): RemoteErrorCode {
  switch (code) {
    case 'unavailable':
    case 'deadline-exceeded':
    case 'unauthenticated':
    case 'permission-denied':
    case 'invalid-argument':
    case 'internal':
      return code;
    case 'already-exists':
      return 'permission-denied';
    case 'failed-precondition':
    case 'not-found':
    case 'out-of-range':
    case 'unimplemented':
      return 'invalid-argument';
    default:
      return 'internal';
  }
}

/** Anything the SDK throws, as a `RemoteError`; ours pass through. */
export function toRemoteError(err: unknown): RemoteError {
  if (err instanceof RemoteError) return err;
  const code = (err as { code?: unknown } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  // A bare network failure carries no Firestore code: it is just "offline".
  if (typeof code !== 'string') return new RemoteError(err instanceof TypeError ? 'unavailable' : 'internal', message);
  // The SDK prefixes its codes with `firestore/` in some paths.
  return new RemoteError(remoteErrorCode(code.replace(/^firestore\//, '')), message);
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    throw toRemoteError(err);
  }
}

/**
 * Only talk to the server as the user this device has signed in. The SDK may
 * have no session (a first launch offline-restored from our own store, a token
 * the browser dropped): requests would then go out unauthenticated and the
 * rules would answer `permission-denied`, which reads as "you are not allowed"
 * and stops the engine. It is the session that is missing, and that mends
 * itself, so say `unauthenticated` (transient) instead.
 */
export function whenSignedInAs(
  layer: FirestoreLayer,
  currentUid: () => Promise<string | null>,
  userId: UserId,
): FirestoreLayer {
  const check = async () => {
    if ((await currentUid()) !== userId) throw new RemoteError('unauthenticated', 'no Firebase session for this user');
  };
  return {
    async commit(writes) {
      await check();
      return layer.commit(writes);
    },
    async get(path) {
      await check();
      return layer.get(path);
    },
    async eventsSince(groupId, sinceMs, after, limit) {
      await check();
      return layer.eventsSince(groupId, sinceMs, after, limit);
    },
  };
}

// ── the remote ─────────────────────────────────────────────────────────────

export class FirestoreRemote implements RemoteEvents, RemoteGroups {
  constructor(
    private readonly layer: FirestoreLayer,
    private readonly groupId: GroupId,
    /** The signed-in uid; only used to recognise a group this user already created. */
    private readonly userId: UserId,
  ) {}

  private path(id: EventId): string {
    return `groups/${this.groupId}/events/${id}`;
  }

  async push(events: readonly SaleEvent[]): Promise<void> {
    // The rules would refuse these anyway; failing here says why and costs nothing.
    for (const e of events) {
      if (e.groupId !== this.groupId) throw new RemoteError('invalid-argument', `event ${e.id} is not in group ${this.groupId}`);
    }
    await guarded(() => this.layer.commit(events.map((e) => ({ path: this.path(e.id), data: toEnvelope(e) }))));
  }

  async fetch(id: EventId): Promise<SaleEvent | null> {
    const data = await guarded(() => this.layer.get(this.path(id)));
    return data ? fromEnvelope(data) : null;
  }

  async check(): Promise<void> {
    try {
      await guarded(() => this.layer.get(`groups/${this.groupId}`));
    } catch (err) {
      // Not (yet) allowed to read the group is an answer from the server, which is all this asks.
      if (err instanceof RemoteError && err.code === 'permission-denied') return;
      throw err;
    }
  }

  async pull(since: number, after?: PullToken, limit?: number): Promise<PulledPage> {
    const page = await guarded(() => this.layer.eventsSince(this.groupId, since, after, limit));
    const out: PulledPage['docs'] = [];
    for (const data of page.docs) {
      try {
        const receivedAt = typeof data.receivedAt === 'number' ? data.receivedAt : null;
        out.push({ event: fromEnvelope(data), receivedAt });
      } catch (err) {
        // One bad document must not stall the whole group (architecture §Pull).
        if (!(err instanceof MalformedDocError)) throw err;
        console.warn(err.message);
      }
    }
    return { docs: out, next: page.next };
  }

  /**
   * The group and the creator's own membership, as the one batch the rules
   * accept. If the batch is refused because the group is already there and
   * this user made it, an earlier attempt got through and its ack was lost:
   * that is success, not an error.
   */
  async createGroup(op: CreateGroupOp): Promise<void> {
    const { group, member } = createGroupWrites(op);
    try {
      await guarded(() => this.layer.commit([group, member]));
    } catch (err) {
      if (!(err instanceof RemoteError) || err.code !== 'permission-denied') throw err;
      const there = await guarded(() => this.layer.get(group.path));
      if (there && there.createdBy === this.userId) return;
      throw err;
    }
  }
}
