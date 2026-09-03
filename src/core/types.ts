/**
 * The domain model for one rubber sale.
 *
 * Nothing in `src/core` may import from react, react-native or expo. That
 * constraint is load-bearing: it is what lets the entire money model run under
 * Vitest in milliseconds, with no Babel or Metro transform in the path.
 *
 * ── Units ───────────────────────────────────────────────────────────────────
 *
 * WEIGHTS ARE INTEGER GRAMS.   50 kg is 50_000.
 * MONEY IS INTEGER SATANG.     ฿26.50 is 2650.
 *
 * Round only at the presentation boundary, in `format.ts`, never in here. Two
 * parties are signing off on these numbers; `0.30000000000000004 kg` cannot
 * appear in a document either of them is asked to trust.
 */

export type SaleId = string;
export type ZoneId = string;
export type PileId = string;
export type PersonId = string;

export type EventKind = 'accept' | 'short' | 'reject' | 'correction' | 'sys';

/**
 * Two clocks, deliberately kept apart.
 *
 * `seq` is the ordering authority (FR-12.5). The device clock cannot be
 * trusted, so nothing downstream may sort by time.
 *
 * `ts` is the wall clock — "roughly when", useful to a human reading the log,
 * never used to order anything.
 *
 * `mono` is a monotonic uptime reading, used for interval evidence (FR-12.4):
 * how long a hold lasted, how long since the last basket. It survives a wall
 * clock that jumps; it does not survive a device restart, which is fine
 * because intervals only matter within a session.
 */
export interface EventBase {
  readonly saleId: SaleId;
  readonly seq: number;
  readonly ts: number;
  readonly mono: number;
  readonly actor: string;
}

/**
 * One standard basket.
 *
 * `netG` and `tareG` are SNAPSHOTS of the pile's configuration at the moment
 * this basket was counted — not references to the pile's current values. If the
 * standard net is edited later, or a pile is reopened and re-tared, every
 * basket already counted keeps the weight it was counted at. Referencing live
 * pile config would retroactively rewrite money that has already been agreed
 * out loud, which is exactly the silent edit NFR-3 exists to prevent.
 */
export interface AcceptEvent extends EventBase {
  readonly kind: 'accept';
  readonly pileId: PileId;
  /**
   * How the basket got into the log. `hold`/`hold-kbd` are watched events —
   * someone was at the scale. `bulk` (S23) is not: it is a basket entered
   * afterwards from a tally, and the whole point of keeping it a separate
   * value is that the log must never let the two look alike.
   */
  readonly source: 'hold' | 'hold-kbd' | 'bulk';
  readonly netG: number;
  readonly tareG: number;
}

/**
 * An off-standard basket (FR-5.6).
 *
 * Stores what was OBSERVED — the gross scale reading — and the tare used, and
 * never a pre-derived net. The operator supplies the number they can see on the
 * scale; the app derives the rest, and both survive in the log so the
 * arithmetic is checkable by hand (FR-7.4).
 */
export interface ShortEvent extends EventBase {
  readonly kind: 'short';
  readonly pileId: PileId;
  readonly readingG: number;
  readonly tareG: number;
}

/**
 * A hold that did not complete. Never affects totals — it is evidence only.
 *
 * Recorded because a silently dropped interaction turns a phantom count into a
 * missed count, and the person counting has no way to tell the difference
 * (finding F-7).
 */
export interface RejectEvent extends EventBase {
  readonly kind: 'reject';
  readonly pileId: PileId;
  readonly source: 'hold' | 'hold-kbd';
  readonly reason: 'released-early';
  readonly heldMs: number;
}

/**
 * Voids an earlier basket (FR-5.4, NFR-3).
 *
 * Append-only: the target event is never mutated or removed. `undo-last` is the
 * one-tap tier with a default reason; `void` is chosen from the log and demands
 * a reason.
 */
export interface CorrectionEvent extends EventBase {
  readonly kind: 'correction';
  readonly pileId: PileId;
  readonly targetSeq: number;
  readonly mode: 'undo-last' | 'void';
  readonly reason: string;
}

export type SysPayload =
  | {
      readonly t: 'sale_started';
      readonly farmName: string;
      readonly buyer: string;
      readonly manager: string;
      readonly workerLead: string;
      readonly where: 'farm' | 'buyer';
    }
  | { readonly t: 'price_set'; readonly satangPerKg: number; readonly indexRef: string }
  /**
   * FR-8.5: the basis has no safe default. `settle()` refuses to run without
   * one being resolvable for every zone — either this sale-level default or a
   * `zone_contract_set` override (below).
   *
   * `ownerPct` here is the DEFAULT applied to any zone that never gets its own
   * contract. `basis` (gross vs final) is sale-level only — it does not vary
   * per zone, unlike the percentage.
   */
  | { readonly t: 'split_set'; readonly ownerPct: number; readonly basis: 'gross' | 'final' }
  | { readonly t: 'zone_added'; readonly zoneId: ZoneId; readonly name: string }
  /**
   * Overrides the sale default for one zone. Workers are per zone (multiple
   * zones can pay different people different percentages), which `split_set`
   * alone cannot express.
   *
   * `personId` references the people store (src/store/people.ts) — that is
   * what lets settlement group two zones paying the same worker into one
   * total. `workerName` is a SNAPSHOT of that person's name at the moment the
   * contract was agreed, for the same reason `accept` snapshots `netG`:
   * renaming a person next month must not silently rewrite what a past
   * settlement says. The reference groups; the snapshot records.
   */
  | {
      readonly t: 'zone_contract_set';
      readonly zoneId: ZoneId;
      readonly personId: PersonId;
      readonly workerName: string;
      readonly ownerPct: number;
    }
  /**
   * Drops a zone's own contract, putting it back on the sale-level default.
   *
   * Needed because the log is append-only: clearing the worker in the UI
   * cannot un-write the `zone_contract_set` that came before it, so without
   * this the old contract stayed authoritative for the payout while the
   * screen showed no worker at all — the zone quietly kept paying someone
   * the operator believed they had removed.
   */
  | {
      readonly t: 'zone_contract_cleared';
      readonly zoneId: ZoneId;
    }
  | {
      readonly t: 'pile_added';
      readonly pileId: PileId;
      readonly zoneId: ZoneId;
      readonly name: string;
      readonly tareG: number;
      readonly stdNetG: number;
    }
  /**
   * S26. A correction to a pile's own setup — appended, never a rewrite of
   * the `pile_added` it corrects. Carries the WHOLE configuration rather than
   * only the changed field, so one event is the complete answer to "what is
   * this pile now" and the fold never has to merge two partial edits.
   *
   * `tareG`/`stdNetG` are honoured only while the pile is unlocked (FR-3.4).
   * Once the first basket is counted they are ignored by the projection and
   * refused by `canEditPileNet` before the event is ever appended — the same
   * rule stated twice, deliberately, so no write path can move money that has
   * already been agreed out loud. A name carries no money and is editable at
   * any status.
   */
  | {
      readonly t: 'pile_edited';
      readonly pileId: PileId;
      readonly name: string;
      readonly tareG: number;
      readonly stdNetG: number;
    }
  /**
   * S26. Retires a pile. Never a delete: the pile, its baskets and every
   * event about it stay in the log, and what changes is only what the pile
   * contributes from here on — it drops out of every rollup exactly as if
   * each of its baskets had been voided, without touching one of them.
   *
   * ONE event kind for both removal paths, with `reason` carrying the
   * difference: `''` for a pile that never held a basket (a typo, removed
   * with one tap) and a typed sentence for one that did (a void, in the S12
   * register). `CorrectionEvent` already folds `undo-last` and `void` into
   * one shape for the same reason — the fact recorded is identical, and only
   * how much ceremony it deserved differs.
   */
  | { readonly t: 'pile_removed'; readonly pileId: PileId; readonly reason: string }
  /** S26. Renames a zone. Zones carry no weights, so there is nothing to lock. */
  | { readonly t: 'zone_edited'; readonly zoneId: ZoneId; readonly name: string }
  /**
   * S26. Retires a zone, which is only possible once every pile under it has
   * been removed through `pile_removed` first (`canRemoveZone`). There is
   * deliberately no cascade: a zone removal that swept its piles away with it
   * would decide, on the operator's behalf, that every one of those piles was
   * a mistake — and each of them is its own statement, with its own reason.
   */
  | { readonly t: 'zone_removed'; readonly zoneId: ZoneId; readonly reason: string }
  /** Non-blocking by design: a failed zero check flags and continues. */
  | { readonly t: 'zero_check'; readonly pileId: PileId; readonly ok: boolean; readonly readingG: number }
  | { readonly t: 'tare_confirmed'; readonly pileId: PileId; readonly tareG: number }
  | { readonly t: 'ready'; readonly pileId: PileId }
  | { readonly t: 'pile_closed'; readonly pileId: PileId; readonly forced: boolean }
  | { readonly t: 'pile_reopened'; readonly pileId: PileId; readonly reason: string }
  /**
   * S23. A pile entered in bulk has no scale reading to check, so the
   * zero/tare gate is skipped rather than answered — and the skip is
   * recorded, with a typed reason, for the same reason `reject` exists: a
   * thing that did not happen has to be visible as not having happened, not
   * merely absent. Silence would be indistinguishable from a pile that was
   * checked.
   *
   * Deliberately carries no projected state of its own. It does not set
   * `zeroChecked`/`tareConfirmed` — that would fake the result of a check
   * nobody performed — and the "this pile was entered in bulk" marker the UI
   * shows is derived from the presence of this event in the log.
   */
  | { readonly t: 'bulk_gate_skipped'; readonly pileId: PileId; readonly reason: string }
  | { readonly t: 'zone_closed'; readonly zoneId: ZoneId; readonly forcedPiles: readonly PileId[] }
  | { readonly t: 'zone_reopened'; readonly zoneId: ZoneId; readonly reason: string }
  | { readonly t: 'sale_closed' }
  | { readonly t: 'sale_reopened'; readonly reason: string }
  /**
   * Written whether or not audio succeeded (FR-12.2, FR-11.10). The log records
   * what was ATTEMPTED plus whether it was heard, which is what makes silence
   * auditable rather than invisible.
   */
  | { readonly t: 'announced'; readonly thai: string; readonly ok: boolean }
  /**
   * FR-11.11: speech can be turned off without changing the counting logic.
   * Logged only while a sale is open — a device-level toggle flipped before
   * any sale starts has no log to append to. Without this, a sale with no
   * `announced` events would be indistinguishable from one where the voice
   * failed silently throughout; this is what makes the silence deliberate on
   * the record, the same reasoning as `clock_anomaly` and the S23 gate-skip.
   */
  | { readonly t: 'speech_set'; readonly on: boolean }
  | {
      readonly t: 'clock_anomaly';
      readonly anomaly: 'backwards' | 'before-sale-start' | 'implausible-jump';
      readonly deltaMs: number;
    };

export interface SysEvent extends EventBase {
  readonly kind: 'sys';
  readonly payload: SysPayload;
}

export type SaleEvent = AcceptEvent | ShortEvent | RejectEvent | CorrectionEvent | SysEvent;

/** A basket that contributes weight — i.e. not voided. */
export type BasketEvent = AcceptEvent | ShortEvent;

// ── Projected state ─────────────────────────────────────────────────────────
// None of this is stored. It is all derived from the log by `projectSale`.

export type PileStatus = 'not-started' | 'counting' | 'closed';
export type OpenClosed = 'open' | 'closed';

export interface Pile {
  readonly id: PileId;
  readonly zoneId: ZoneId;
  readonly name: string;
  readonly tareG: number;
  readonly stdNetG: number;
  readonly status: PileStatus;
  readonly zeroChecked: boolean;
  readonly tareConfirmed: boolean;
  /** True once counting has begun — `stdNetG` locks at this point (FR-3.4). */
  readonly locked: boolean;
  /**
   * S26. Retired: still here, still readable, contributing nothing. Never
   * true for a pile that was deleted, because nothing is ever deleted.
   */
  readonly removed: boolean;
}

export interface ZoneContract {
  readonly personId: PersonId;
  readonly workerName: string;
  readonly ownerPct: number;
}

export interface Zone {
  readonly id: ZoneId;
  readonly name: string;
  readonly status: OpenClosed;
  readonly pileIds: readonly PileId[];
  /** null when the zone has no override — settle() falls back to the sale default. */
  readonly contract: ZoneContract | null;
  /** S26. Retired, the same way a pile is: kept, not deleted. */
  readonly removed: boolean;
}

export interface SaleState {
  readonly id: SaleId;
  readonly status: OpenClosed;
  readonly startedTs: number | null;
  readonly parties: {
    readonly farmName: string;
    readonly buyer: string;
    readonly manager: string;
    readonly workerLead: string;
    readonly where: 'farm' | 'buyer';
  } | null;
  readonly price: { readonly satangPerKg: number; readonly indexRef: string } | null;
  readonly split: { readonly ownerPct: number; readonly basis: 'gross' | 'final' } | null;
  readonly zones: readonly Zone[];
  readonly piles: readonly Pile[];
  /** FR-12.7 — surfaced as a non-blocking indicator, never a gate. */
  readonly clockSuspect: boolean;
  /** FR-11.11. Defaults on; flipped by `speech_set` events. */
  readonly speechOn: boolean;
}

export interface Totals {
  readonly baskets: number;
  readonly standardBaskets: number;
  readonly shortBaskets: number;
  readonly netG: number;
  readonly standardNetG: number;
  readonly shortNetG: number;
}

export const ZERO_TOTALS: Totals = {
  baskets: 0,
  standardBaskets: 0,
  shortBaskets: 0,
  netG: 0,
  standardNetG: 0,
  shortNetG: 0,
};
