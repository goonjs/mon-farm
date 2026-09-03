/**
 * The farm profile — the zones and piles this farm sells, every sale.
 *
 * A farm's shape does not change sale to sale; only the day's price and the
 * counts do. Before this, every sale started from an empty setup screen and
 * the same zones, piles and tares were typed again — and each retype was a
 * fresh chance to enter a different tare for the same basket (S27, epic item
 * 6).
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 *
 * This is DEVICE CONFIGURATION, in the same tier as `people.ts` and the
 * language/theme preferences — not sale data. It never enters the event log,
 * there is no event kind for it, and no settlement, report or audit trail
 * reads it. When setup accepts a profile zone it writes exactly the
 * `zone_added` / `pile_added` events a hand-typed zone writes; nothing in the
 * log records that a zone came from here, because for the sale's own record
 * that fact is meaningless.
 *
 * The traffic is one-way, and deliberately so: the profile fills a form, and
 * nothing a sale does — editing an offered tare before accepting it, removing
 * a pile mid-count (S26's `pile_edited` / `pile_removed`) — ever writes back.
 * The epic rejected implicit inheritance for one reason: a one-off change in
 * one sale silently becoming next month's default, with no screen where the
 * owner can see it happened. A write-back path would reintroduce exactly that
 * one level down. The profile changes only on its own screen
 * (`src/app/farm-profile.tsx`), by an owner action.
 *
 * Same port/adapter split as `people.ts` and `store.ts`: `farmProfile.web.ts`
 * (localStorage) and `farmProfile.native.ts` (expo-sqlite, sharing
 * `mon-farm.db` in a table of its own), picked by Metro's platform-extension
 * resolution.
 */

/**
 * Ids here are the profile's own, not sale-scoped `ZoneId`/`PileId`s. A
 * profile zone is a template; the zone a sale actually counts into is a new
 * record in that sale's log with an id of its own.
 */
export interface ProfilePile {
  readonly id: string;
  readonly name: string;
  readonly tareG: number;
  readonly stdNetG: number;
}

export interface ProfileZone {
  readonly id: string;
  readonly name: string;
  readonly piles: readonly ProfilePile[];
}

/**
 * Deliberately no `ZoneContract`: the profile carries a zone's name and its
 * piles' tare and standard net, and nothing about who works it or how the
 * money splits. See S27's Dev notes for why that is a decision rather than an
 * omission.
 */
export interface FarmProfile {
  readonly zones: readonly ProfileZone[];
  /**
   * When the profile was seeded from a past sale, or null if it never has
   * been. Needed because "empty" and "never seeded" are different states: a
   * profile the owner has deliberately emptied must not un-empty itself the
   * next time the screen is opened.
   */
  readonly seededTs: number | null;
}

export interface FarmProfileStore {
  /** Always a profile — `{ zones: [], seededTs: null }` when there is none yet. */
  get(): Promise<FarmProfile>;
  addZone(name: string): Promise<ProfileZone>;
  renameZone(id: string, name: string): Promise<void>;
  /** Takes the zone's piles with it — a template, not a record; nothing here is evidence. */
  removeZone(id: string): Promise<void>;
  /** Null if the zone is unknown — the same no-op-not-an-error convention `people.ts` uses. */
  addPile(
    zoneId: string,
    pile: { name: string; tareG: number; stdNetG: number },
  ): Promise<ProfilePile | null>;
  editPile(
    pileId: string,
    patch: Partial<{ name: string; tareG: number; stdNetG: number }>,
  ): Promise<void>;
  removePile(pileId: string): Promise<void>;
  /**
   * Fills an empty, never-seeded profile from a past sale's zones. A no-op if
   * the profile already holds zones, or was seeded before and has since been
   * emptied by the owner.
   */
  seed(zones: readonly ProfileZone[]): Promise<void>;
}

/**
 * Ambient declaration only — see the matching note in `store.ts` for why.
 * `farmProfile.native.ts` / `farmProfile.web.ts` export the real store.
 */
export declare const farmProfileStore: FarmProfileStore;

/**
 * Re-exported for convenience, and living in its own file for the same
 * jest-expo platform-resolution reason `people-memory.ts` does — see that
 * file's header. Import from `./farmProfile-memory` in anything under Jest.
 */
export { MemoryFarmProfileStore } from './farmProfile-memory';
