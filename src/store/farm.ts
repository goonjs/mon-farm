/**
 * The farm profile store — the zones and piles a farm reuses across sales,
 * separate from any one sale's event log.
 *
 * This exists because a zone and its piles outlive a sale (S27). Setup mints
 * a fresh `newId('zone-')` / `newId('pile-')` for every sale started by hand,
 * so "โซนบน" typed in September and "โซนบน" typed in October are unrelated
 * ids in two different logs — nothing can roll them up except by matching
 * names, which breaks silently. The profile fixes this by minting the id
 * ONCE, here, and having setup copy it into the events it writes (see
 * `docs/stories/s27-farm-profile.md`, Decision 1).
 *
 * The profile is device configuration, not sale data: it stays out of the
 * event log, next to the language, theme and speech preferences.
 *
 * Same port/adapter shape as `PeopleStore` (`people.ts`), and for the same
 * reason: `farm.native.ts` (expo-sqlite) and `farm.web.ts` (localStorage) let
 * the native implementation be durable without dragging the least-travelled
 * part of the stack (expo-sqlite on web) onto the browser verification path.
 */

import type { PileId, ZoneId } from '../core/types';

export interface ProfilePile {
  readonly id: PileId;
  readonly name: string;
  readonly tareG: number;
  readonly stdNetG: number;
}

export interface ProfileZone {
  readonly id: ZoneId;
  readonly name: string;
  readonly piles: readonly ProfilePile[];
  /** Archived, never deleted — a zone id referenced by a past sale's log must stay resolvable. */
  readonly archivedTs: number | null;
}

export interface FarmStore {
  /** Active zones only, Thai-collated — what the profile screen and setup's prefill card show. */
  listZones(): Promise<ProfileZone[]>;
  /** Including archived — for resolving a zoneId a past sale refers to. */
  getZone(id: ZoneId): Promise<ProfileZone | null>;
  addZone(name: string): Promise<ProfileZone>;
  renameZone(id: ZoneId, name: string): Promise<void>;
  /** Archive, not delete. A zone id a past sale refers to must stay resolvable. */
  archiveZone(id: ZoneId): Promise<void>;
  addPile(zoneId: ZoneId, name: string, tareG: number, stdNetG: number): Promise<ProfilePile>;
  editPile(
    zoneId: ZoneId,
    pileId: PileId,
    patch: Partial<Pick<ProfilePile, 'name' | 'tareG' | 'stdNetG'>>,
  ): Promise<void>;
  /** Piles are configuration, not history — removing one only affects future sales. */
  removePile(zoneId: ZoneId, pileId: PileId): Promise<void>;
}

/**
 * Ambient declaration only — see the matching note in `store.ts` for why.
 * `farm.native.ts` / `farm.web.ts` export the real `farmStore`; this gives
 * project-wide `tsc` something to resolve a bare `from './farm'` against,
 * since `tsc` (unlike Metro) has no per-platform fallback resolution.
 */
export declare const farmStore: FarmStore;

/**
 * Re-exported for convenience. `MemoryFarmStore`'s actual implementation
 * lives in `farm-memory.ts`, not here — see that file's header for why:
 * jest-expo applies React Native's platform-extension resolution even inside
 * `jest.requireActual`, so a test importing `MemoryFarmStore` from this file
 * under Jest would silently receive `farm.native.ts`'s exports instead, which
 * don't include it. Import from `./farm-memory` directly in anything that
 * runs under Jest; this re-export is safe everywhere else (Vitest, and any
 * plain Node script, have no such platform layer).
 */
export { MemoryFarmStore } from './farm-memory';
