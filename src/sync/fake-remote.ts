import type { EventId, SaleEvent } from '../core/types';
import { RemoteError, type PulledDoc, type RemoteErrorCode, type RemoteEvents } from './remote';

/**
 * An in-memory backend with Firestore's create-only rules, shared by any
 * number of clients. Tests and the e2e harness only.
 */
export class FakeServer {
  readonly docs = new Map<EventId, PulledDoc>();
  /** Server clock for `receivedAt`; tests move it. */
  now = 1_000_000;
}

export class FakeRemote implements RemoteEvents {
  /** Every batch `push` received, accepted or not. */
  readonly batches: SaleEvent[][] = [];
  /** Highest number of pushes in flight at once. */
  maxInFlight = 0;
  private inFlight = 0;
  private failures: RemoteErrorCode[] = [];
  private loseAcks = 0;
  offline = false;
  /** The rules refuse every write from this client (e.g. no longer a member). */
  denied = false;

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

  async push(events: readonly SaleEvent[]): Promise<void> {
    this.batches.push([...events]);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await Promise.resolve();
      this.gate();
      if (this.denied) throw new RemoteError('permission-denied');
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

  async pull(since: number): Promise<PulledDoc[]> {
    this.gate();
    return [...this.server.docs.values()]
      .filter((d) => d.receivedAt !== null && d.receivedAt >= since)
      .sort((a, b) => a.receivedAt! - b.receivedAt!);
  }
}
