import type { CreateGroupOp } from '../core/group';
import type { EventId, GroupId, SaleEvent, UserId } from '../core/types';
import {
  RemoteError,
  type PullToken,
  type PulledDoc,
  type PulledPage,
  type RemoteErrorCode,
  type RemoteEvents,
  type RemoteGroups,
} from './remote';

/**
 * An in-memory backend with Firestore's create-only rules, shared by any
 * number of clients. Tests and the e2e harness only.
 */
export class FakeServer {
  readonly docs = new Map<EventId, PulledDoc>();
  /** Server clock for `receivedAt`; tests move it. */
  now = 1_000_000;
  /** Groups created through `createGroup`, with their creator. */
  readonly groups = new Map<GroupId, UserId>();
  /**
   * Like the rules: an event of a group nobody created is refused. Off by
   * default so tests that are not about groups need not create one.
   */
  requireGroups = false;
}

export class FakeRemote implements RemoteEvents, RemoteGroups {
  /** Every batch `push` received, accepted or not. */
  readonly batches: SaleEvent[][] = [];
  /** Server reads made by `check()`: they never queue a write. */
  checks = 0;
  /** `createGroup` and `push` calls in the order they arrived, for ordering tests. */
  readonly calls: string[] = [];
  /** Highest number of pushes in flight at once. */
  maxInFlight = 0;
  private inFlight = 0;
  private failures: RemoteErrorCode[] = [];
  private loseAcks = 0;
  offline = false;
  /** A batch holding any of these is refused as invalid (a malformed or oversized document). */
  readonly invalidIds = new Set<EventId>();
  /** The rules refuse every write from this client and it cannot read the group (e.g. no longer a member). */
  denied = false;
  /** A batch holding any of these is refused as `permission-denied` although the client is a member (malformed event). */
  readonly rulesRejectIds = new Set<EventId>();

  constructor(readonly server = new FakeServer()) {}

  /** The next `push`/`pull` calls fail with these codes, one each. */
  failNext(...codes: RemoteErrorCode[]): void {
    this.failures.push(...codes);
  }

  /** The next push is committed on the server but its ack never arrives. */
  loseNextAck(): void {
    this.loseAcks += 1;
  }

  private gate(): void {
    if (this.offline) throw new RemoteError('unavailable', 'offline');
    const code = this.failures.shift();
    if (code) throw new RemoteError(code);
  }

  async check(): Promise<boolean> {
    this.checks += 1;
    if (this.offline) throw new RemoteError('unavailable', 'offline');
    return !this.denied;
  }

  async createGroup(op: CreateGroupOp): Promise<void> {
    this.calls.push(`group:${op.groupId}`);
    await Promise.resolve();
    this.gate();
    if (this.denied) throw new RemoteError('permission-denied');
    const creator = this.server.groups.get(op.groupId);
    if (creator === undefined) this.server.groups.set(op.groupId, op.createdBy);
    else if (creator !== op.createdBy) throw new RemoteError('permission-denied');
  }

  async push(events: readonly SaleEvent[]): Promise<void> {
    this.calls.push('push');
    this.batches.push([...events]);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await Promise.resolve();
      this.gate();
      if (this.denied) throw new RemoteError('permission-denied');
      if (events.some((e) => this.invalidIds.has(e.id))) throw new RemoteError('invalid-argument');
      if (events.some((e) => this.rulesRejectIds.has(e.id))) throw new RemoteError('permission-denied');
      if (this.server.requireGroups && events.some((e) => !this.server.groups.has(e.groupId))) {
        throw new RemoteError('permission-denied');
      }
      // A batch is atomic, and rules refuse any write to an existing id.
      if (events.some((e) => this.server.docs.has(e.id))) throw new RemoteError('permission-denied');
      for (const e of events) {
        this.server.now += 1;
        this.server.docs.set(e.id, { event: structuredClone(e), receivedAt: this.server.now });
      }
      if (this.loseAcks > 0) {
        this.loseAcks -= 1;
        throw new RemoteError('deadline-exceeded', 'ack lost');
      }
    } finally {
      this.inFlight -= 1;
    }
  }

  async fetch(id: EventId): Promise<SaleEvent | null> {
    this.gate();
    return this.server.docs.get(id)?.event ?? null;
  }

  async pull(since: number, after?: PullToken, limit = Infinity): Promise<PulledPage> {
    this.gate();
    const last = after as readonly [number, string] | undefined;
    const sorted = [...this.server.docs.values()]
      .filter((d) => d.receivedAt !== null && d.receivedAt >= since)
      .sort((a, b) => a.receivedAt! - b.receivedAt! || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0));
    const rest = last
      ? sorted.filter((d) => d.receivedAt! > last[0] || (d.receivedAt === last[0] && d.event.id > last[1]))
      : sorted;
    const docs = rest.slice(0, limit);
    const tail = docs[docs.length - 1];
    return { docs, next: rest.length > docs.length ? ([tail.receivedAt!, tail.event.id] as const) : null };
  }
}
