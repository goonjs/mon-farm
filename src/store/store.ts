/**
 * The persistence port.
 *
 * Two implementations sit behind it, and Metro picks by filename:
 *   store.native.ts — expo-sqlite, WAL, `mon-farm-v1.db`
 *   store.web.ts    — localStorage under `mon-farm-v1:*` (IndexedDB in E01-S03)
 *
 * The split is the single highest-value risk mitigation in this project.
 * expo-sqlite does ship a web implementation, but it is the least-travelled
 * path in the stack and can need cross-origin isolation headers. Keeping it off
 * the web path entirely means a failure there blocks nothing: browser
 * verification is about UI behaviour, and durability guarantees are a native
 * concern.
 *
 * Cost: a second implementation of a small interface. Worth every line.
 * Do not "simplify" this to one adapter.
 */

import { compareEvents } from '../core/order';
import type { EventId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import { checkAppend, type DeviceState } from './append-rule';

// Re-exported for existing importers — these live in unsuffixed files, off
// the platform-suffix path (see ./errors's header).
export { IntegrityError } from './errors';
export { checkAppend, type DeviceState } from './append-rule';

export interface EventStore {
  /**
   * Appends one event (architecture §Local data layer, "กติกาของ EventStore"):
   * a new id is inserted; the same id with the same content is a no-op, so a
   * repeated append or pull is harmless; the same id with different content,
   * or a `deviceSeq` this device already used, rejects with `IntegrityError`.
   * Nothing is ever overwritten.
   */
  append(event: SaleEvent): Promise<void>;
  /** One sale's events in fold order (`compareEvents`). */
  load(saleId: string): Promise<SaleEvent[]>;
  /** The outbox: events not yet synced, in `deviceSeq` order. */
  pending(): Promise<SaleEvent[]>;
  markSynced(ids: readonly EventId[]): Promise<void>;
  /** Sale ids present in the store, newest first. */
  listSales(): Promise<string[]>;
  /**
   * The device id is minted once per install; `nextDeviceSeq` is above every
   * sequence number this device has stored, and is persisted in the same
   * write as each event, so a force-close cannot make one repeat (NFR-2).
   */
  device(): Promise<DeviceState>;
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
  private rows = new Map<EventId, SaleEvent>();
  private synced = new Set<EventId>();
  private state: DeviceState = { deviceId: uuidv7(), nextDeviceSeq: 1 };

  async append(event: SaleEvent): Promise<void> {
    const next = checkAppend(event, this.rows.get(event.id), this.state);
    if (!next) return;
    this.rows.set(event.id, event);
    this.state = next;
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    return [...this.rows.values()].filter((e) => e.saleId === saleId).sort(compareEvents);
  }

  async pending(): Promise<SaleEvent[]> {
    return [...this.rows.values()]
      .filter((e) => !this.synced.has(e.id))
      .sort((a, b) => a.deviceSeq - b.deviceSeq);
  }

  async markSynced(ids: readonly EventId[]): Promise<void> {
    for (const id of ids) this.synced.add(id);
  }

  async listSales(): Promise<string[]> {
    const firstTs = new Map<string, number>();
    for (const e of this.rows.values()) {
      firstTs.set(e.saleId, Math.min(firstTs.get(e.saleId) ?? Infinity, e.ts));
    }
    return [...firstTs.keys()].sort((a, b) => firstTs.get(b)! - firstTs.get(a)!);
  }

  async device(): Promise<DeviceState> {
    return this.state;
  }
}
