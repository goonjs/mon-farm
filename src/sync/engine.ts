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
import { hasGroup } from '../core/scope';
import type { EventId, SaleEvent } from '../core/types';
import { IntegrityError } from '../store/errors';
import type { EventStore } from '../store/store';
import { uploadMedia, type MediaQueue, type RemoteMedia } from './media';
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
  /** Events still in this phone's outbox, plus files not yet uploaded. */
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

/** The store's own cursor, so a restart resumes pulling instead of re-downloading the group. */
export const storeCursor = (store: Pick<EventStore, 'syncCursor' | 'setSyncCursor'>): CursorStore => ({
  get: () => store.syncCursor(),
  set: (value) => store.setSyncCursor(value),
});

export type SyncStore = Pick<EventStore, 'pending' | 'markSynced' | 'insertPulled'>;

export interface SyncDeps {
  readonly store: SyncStore;
  readonly remote: RemoteEvents;
  readonly cursor: CursorStore;
  /** Files follow their `media.add` events, with the same retry rules (E01-S12). */
  readonly media?: { readonly queue: MediaQueue; readonly remote: RemoteMedia };
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
  private stopped = false;
  /** Pulled ids the server holds with other content than ours; shown until a retry finds them fixed. */
  private corrupt = new Set<EventId>();

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

  /** The retry action: forget the backoff, re-check corrupt docs, and sync now. */
  async retry(): Promise<void> {
    this.attempt = 0;
    this.stopped = false;
    for (const id of [...this.corrupt]) {
      const there = await withTimeout(this.deps.remote.fetch(id), ACK_TIMEOUT_MS).catch(() => undefined);
      if (!there) continue;
      try {
        await this.deps.store.insertPulled(there);
        this.corrupt.delete(id);
      } catch (err) {
        if (!(err instanceof IntegrityError)) throw err;
      }
    }
    return this.sync();
  }

  /** Ids whose server copy differs from the stored one (integrity errors). */
  integrityIds(): EventId[] {
    return [...this.corrupt].sort();
  }

  /** A local append happened: sync soon, once, however many appends follow. */
  poke(): void {
    if (this.pokeTimer) clearTimeout(this.pokeTimer);
    this.pokeTimer = setTimeout(() => {
      this.pokeTimer = null;
      this.sync().catch(() => undefined); // failure already scheduled its retry
    }, APPEND_DEBOUNCE_MS);
  }

  /** Documents from a realtime listener; same rules as a pull. */
  async ingest(docs: readonly PulledDoc[]): Promise<void> {
    await this.store(docs);
    if (this.corrupt.size) await this.settle({});
  }

  /** No more timers, even from a run still in flight. `retry()` starts again. */
  stop(): void {
    this.stopped = true;
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
        if (this.deps.media) await uploadMedia(this.deps.media.queue, this.deps.media.remote);
      } catch (err) {
        if (!(err instanceof Permanent)) throw err;
        pushError = err.kind; // still pull: others' events are worth having
      }
      await this.pull();
      this.attempt = 0;
      await this.settle(pushError ? { kind: pushError } : {});
    } catch (err) {
      if (err instanceof RemoteError && !isTransient(err.code)) {
        await this.settle({ kind: err.code === 'permission-denied' ? 'denied' : 'invalid' });
        return;
      }
      // Transient, or a local failure mid-run: nothing was lost, try again.
      if (!this.stopped) {
        const delay = backoffMs(this.attempt++, this.deps.random);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.sync().catch(() => undefined); // a failure schedules the next retry itself
        }, delay);
      }
      await this.settle({ transient: true });
      if (!(err instanceof RemoteError)) throw err;
    }
  }

  private async push(): Promise<void> {
    // Events recorded before groups existed (dev devices) have no `groupId`;
    // the server would refuse them, so they stay on the device (E02-S02).
    const outbox = (await this.deps.store.pending()).filter(hasGroup);
    let refused: Permanent | undefined;
    for (let i = 0; i < outbox.length; i += BATCH_SIZE) {
      const batch = outbox.slice(i, i + BATCH_SIZE);
      try {
        await withTimeout(this.deps.remote.push(batch), ACK_TIMEOUT_MS);
        await this.deps.store.markSynced(batch.map((e) => e.id));
      } catch (err) {
        if (!(err instanceof RemoteError) || err.code !== 'permission-denied') throw err;
        // One refused event must not hold back the rest of the outbox.
        refused ??= await this.checkEach(batch);
      }
    }
    if (refused) throw refused;
  }

  /**
   * A refused batch is not yet an error: an earlier ack may have been lost,
   * so the server could already hold some of it. Each event is sent alone;
   * one the server holds with the same content counts as sent.
   */
  private async checkEach(batch: readonly SaleEvent[]): Promise<Permanent | undefined> {
    let refused: Permanent | undefined;
    for (const e of batch) {
      try {
        await withTimeout(this.deps.remote.push([e]), ACK_TIMEOUT_MS);
        await this.deps.store.markSynced([e.id]);
        continue;
      } catch (err) {
        if (!(err instanceof RemoteError) || err.code !== 'permission-denied') throw err;
      }
      const there = await withTimeout(this.deps.remote.fetch(e.id), ACK_TIMEOUT_MS);
      if (there && canonicalJson(there) === canonicalJson(e)) {
        await this.deps.store.markSynced([e.id]);
      } else {
        refused ??= new Permanent(there ? 'integrity' : 'denied');
      }
    }
    return refused;
  }

  private async pull(): Promise<void> {
    const cursor = await this.deps.cursor.get();
    const since = cursor > 0 ? cursor - PULL_OVERLAP_MS : 0;
    await this.store(await withTimeout(this.deps.remote.pull(since), ACK_TIMEOUT_MS));
  }

  /** Stores docs, remembers corrupt ones, and moves the cursor forward only. */
  private async store(docs: readonly PulledDoc[]): Promise<void> {
    let newest = 0;
    for (const doc of docs) {
      if (doc.receivedAt === null) continue;
      try {
        await this.deps.store.insertPulled(doc.event);
      } catch (err) {
        if (!(err instanceof IntegrityError)) throw err;
        // One bad document must not stall the whole group: skip it, report it.
        this.corrupt.add(doc.event.id);
      }
      newest = Math.max(newest, doc.receivedAt);
    }
    // Only after the local writes committed; re-read so a concurrent run's
    // newer cursor is never lowered.
    const current = await this.deps.cursor.get();
    if (newest > current) await this.deps.cursor.set(newest);
  }

  private async settle(outcome: { kind?: SyncError; transient?: boolean }): Promise<void> {
    const media = this.deps.media ? (await this.deps.media.queue.pending()).length : 0;
    // Events with no group are never sent, so they are not waiting either.
    const pending = (await this.deps.store.pending()).filter(hasGroup).length + media;
    const kind = outcome.kind ?? (this.corrupt.size ? 'integrity' : undefined);
    const next: SyncStatus = kind
      ? { state: 'error', pending, error: kind }
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

