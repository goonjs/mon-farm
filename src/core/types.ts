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
/** UUIDv7 (RFC 9562), lowercase canonical form — see src/lib/id.ts. */
export type EventId = string;
/** Firebase Auth uid once login exists (E02-S01). */
export type UserId = string;
/** UUIDv7 minted once per install (web: per browser profile). */
export type DeviceId = string;

/**
 * Who recorded an event: a person on a particular device (D-23). `deviceId`
 * is self-declared by the device — provenance, not a security boundary.
 */
export interface Actor {
  readonly userId: UserId;
  readonly deviceId: DeviceId;
}

export type EventKind = 'accept' | 'short' | 'reject' | 'correction' | 'sys' | 'delete' | 'restore' | 'master';

/**
 * Any record an event can create or change: a sale, zone, pile, deduction —
 * or a basket, whose record id is its own event id.
 */
export type RecordId = string;

/** Where a record came from (SYNC-11). Everything is `'app'` until LINE/import/AI exist. */
export type Source = 'app' | 'line' | 'import' | 'ai';

/**
 * Identity and ordering (E01-S02).
 *
 * `id` is globally unique, so two offline phones can never mint the same
 * event, and re-receiving one is recognisable as a repeat. `deviceSeq` counts
 * 1, 2, 3, … per install and never repeats, even across a force-close (NFR-2);
 * it is what the outbox drains in.
 *
 * `seq` is this sale's position as the recording device saw it. Two devices
 * offline can reach the same `seq`, so it is not unique: the fold order is
 * `(seq, deviceId, deviceSeq)` — see `compareEvents` — and nothing that must
 * name one event (a correction's target) uses it. Retired with the sale
 * model redesign in E04-S01.
 *
 * Two clocks, deliberately kept apart. The device clock cannot be trusted, so
 * nothing downstream may sort by time.
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
  readonly id: EventId;
  readonly saleId: SaleId;
  readonly seq: number;
  readonly deviceSeq: number;
  readonly ts: number;
  readonly mono: number;
  readonly actor: Actor;
  readonly source: Source;
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
   * The weighing point (E04-S01) and the basket's number, fixed when it is
   * recorded (SALE-10) — per tapper or per point, by the sale's mode. Absent
   * on baskets recorded by the pile counter before the move to points.
   */
  readonly pointId?: string;
  readonly basketNo?: number;
  /**
   * How the basket was entered (renamed from `source` in E01-S04, which is
   * now the envelope's channel). `edit` = re-recorded from the basket list
   * (E04-S09), with `editOf` naming the basket it replaces.
   */
  readonly input: 'hold' | 'hold-kbd' | 'edit';
  readonly netG: number;
  readonly tareG: number;
  /** The basket this one replaces (E04-S09): that one is voided with reason `edit` in the same step. */
  readonly editOf?: EventId;
  /**
   * A later part of an open short basket (E04-S06, SALE-11): the first part's
   * id. Same `basketNo`; counts toward that one basket, never as its own.
   */
  readonly partOf?: EventId;
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
  /**
   * The weighing point (E04-S01) and the basket's number, fixed when it is
   * recorded (SALE-10) — per tapper or per point, by the sale's mode. Absent
   * on baskets recorded by the pile counter before the move to points.
   */
  readonly pointId?: string;
  readonly basketNo?: number;
  readonly readingG: number;
  readonly tareG: number;
  /**
   * The scale's accepted skew at the time (E04-S03, D-75), snapshotted like
   * the tare: net = reading − basket − skew. Absent = no skew.
   */
  readonly skewG?: number;
  /** The basket this one replaces (E04-S09), as on `AcceptEvent`. */
  readonly editOf?: EventId;
  /**
   * A later part of an open short basket (E04-S06), as on `AcceptEvent`. A
   * top-up that falls short weighs the whole basket, so its `tareG` also
   * holds the rubber already in it: net = reading − (basket + what was there).
   */
  readonly partOf?: EventId;
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
  readonly input: 'hold' | 'hold-kbd';
  readonly reason: 'released-early';
  readonly heldMs: number;
}

/**
 * Voids an earlier basket (FR-5.4, NFR-3), named by event id — a `seq` can
 * be shared by two devices' baskets, an id cannot.
 *
 * Append-only: the target event is never mutated or removed. `undo-last` is the
 * one-tap tier with a default reason; `void` is chosen from the log and demands
 * a reason.
 */
export interface CorrectionEvent extends EventBase {
  readonly kind: 'correction';
  readonly pileId: PileId;
  readonly targetId: EventId;
  readonly mode: 'undo-last' | 'void';
  readonly reason: string;
}

export type SysPayload =
  | {
      readonly t: 'sale_started';
      readonly farmName: string;
      readonly buyer: string;
      /**
       * The master-data buyer picked (E03-S01), when one was. `buyer` stays
       * the name SNAPSHOT for the record; this id is what makes "the latest
       * buyer" the next sale's default (MD-6). Absent for a typed-in name.
       */
      readonly buyerId?: string;
      /** The manager picked from master data (E04-S02); `manager` stays the name snapshot. */
      readonly managerId?: string;
      /** Free note on the sale header (E04-S02, SALE-2). */
      readonly note?: string;
      readonly manager: string;
      readonly workerLead: string;
      readonly where: 'farm' | 'buyer';
    }
  | { readonly t: 'price_set'; readonly satangPerKg: number; readonly indexRef: string }
  /** The sale's basket-numbering mode, chosen at start; the group setting is the default (D-53). */
  | { readonly t: 'numbering_set'; readonly numbering: NumberingMode }
  /**
   * FR-8.5: `settle()` refuses to run without a split resolvable for every
   * zone — either this sale-level default or a `zone_contract_set` override
   * (below). `ownerPct` is the DEFAULT for any zone with no contract of its
   * own. The split is always on gross (D-12); the old `basis` field was inert
   * and is gone (E03-S06) — no stored log carries it (owner: start fresh).
   */
  | { readonly t: 'split_set'; readonly ownerPct: number }
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
   * The empty scale did not read zero and the operator chose to carry on
   * with the skew (E04-S03, D-75): every expected reading includes it, and
   * short baskets subtract it, until the next passing zero check.
   */
  | { readonly t: 'skew_accepted'; readonly pileId: PileId; readonly skewG: number }
  /** The operator chose to wait for another scale instead (D-75): nothing is weighed until a zero check passes. */
  | { readonly t: 'scale_wait'; readonly pileId: PileId }
  /** The zero/tare check was not asked here, by the sale's check mode (SALE-6) — recorded, not silent. */
  | { readonly t: 'gate_skipped'; readonly pileId: PileId; readonly mode: ZeroCheckMode }
  /** Non-blocking by design: a failed zero check flags and continues. */
  | { readonly t: 'zero_check'; readonly pileId: PileId; readonly ok: boolean; readonly readingG: number }
  | { readonly t: 'tare_confirmed'; readonly pileId: PileId; readonly tareG: number }
  | { readonly t: 'ready'; readonly pileId: PileId }
  | { readonly t: 'pile_closed'; readonly pileId: PileId; readonly forced: boolean }
  | { readonly t: 'pile_reopened'; readonly pileId: PileId; readonly reason: string }
  | { readonly t: 'zone_closed'; readonly zoneId: ZoneId; readonly forcedPiles: readonly PileId[] }
  | { readonly t: 'zone_reopened'; readonly zoneId: ZoneId; readonly reason: string }
  | { readonly t: 'sale_closed' }
  | { readonly t: 'sale_reopened'; readonly reason: string }
  /**
   * The sale's business status (E04-S11, SALE-20): Draft until marked
   * Completed (needs a price) or Cancelled. Separate from `sale_closed`, which
   * still gates counting and the settlement screen until the owner decides
   * whether the S13 close/reopen lifecycle goes.
   */
  | { readonly t: 'sale_status_set'; readonly status: SaleStatus; readonly reason?: string }
  /**
   * A money-changing edit made after the sale was Completed (SALE-21): why,
   * and which event it changed. Read by E05-S05 as "recheck this payment".
   */
  | { readonly t: 'money_edit'; readonly reason: string; readonly targetId: EventId }
  /**
   * An open short basket closed as it is (E04-S06): "จบเข่งแล้ว / เป็นเศษ"
   * (`scrap`), a move to another tapper's point (`tapper-change`, SALE-12),
   * or "start the next full basket" (`next`). `basketId` is its first part.
   */
  | { readonly t: 'basket_closed'; readonly basketId: EventId; readonly reason: 'scrap' | 'tapper-change' | 'next' }
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
    }
  /**
   * Money leaving one worker's own share (S29, FR-7.3). `satang` is a
   * POSITIVE integer — the sign lives in the arithmetic (`settle()` computes
   * `payoutSatang = workerSatang - deductionSatang`), never in the event.
   * `reason` and `agreedBy` are both required at the point a deduction is
   * created — see the form in settlement.tsx.
   *
   * `agreedBy` is a snapshotted free-text name, not a `personId` reference —
   * the same reasoning `zone_contract_set` uses for `workerName`: renaming
   * someone next month must not rewrite what a past sale recorded.
   */
  | {
      readonly t: 'deduction_added';
      readonly deductionId: string;
      readonly personId: PersonId;
      /**
       * Snapshot of the person's name at the time, for the same reason
       * `zone_contract_set` snapshots `workerName`: renaming someone next
       * month must not rewrite what a past sale recorded. It is also the ONLY
       * way to name someone who holds no zone contract in this sale — there is
       * no contract to read a name from, and settle() must still show them.
       */
      readonly personName: string;
      readonly satang: number;
      readonly reason: string;
      readonly agreedBy: string;
    }
  /**
   * Voids a deduction by id (FR-7.3, NFR-3) — append-only, same bar
   * `pile_reopened` and `correction` already meet: the target is never
   * mutated or removed, only marked. Naming the target by `deductionId`
   * rather than `seq` means a void survives being replayed in any order —
   * the projection tolerates one arriving before the deduction it names, and
   * silently ignores an id it has never seen (see `project.ts`).
   */
  | { readonly t: 'deduction_voided'; readonly deductionId: string; readonly reason: string };

export interface SysEvent extends EventBase {
  readonly kind: 'sys';
  readonly payload: SysPayload;
}

/**
 * Soft Delete (SYNC-10, D-27): one rule for every record. Nothing is ever
 * removed from the log; a `delete` hides `targetId` from normal views and
 * totals, a later `restore` brings it back exactly as it was. The last of the
 * two in fold order wins. Not the same as a Cancelled sale, which is a
 * business outcome and stays listed (E04-S11).
 */
export interface DeleteEvent extends EventBase {
  readonly kind: 'delete';
  readonly targetId: RecordId;
}

export interface RestoreEvent extends EventBase {
  readonly kind: 'restore';
  readonly targetId: RecordId;
}

/**
 * Farm master data (E03): people and buyers, shared by the farm group rather
 * than owned by one sale. Stored in the same append-only log under the
 * reserved scope `MASTER_SCOPE` (src/core/master.ts) — the envelope's
 * `saleId` stands in for the architecture's `saleId: null` until the
 * `groupId` envelope lands (E02-S02 / E04-S01). Delete and restore are the
 * ordinary `delete`/`restore` events naming `personId`/`buyerId` (D-27).
 *
 * `person_edited` / `buyer_edited` are patches: a field left out is unchanged.
 */
export type BuiltinRole = 'tapper' | 'worker' | 'manager' | 'payer' | 'tenant' | 'owner';

export type MasterPayload =
  | {
      readonly t: 'person_added';
      readonly personId: PersonId;
      readonly name: string;
      readonly roles: readonly BuiltinRole[];
      /** Roles typed in by hand, e.g. "ลูกคนงาน" (D-68). */
      readonly otherRoles: readonly string[];
    }
  | {
      readonly t: 'person_edited';
      readonly personId: PersonId;
      readonly name?: string;
      readonly roles?: readonly BuiltinRole[];
      readonly otherRoles?: readonly string[];
    }
  | { readonly t: 'buyer_added'; readonly buyerId: string; readonly name: string }
  | { readonly t: 'buyer_edited'; readonly buyerId: string; readonly name: string }
  /**
   * A farm property (สวน, E03-S02, MD-1). Planted year and GPS are optional
   * and absent means Unknown (SYNC-12). Canonical JSON allows integers only,
   * so GPS is microdegrees.
   */
  | {
      readonly t: 'property_added';
      readonly propertyId: string;
      readonly name: string;
      readonly crop: Crop;
      readonly plantedYearBe?: number;
      readonly gps?: Gps;
    }
  | {
      readonly t: 'property_edited';
      readonly propertyId: string;
      readonly name?: string;
      readonly crop?: Crop;
      readonly plantedYearBe?: number;
      readonly gps?: Gps;
      /** Optional fields set back to Unknown — canonical JSON has no null. */
      readonly cleared?: readonly ('plantedYearBe' | 'gps')[];
    }
  /**
   * One dated area entry: appended, never overwritten (MD-1). `centiRai` is
   * rai × 100 (integers only); `effective` is an ISO day, `YYYY-MM-DD`.
   */
  | {
      readonly t: 'area_recorded';
      readonly propertyId: string;
      readonly entryId: string;
      readonly centiRai: number;
      readonly effective: string;
    }
  /**
   * A weighing point (จุดชั่ง = กอง, E03-S03, MD-3): a place under a farm,
   * reused by every sale. No tare or basket weight of its own — those are
   * group settings (MD-7).
   */
  | { readonly t: 'point_added'; readonly pointId: string; readonly propertyId: string; readonly name: string }
  | { readonly t: 'point_renamed'; readonly pointId: string; readonly name: string }
  /**
   * A point's tapper from `from` (an ISO day; absent = no start, covering all
   * of the past) until the next change on that point (E03-S05, MD-4, D-63).
   * Whoever had it before ends the day before — derived, never stored.
   * Cancelling a planned change is a `delete` naming `assignmentId`.
   */
  | {
      readonly t: 'tapper_assigned';
      readonly assignmentId: string;
      readonly pointId: string;
      readonly tapperId: PersonId;
      readonly from?: string;
    }
  /** No tapper from `from`: someone left with no replacement yet. */
  | { readonly t: 'tapper_unassigned'; readonly assignmentId: string; readonly pointId: string; readonly from: string }
  /**
   * A tapper's share from `from` (ISO day) on (E03-S06, MD-8): the tapper's
   * whole-number percent of GROSS sale value; the owner gets the rest. No
   * entry = 50/50. Money: two devices editing it concurrently must become a
   * Conflict (D-30) once E01-S11 exists.
   */
  | {
      readonly t: 'share_set';
      readonly shareId: string;
      readonly tapperId: PersonId;
      readonly tapperPct: number;
      readonly from: string;
    }
  /**
   * Group-wide sale settings (E03-S07, MD-7/MD-9/SYNC-6) — a patch; a field
   * left out is unchanged. Hold time and speech are per device (owner
   * 2026-10-03) and never appear here.
   */
  | {
      readonly t: 'settings_set';
      readonly scaleType?: ScaleType;
      readonly numbering?: NumberingMode;
      readonly zeroCheck?: ZeroCheckMode;
      readonly dupWindowS?: number;
    }
  /** A standard net + basket weight pair, integer grams (MD-7). Removed with `delete`. */
  | { readonly t: 'basket_pair_added'; readonly pairId: string; readonly netG: number; readonly basketG: number }
  | { readonly t: 'basket_pair_default'; readonly pairId: string };

/** Scale resolution: whole kg (default) or one decimal (not available yet, D-66). */
export type ScaleType = 'whole' | 'decimal1';
/** Basket numbers run on per tapper across their points, or restart at 1 per point (D-79). */
export type NumberingMode = 'per-tapper' | 'per-point';
/** Zero/tare check before weighing: every point, the first point of each farm, or none (MD-9). */
export type ZeroCheckMode = 'every' | 'first-per-farm' | 'skip';

export type Crop = 'rubber' | 'durian';

export interface Gps {
  readonly latE6: number;
  readonly lngE6: number;
}

export interface MasterEvent extends EventBase {
  readonly kind: 'master';
  readonly payload: MasterPayload;
}

export type SaleEvent =
  | MasterEvent
  | AcceptEvent
  | ShortEvent
  | RejectEvent
  | CorrectionEvent
  | SysEvent
  | DeleteEvent
  | RestoreEvent;

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
}

/**
 * One deduction, projected from `deduction_added` and any `deduction_voided`
 * naming it (S29). A void MARKS this — `voided`/`voidReason` — it never
 * removes the entry, so the log stays complete (NFR-3).
 */
export interface Deduction {
  readonly id: string;
  readonly personId: PersonId;
  /** Snapshotted on the event — see `deduction_added`. */
  readonly personName: string;
  readonly satang: number;
  readonly reason: string;
  readonly agreedBy: string;
  readonly voided: boolean;
  readonly voidReason: string | null;
}

export type SaleStatus = 'draft' | 'completed' | 'cancelled';

export interface SaleState {
  readonly id: SaleId;
  /** Soft-deleted (SYNC-10): hidden from the sale list, shown under "deleted". */
  readonly deleted: boolean;
  readonly status: OpenClosed;
  /** Business status (E04-S11). Cancelled keeps its baskets but counts in no cross-sale total. */
  readonly saleStatus: SaleStatus;
  readonly startedTs: number | null;
  readonly parties: {
    readonly farmName: string;
    readonly buyer: string;
    readonly buyerId?: string;
    readonly manager: string;
    readonly managerId?: string;
    readonly note?: string;
    readonly workerLead: string;
    readonly where: 'farm' | 'buyer';
  } | null;
  readonly price: { readonly satangPerKg: number; readonly indexRef: string } | null;
  /** Always on gross (D-12) — see `split_set`. */
  readonly split: { readonly ownerPct: number } | null;
  readonly zones: readonly Zone[];
  readonly piles: readonly Pile[];
  /** FR-12.7 — surfaced as a non-blocking indicator, never a gate. */
  readonly clockSuspect: boolean;
  /** FR-11.11. Defaults on; flipped by `speech_set` events. */
  readonly speechOn: boolean;
  /** In log order. Includes voided ones — settle() is what filters to live. */
  readonly deductions: readonly Deduction[];
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
