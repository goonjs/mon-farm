/**
 * The people store — workers, managers, payers, tenants: farm master data
 * that outlives any one sale (E03-S01, MD-5).
 *
 * Since E03-S01 this is not a table of its own: every create, rename, role
 * change, delete and restore is an event in the one append-only log (see
 * `master-store.ts`), so people sync like everything else and a rename never
 * changes an id. S16's device-only table and its `mon-farm:people` key are
 * left behind (owner 2026-10-03: start fresh, no migration).
 *
 * `people.native.ts` / `people.web.ts` bind `MasterStore` to the platform
 * `EventStore`; this file is the shared port for `tsc`.
 */

import type { MasterStore } from './master-store';

export type { Buyer, FarmZone, PeopleStore, Person, PersonPatch, Point, Property, PropertyDraft } from './master-store';
// No value re-exports from './master-store' here: on device and web a bare
// './people' resolves to people.native.ts / people.web.ts, which export only
// `peopleStore`. Import classes (errors, MasterStore) from './master-store'.


/**
 * Ambient declaration only — see the matching note in `store.ts` for why.
 * `people.native.ts` / `people.web.ts` export the real `peopleStore`; this
 * gives project-wide `tsc` something to resolve a bare `from './people'`
 * against, since `tsc` (unlike Metro) has no per-platform fallback resolution.
 */
export declare const peopleStore: MasterStore;

/** Import from `./people-memory` directly under Jest — see that file's header. */
export { MemoryPeopleStore } from './people-memory';
