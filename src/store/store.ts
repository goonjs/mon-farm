/**
 * The persistence port.
 *
 * Two implementations sit behind it, and Metro picks by filename:
 *   store.native.ts — expo-sqlite, WAL, `mon-farm-v1.db`
 *   store.web.ts    — IndexedDB `mon-farm-v1` (memory fallback when unavailable)
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

import type { EventId, GroupId, SaleEvent } from '../core/types';
import type { DeviceState } from './append-rule';

// Re-exported for existing importers — these live in unsuffixed files, off
// the platform-suffix path (see ./errors's header).
export { IntegrityError } from './errors';
export { checkAppend, type DeviceState } from './append-rule';

export interface EventStore {
  /**
   * Appends one event (architecture §Local data layer, "กติกาของ EventStore"):
   * a new id is inserted; the same id with the same content is a no-op, so a
   * repeated append or pull is harmless; the same id with different content
   * rejects with `IntegrityError`. This device's own `deviceSeq` is allocated
   * by the store inside the append (see append-rule.ts): a number already
   * used is replaced with the next free one, never repeated. Nothing is ever
   * overwritten.
   */
  append(event: SaleEvent): Promise<void>;
  /** One sale's events in fold order (`compareEvents`). */
  load(saleId: string): Promise<SaleEvent[]>;
  /** The outbox: events not yet synced, in `deviceSeq` order. */
  pending(): Promise<SaleEvent[]>;
  markSynced(ids: readonly EventId[]): Promise<void>;
  /**
   * Stores an event pulled from the server (E01-S09): verbatim — never
   * renumbered, even one carrying this device's id (a cloned install) — and
   * already synced. The same id with the same content is a no-op, except
   * that an own event still in the outbox leaves it (its ack was lost); the
   * same id with different content rejects with `IntegrityError`.
   */
  insertPulled(event: SaleEvent): Promise<void>;
  /**
   * Where pull resumes for `groupId`: the newest server `receivedAt` already stored (0 = never pulled).
   * Kept with the group it belongs to: asked about another group (a second group, another account on
   * this device) it answers 0, never a position that is only right for the first. A cursor stored before
   * this was scoped (a bare number) is read as 0 — the safe choice: one full re-download, which is idempotent.
   */
  syncCursor(groupId: GroupId): Promise<number>;
  setSyncCursor(groupId: GroupId, value: number): Promise<void>;
  /** Sale ids present in the store, newest first. */
  listSales(): Promise<string[]>;
  /**
   * The device id is minted once per install; `nextDeviceSeq` is above every
   * sequence number this device has stored, and is persisted in the same
   * write as each event, so a force-close cannot make one repeat (NFR-2).
   */
  device(): Promise<DeviceState>;
  /**
   * False when events only live in memory (no IndexedDB on this browser) —
   * the app keeps counting and warns that nothing will survive a reload.
   */
  isDurable(): Promise<boolean>;
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

// In its own unsuffixed file for the same reason as ./errors: the web adapter
// falls back to it, and `./store` from store.web.ts resolves to itself.
export { MemoryStore } from './memory-store';
