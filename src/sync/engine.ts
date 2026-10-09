/**
 * The sync engine (E01-S09; architecture §Sync engine).
 *
 * The local store owns durability; the backend is where phones meet. Push
 * sends the outbox as create-only documents and marks events synced only once
 * the server confirmed them. Pull stores other phones' events verbatim and
 * idempotently. Both are safe to repeat, which is what makes a force-close at
 * any point harmless (NFR-2).
 *
 * Errors come in two kinds. Transient ones (network, timeout, session) retry
 * on their own with backoff and show as Pending Sync — being offline is the
 * normal case, not an error. Permanent ones (refused by the rules, integrity)
 * show as an error with a retry action and wait for it (D-3). Local data is
 * never changed by either.
 */

import { canonicalJson } from '../core/canonical';
import type { SaleEvent } from '../core/types';
import { IntegrityError } from '../store/errors';
import type { EventStore } from '../store/store';
import { isTransient, RemoteError, type PulledDoc, type RemoteEvents } from './remote';

/** Firestore's limit for one write batch. */
export const BATCH_SIZE = 500;
export const ACK_TIMEOUT_MS = 30_000;
/** Re-read window behind the cursor: server stamps need not follow commit order. */
export const PULL_OVERLAP_MS = 10 * 60_000;
export const APPEND_DEBOUNCE_MS = 2_000;

export function backoffMs(attempt: number, random: () => number = Math.random): number {
  return Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 10)) + Math.floor(random() * 1_000);
}

export type SyncState = 'synced' | 'pending' | 'error';
/** `denied`: the rules refused (e.g. no longer a member). `integrity`: one id, two contents. */
export type SyncError = 'denied' | 'integrity' | 'invalid';

export interface SyncStatus {
  readonly state: SyncState;
  /** Events still in this phone's outbox. */
  readonly pending: number;
  readonly error?: SyncError;
}

/** Where pull resumes: the newest `receivedAt` already stored. */
export interface CursorStore {
  get(): Promise<number>;
  set(value: number): Promise<void>;
}

export class MemoryCursor implements CursorStore {
  private value = 0;
  async get() {
    return this.value;
  }
  async set(value: number) {
    this.value = value;
  }
}

export type SyncStore = Pick<EventStore, 'pending' | 'markSynced' | 'insertPulled'>;

export interface SyncDeps {
  readonly store: SyncStore;
  readonly remote: RemoteEvents;
  readonly cursor: CursorStore;
  readonly random?: () => number;
}

class Permanent extends Error {
  constructor(readonly kind: SyncError) {
    super(kind);
  }
}

export class SyncEngine {
  private current: SyncStatus = { state: 'synced', pending: 0 };
  private listeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pokeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: SyncDeps) {}

  status(): SyncStatus {
    return this.current;
  }

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Push then pull. Safe to call from every trigger (launch, back online,
   * app active, after an append): a call while a run is going folds into
   * one follow-up run.
   */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.runOnce();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** The retry action: forget the backoff and sync now. */
  retry(): Promise<void> {
    this.attempt = 0;
    return this.sync();
  }

  /** A local append happened: sync soon, once, however many appends follow. */
  poke(): void {
    if (this.pokeTimer) clearTimeout(this.pokeTimer);
    this.pokeTimer = setTimeout(() => {
      this.pokeTimer = null;
      void this.sync();
    }, APPEND_DEBOUNCE_MS);
  }

  /** Documents from a realtime listener; same rules as a pull. */
  async ingest(docs: readonly PulledDoc[]): Promise<void> {
    const bad = await this.store(docs);
    if (bad) await this.settle({ kind: 'integrity' });
  }

  stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pokeTimer) clearTimeout(this.pokeTimer);
    this.retryTimer = this.pokeTimer = null;
  }

  private async runOnce(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    let pushError: SyncError | undefined;
    try {
      try {
        await this.push();
      } catch (err) {
        if (!(err instanceof Permanent)) throw err;
        pushError = err.kind; // still pull: others' events are worth having
      }
      const bad = await this.pull();
      this.attempt = 0;
      await this.settle(pushError ? { kind: pushError } : bad ? { kind: 'integrity' } : {});
    } catch (err) {
      if (err instanceof RemoteError && !isTransient(err.code)) {
        await this.settle({ kind: err.code === 'permission-denied' ? 'denied' : 'invalid' });
        return;
      }
      // Transient, or a local failure mid-run: nothing was lost, try again.
      const delay = backoffMs(this.attempt++, this.deps.random);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.sync();
      }, delay);
      await this.settle({ transient: true });
      if (!(err instanceof RemoteError)) throw err;
    }
  }

  private async push(): Promise<void> {
    const outbox = await this.deps.store.pending();
    for (let i = 0; i < outbox.length; i += BATCH_SIZE) {
      const batch = outbox.slice(i, i + BATCH_SIZE);
      try {
        await withTimeout(this.deps.remote.push(batch), ACK_TIMEOUT_MS);
      } catch (err) {
        if (!(err instanceof RemoteError) || err.code !== 'permission-denied') throw err;
        await this.checkEach(batch);
      }
      await this.deps.store.markSynced(batch.map((e) => e.id));
    }
  }

  /**
   * A refused batch is not yet an error: an earlier ack may have been lost,
   * so the server could already hold some of it. Each event is sent alone;
   * one the server holds with the same content counts as sent.
   */
  private async checkEach(batch: readonly SaleEvent[]): Promise<void> {
    for (const e of batch) {
      try {
        await withTimeout(this.deps.remote.push([e]), ACK_TIMEOUT_MS);
        continue;
      } catch (err) {
        if (!(err instanceof RemoteError) || err.code !== 'permission-denied') throw err;
      }
      const there = await this.deps.remote.fetch(e.id);
      if (!there) throw new Permanent('denied');
      if (canonicalJson(there) !== canonicalJson(e)) throw new Permanent('integrity');
    }
  }

  private async pull(): Promise<boolean> {
    const cursor = await this.deps.cursor.get();
    const docs = await this.deps.remote.pull(cursor > 0 ? cursor - PULL_OVERLAP_MS : 0);
    return this.store(docs);
  }

  /** Stores docs and moves the cursor; true when some doc was skipped as corrupt. */
  private async store(docs: readonly PulledDoc[]): Promise<boolean> {
    let bad = false;
    let newest = await this.deps.cursor.get();
    for (const doc of docs) {
      if (doc.receivedAt === null) continue;
      try {
        await this.deps.store.insertPulled(doc.event);
      } catch (err) {
        if (!(err instanceof IntegrityError)) throw err;
        // One bad document must not stall the whole group: skip it, report it.
        bad = true;
      }
      newest = Math.max(newest, doc.receivedAt);
    }
    // Only after the local writes committed.
    await this.deps.cursor.set(newest);
    return bad;
  }

  private async settle(outcome: { kind?: SyncError; transient?: boolean }): Promise<void> {
    const pending = (await this.deps.store.pending()).length;
    const next: SyncStatus = outcome.kind
      ? { state: 'error', pending, error: outcome.kind }
      : { state: pending > 0 || outcome.transient ? 'pending' : 'synced', pending };
    if (canonicalJson(next) === canonicalJson(this.current)) return;
    this.current = next;
    for (const l of this.listeners) l(next);
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RemoteError('deadline-exceeded', 'no ack')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

