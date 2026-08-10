/**
 * The people store — a reusable list of workers, separate from any one sale.
 *
 * This exists because a worker outlives a sale. `zone_contract_set` (see
 * src/core/types.ts) records a snapshot of a person's name against a
 * `personId`, but that id has to resolve to something across sales for a
 * per-worker payout total to mean anything — which means people cannot live
 * inside one sale's event log the way piles and zones do.
 *
 * This is deliberately the smallest possible slice of FR-1's roster: an id and
 * a name, nothing else. No roles, no contracts-as-entities, no tenancy — those
 * stay out of this epic. It exists only so a worker can be picked from a list
 * instead of retyped (and mistyped) on every sale.
 *
 * Same port/adapter shape as `EventStore` (`store.ts`), and for the same
 * reason: `people.native.ts` (expo-sqlite) and `people.web.ts` (localStorage)
 * let the native implementation be durable without dragging the least-travelled
 * part of the stack (expo-sqlite on web) onto the browser verification path.
 */

import type { PersonId } from '../core/types';

export interface Person {
  readonly id: PersonId;
  readonly name: string;
  readonly createdTs: number;
  /** Archived, never deleted — a person referenced by a past settlement must stay resolvable. */
  readonly archivedTs: number | null;
}

export interface PeopleStore {
  /** Active people only, alphabetical — what a picker shows. */
  list(): Promise<Person[]>;
  /** Including archived — for resolving a personId a past settlement refers to. */
  get(id: PersonId): Promise<Person | null>;
  create(name: string): Promise<Person>;
  rename(id: PersonId, name: string): Promise<void>;
  /** Archive, not delete. A settlement's snapshot survives regardless (see types.ts), but the person should stop appearing in future pickers. */
  archive(id: PersonId): Promise<void>;
}

/**
 * Ambient declaration only — see the matching note in `store.ts` for why.
 * `people.native.ts` / `people.web.ts` export the real `peopleStore`; this
 * gives project-wide `tsc` something to resolve a bare `from './people'`
 * against, since `tsc` (unlike Metro) has no per-platform fallback resolution.
 */
export declare const peopleStore: PeopleStore;

/**
 * Re-exported for convenience. `MemoryPeopleStore`'s actual implementation
 * lives in `people-memory.ts`, not here — see that file's header for why:
 * jest-expo applies React Native's platform-extension resolution even inside
 * `jest.requireActual`, so a test importing `MemoryPeopleStore` from this file
 * under Jest would silently receive `people.native.ts`'s exports instead,
 * which don't include it. Import from `./people-memory` directly in anything
 * that runs under Jest; this re-export is safe everywhere else (Vitest, and
 * any plain Node script, have no such platform layer).
 */
export { MemoryPeopleStore } from './people-memory';
