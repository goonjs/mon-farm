/**
 * The persistence port.
 *
 * Two implementations sit behind it, and Metro picks by filename:
 *   store.native.ts — expo-sqlite, WAL, UNIQUE(sale_id, seq)
 *   store.web.ts    — IndexedDB
 *
 * The split is the single highest-value risk mitigation in this project.
 * expo-sqlite does ship a web implementation, but it is the least-travelled
 * path in the stack and can need cross-origin isolation headers. Keeping it off
 * the web path entirely means a failure there blocks nothing: browser
 * verification is about UI behaviour, and durability guarantees are a native
 * concern.
 *
 * Cost: a second implementation of a four-method interface. Worth every line.
 * Do not "simplify" this to one adapter.
 */

import { DuplicateSeqError } from './errors';
import type { SaleEvent } from '../core/types';

// Re-exported for existing importers — the class itself lives in ./errors,
// off the platform-suffix path (see that file's header).
export { DuplicateSeqError } from './errors';

export interface EventStore {
  /**
   * Appends one event. MUST reject a duplicate (saleId, seq) rather than
   * overwriting — the log is the record of what happened, and two events
   * cannot occupy one position in it.
   */
  append(event: SaleEvent): Promise<void>;
  /**
   * Appends several events ATOMICALLY: either every event lands or none does,
   * and a duplicate (saleId, seq) anywhere in the batch rejects the whole
   * batch without writing any of it.
   *
   * Added for bulk entry (S23), where one action writes a gate-skip, N
   * baskets, a leftover and a close. Written one at a time, a crash part-way
   * through leaves a pile carrying baskets that the log says was never
   * started — numbers with nothing to say where they came from, which is the
   * one thing this log exists to prevent. `append` remains the primitive;
   * this is the transaction around it.
   */
  appendAll(events: readonly SaleEvent[]): Promise<void>;
  load(saleId: string): Promise<SaleEvent[]>;
  /** Unsynced rows. The outbox query for a sync layer that does not exist yet. */
  pending(): Promise<SaleEvent[]>;
  markSynced(saleId: string, seqs: readonly number[]): Promise<void>;
  /** Sale ids present in the store, newest first. */
  listSales(): Promise<string[]>;
}

/**
 * Ambient declaration only — never implemented here, never emitted (this whole
 * project builds with `noEmit`; Metro strips types via Babel).
 *
 * `store.native.ts` and `store.web.ts` each export the real `store` constant,
 * and Metro's platform-extension resolution picks whichever one matches the
 * build target for a bare `import { store } from './store'`. But `tsc` itself
 * has no such resolution — `moduleSuffixes` only supports one fixed suffix per
 * compilation, not "try each platform and fall back" — so a project-wide
 * `tsc --noEmit` sees the literal `store.ts` file and needs something to
 * resolve `store` against. This line is that something.
 */
export declare const store: EventStore;

/**
 * In-memory store. Used by tests, and as the fallback when no persistent
 * backend is available — the app stays usable, it just forgets.
 */
export class MemoryStore implements EventStore {
  private rows = new Map<string, SaleEvent[]>();
  private synced = new Set<string>();

  async append(event: SaleEvent): Promise<void> {
    const list = this.rows.get(event.saleId) ?? [];
    if (list.some((e) => e.seq === event.seq)) {
      throw new DuplicateSeqError(event.saleId, event.seq);
    }
    list.push(event);
    this.rows.set(event.saleId, list);
  }

  async appendAll(events: readonly SaleEvent[]): Promise<void> {
    // Check every event BEFORE writing any of them: the all-or-nothing
    // promise is the whole reason this method exists.
    for (const event of events) {
      const list = this.rows.get(event.saleId) ?? [];
      if (list.some((e) => e.seq === event.seq)) {
        throw new DuplicateSeqError(event.saleId, event.seq);
      }
    }
    for (const event of events) await this.append(event);
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    return [...(this.rows.get(saleId) ?? [])].sort((a, b) => a.seq - b.seq);
  }

  async pending(): Promise<SaleEvent[]> {
    const out: SaleEvent[] = [];
    for (const [saleId, list] of this.rows) {
      for (const e of list) {
        if (!this.synced.has(`${saleId}#${e.seq}`)) out.push(e);
      }
    }
    return out;
  }

  async markSynced(saleId: string, seqs: readonly number[]): Promise<void> {
    for (const seq of seqs) this.synced.add(`${saleId}#${seq}`);
  }

  async listSales(): Promise<string[]> {
    return [...this.rows.keys()];
  }
}
