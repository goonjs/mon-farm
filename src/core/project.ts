/**
 * Folds the event log into current state.
 *
 * There is no `piles` table and no `zones` table. Entities, statuses and every
 * rollup are projections of the log — one fold, one place to be wrong. A stored
 * `pile.status` would need invalidating on close, on reopen, on zone close and
 * on sale close, and each of those is a chance for the app to assert something
 * the record does not support.
 *
 * Implements the transition table in `docs/ux/pile-zone-sale-lifecycle.md` §8.
 */

import type {
  OpenClosed,
  Pile,
  PileId,
  SaleEvent,
  SaleState,
  SysEvent,
  Zone,
  ZoneContract,
  ZoneId,
} from './types';

/** A wall clock that moves more than this between two events is not credible. */
const IMPLAUSIBLE_JUMP_MS = 6 * 60 * 60 * 1000;

export function emptySale(id: string): SaleState {
  return {
    id,
    status: 'open',
    startedTs: null,
    parties: null,
    price: null,
    split: null,
    zones: [],
    piles: [],
    clockSuspect: false,
    speechOn: true,
  };
}

interface MutPile {
  id: PileId;
  zoneId: ZoneId;
  name: string;
  tareG: number;
  stdNetG: number;
  status: Pile['status'];
  zeroChecked: boolean;
  tareConfirmed: boolean;
  locked: boolean;
  removed: boolean;
}

interface MutZone {
  id: ZoneId;
  name: string;
  status: OpenClosed;
  pileIds: ZoneId[];
  contract: ZoneContract | null;
  removed: boolean;
}

/**
 * Pure, total, and order-defining: events are folded in `seq` order, never in
 * timestamp order. An event with an out-of-order `seq` is a programming error
 * upstream, so this throws rather than guessing.
 */
export function projectSale(events: readonly SaleEvent[], saleId?: string): SaleState {
  const id = saleId ?? events[0]?.saleId ?? '';
  const base = emptySale(id);

  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  assertSequence(ordered);

  const piles = new Map<PileId, MutPile>();
  const zones = new Map<ZoneId, MutZone>();

  let status: OpenClosed = base.status;
  let startedTs: number | null = null;
  let parties = base.parties;
  let price = base.price;
  let split = base.split;
  let clockSuspect = false;
  let speechOn = base.speechOn;

  for (const e of ordered) {
    // Baskets and rejections carry no state beyond the totals, except that the
    // first basket in a pile locks its configuration.
    if (e.kind === 'accept' || e.kind === 'short') {
      const p = piles.get(e.pileId);
      if (p) p.locked = true;
      continue;
    }
    if (e.kind === 'reject' || e.kind === 'correction') continue;

    const { payload } = e as SysEvent;

    switch (payload.t) {
      case 'sale_started':
        startedTs = e.ts;
        parties = {
          farmName: payload.farmName,
          buyer: payload.buyer,
          manager: payload.manager,
          workerLead: payload.workerLead,
          where: payload.where,
        };
        break;

      case 'price_set':
        price = { satangPerKg: payload.satangPerKg, indexRef: payload.indexRef };
        break;

      case 'split_set':
        split = { ownerPct: payload.ownerPct, basis: payload.basis };
        break;

      case 'zone_added':
        // Same rule as `pile_added` below: an id the log already knows is
        // never re-created from scratch.
        if (zones.has(payload.zoneId)) break;
        zones.set(payload.zoneId, {
          id: payload.zoneId,
          name: payload.name,
          status: 'open',
          pileIds: [],
          contract: null,
          removed: false,
        });
        break;

      case 'zone_contract_set': {
        const z = zones.get(payload.zoneId);
        if (z) {
          z.contract = {
            personId: payload.personId,
            workerName: payload.workerName,
            ownerPct: payload.ownerPct,
          };
        }
        break;
      }

      case 'zone_contract_cleared': {
        const z = zones.get(payload.zoneId);
        if (z) z.contract = null;
        break;
      }

      case 'pile_added': {
        // Never overwrites an existing pile. A `pile_added` naming an id the
        // log already knows is either an upstream id collision or an attempt
        // to bring a removed pile back by re-adding it, and neither may quietly
        // reset a pile's history — S26 is explicit that the way back in is a
        // new pile with a new id.
        if (piles.has(payload.pileId)) break;
        piles.set(payload.pileId, {
          id: payload.pileId,
          zoneId: payload.zoneId,
          name: payload.name,
          tareG: payload.tareG,
          stdNetG: payload.stdNetG,
          status: 'not-started',
          zeroChecked: false,
          tareConfirmed: false,
          locked: false,
          removed: false,
        });
        zones.get(payload.zoneId)?.pileIds.push(payload.pileId);
        break;
      }

      /**
       * S26. The name always applies; the weights apply only while the pile
       * is unlocked.
       *
       * That second half is the fold's own enforcement of FR-3.4, not a
       * duplicate of `canEditPileNet`'s. The guard stops the UI writing such
       * an event; this stops one that got into the log anyway — by a direct
       * append, a future screen, or a bug — from moving money that has
       * already been agreed out loud. Every `accept` snapshots the net it was
       * counted at, so the past is safe either way; what this protects is the
       * pile's live config, which is what the NEXT basket would be counted
       * against.
       */
      case 'pile_edited': {
        const p = piles.get(payload.pileId);
        if (p) {
          p.name = payload.name;
          if (!p.locked) {
            p.tareG = payload.tareG;
            p.stdNetG = payload.stdNetG;
          }
        }
        break;
      }

      // Retired, not deleted — see the payload's own note in types.ts. There
      // is no un-remove event, so this flag only ever goes one way.
      case 'pile_removed': {
        const p = piles.get(payload.pileId);
        if (p) p.removed = true;
        break;
      }

      case 'zone_edited': {
        const z = zones.get(payload.zoneId);
        if (z) z.name = payload.name;
        break;
      }

      case 'zone_removed': {
        const z = zones.get(payload.zoneId);
        if (z) z.removed = true;
        break;
      }

      case 'zero_check': {
        const p = piles.get(payload.pileId);
        // A failed check still counts as *checked*: it was performed and its
        // result recorded. Blocking here would put the app in charge of a
        // judgement that belongs to the person standing at the scale.
        if (p) p.zeroChecked = true;
        break;
      }

      case 'tare_confirmed': {
        const p = piles.get(payload.pileId);
        if (p) {
          p.tareG = payload.tareG;
          p.tareConfirmed = true;
        }
        break;
      }

      case 'ready': {
        const p = piles.get(payload.pileId);
        if (p) p.status = 'counting';
        break;
      }

      case 'pile_closed': {
        const p = piles.get(payload.pileId);
        if (p) p.status = 'closed';
        break;
      }

      case 'pile_reopened': {
        const p = piles.get(payload.pileId);
        if (p) p.status = 'counting';
        break;
      }

      case 'zone_closed': {
        const z = zones.get(payload.zoneId);
        if (z) z.status = 'closed';
        // Force-closing the zone force-closes any pile still counting in it.
        for (const pid of payload.forcedPiles) {
          const p = piles.get(pid);
          if (p) p.status = 'closed';
        }
        break;
      }

      case 'zone_reopened': {
        const z = zones.get(payload.zoneId);
        if (z) z.status = 'open';
        // Deliberately does NOT cascade into its closed piles. Reopening a zone
        // means "more piles may be added or reopened here", not "undo
        // everything that was agreed in it".
        break;
      }

      case 'sale_closed':
        status = 'closed';
        break;

      case 'sale_reopened':
        status = 'open';
        break;

      case 'clock_anomaly':
        clockSuspect = true;
        break;

      case 'announced':
        break;

      // Evidence only: the gate was skipped, and skipping it must not look
      // like passing it. See the payload's own note in types.ts.
      case 'bulk_gate_skipped':
        break;

      case 'speech_set':
        speechOn = payload.on;
        break;
    }
  }

  return {
    id,
    status,
    startedTs,
    parties,
    price,
    split,
    zones: [...zones.values()].map(
      (z): Zone => ({
        id: z.id,
        name: z.name,
        status: z.status,
        pileIds: [...z.pileIds],
        contract: z.contract,
        removed: z.removed,
      }),
    ),
    piles: [...piles.values()].map(
      (p): Pile => ({
        id: p.id,
        zoneId: p.zoneId,
        name: p.name,
        tareG: p.tareG,
        stdNetG: p.stdNetG,
        status: p.status,
        zeroChecked: p.zeroChecked,
        tareConfirmed: p.tareConfirmed,
        locked: p.locked,
        removed: p.removed,
      }),
    ),
    clockSuspect,
    speechOn,
  };
}

function assertSequence(ordered: readonly SaleEvent[]): void {
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].seq === ordered[i - 1].seq) {
      throw new Error(
        `Duplicate sequence number ${ordered[i].seq}. The log is the record of ` +
          `what happened; two events cannot occupy one position in it.`,
      );
    }
  }
}

// ── Guards. Each answers a question the UI asks before offering an action. ──

/** Counting requires a pile that has been made ready, in an open zone and sale. */
export function canCount(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.removed || pile.status !== 'counting') return false;
  if (state.status !== 'open') return false;
  const zone = state.zones.find((z) => z.id === pile.zoneId);
  return zone?.status === 'open';
}

/** Ready requires both pre-count checks to have been performed. */
export function canReady(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.removed || pile.status !== 'not-started') return false;
  if (state.status !== 'open') return false;
  return pile.zeroChecked && pile.tareConfirmed;
}

/**
 * Bulk entry (S23) — the one deliberate way past the zero/tare gate.
 *
 * The same status question `canReady` asks, minus the two checks: a pile
 * entered from a tally has no scale reading to check, so requiring
 * `zeroChecked`/`tareConfirmed` here would demand a record of something
 * nobody did. Everything else is identical, because everything else is about
 * whether this pile is still open for numbers at all.
 */
export function canBulkEnter(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.removed || pile.status !== 'not-started') return false;
  if (state.status !== 'open') return false;
  const zone = state.zones.find((z) => z.id === pile.zoneId);
  return zone?.status === 'open';
}

/**
 * The piles whose numbers were entered in bulk rather than watched (S23).
 *
 * Derived at read time from the presence of a `bulk_gate_skipped` event,
 * deliberately not projected onto `Pile`: the marker is a fact about the log,
 * and a projected flag would be a second place for it to be wrong.
 */
export function bulkEnteredPileIds(events: readonly SaleEvent[]): ReadonlySet<PileId> {
  const out = new Set<PileId>();
  for (const e of events) {
    if (e.kind === 'sys' && e.payload.t === 'bulk_gate_skipped') out.add(e.payload.pileId);
  }
  return out;
}

/**
 * A closed sale is a hard boundary: nothing beneath it reopens until the sale
 * itself does. Without this, "the sale is settled" would mean nothing.
 */
export function canReopenPile(state: SaleState, pileId: PileId): boolean {
  if (state.status !== 'open') return false;
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.removed || pile.status !== 'closed') return false;
  const zone = state.zones.find((z) => z.id === pile.zoneId);
  return zone?.status === 'open';
}

/** Piles still counting when a zone closes — named in the warning, then forced. */
export function pilesStillCounting(state: SaleState, zoneId: ZoneId): readonly Pile[] {
  return state.piles.filter((p) => p.zoneId === zoneId && !p.removed && p.status === 'counting');
}

// ── S26. Editing and removing what was set up. ──────────────────────────────

/**
 * The piles that have been retired (S26), read straight off the log.
 *
 * Derived here rather than taken from `state.piles` so the rollups in
 * `totals.ts` — which are handed a log, not always a state — cannot forget to
 * apply it. There is no un-remove event, so this set only ever grows: a
 * `pile_removed` at any position in the log means the same thing as one at
 * the end, and the derived set can never disagree with the projected
 * `Pile.removed` about ordering.
 */
export function removedPileIds(events: readonly SaleEvent[]): ReadonlySet<PileId> {
  const out = new Set<PileId>();
  for (const e of events) {
    if (e.kind === 'sys' && e.payload.t === 'pile_removed') out.add(e.payload.pileId);
  }
  return out;
}

/**
 * FR-3.4, as a question the UI has to ask before offering the tare/std
 * fields: may this pile's weights still be changed?
 *
 * A rename is deliberately not covered — a name carries no money and is
 * editable at any status, locked or not. What locks here is only what the
 * next basket would be counted against.
 */
export function canEditPileNet(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.removed) return false;
  return !pile.locked;
}

/**
 * Which of the two removal paths this pile gets: one tap, or a typed reason.
 *
 * Asked of the LOG, not of the pile's current status or totals. A basket that
 * was counted and then voided still means someone counted into this pile, and
 * removing it is still a statement about numbers that were said out loud — so
 * it earns the S12 void register, not a one-tap confirm. A pile whose baskets
 * were all entered in bulk (S23) is no different: they are baskets.
 */
export function pileNeedsVoidReason(events: readonly SaleEvent[], pileId: PileId): boolean {
  return events.some((e) => (e.kind === 'accept' || e.kind === 'short') && e.pileId === pileId);
}

/**
 * A zone is emptied of piles before it can be removed — never cascaded.
 *
 * "Empty" means no pile under it that has not itself been removed. The
 * alternative, removing a zone and sweeping its piles away with it, would
 * decide on the operator's behalf that every one of those piles was a
 * mistake, when each is its own statement with its own reason. Nothing in the
 * story or the epic asks for a cascade, so there is not one (YAGNI).
 */
export function canRemoveZone(state: SaleState, zoneId: ZoneId): boolean {
  const zone = state.zones.find((z) => z.id === zoneId);
  if (!zone || zone.removed) return false;
  return !state.piles.some((p) => p.zoneId === zoneId && !p.removed);
}

/**
 * The pile rule, one level up: a zone that never held a pile is a typo and
 * goes in one tap; a zone whose piles had to be removed to empty it is a real
 * part of the sale being retired, and says why.
 */
export function zoneNeedsVoidReason(state: SaleState, zoneId: ZoneId): boolean {
  return state.piles.some((p) => p.zoneId === zoneId);
}

/**
 * The outcome of the most recent `announced` event, or `null` before any
 * attempt has been made. Drives the counter's degraded-speech pill (S10,
 * FR-11.10) — derived from the log rather than kept as separate React state,
 * the same reasoning as everything else in this module: one fold, one place
 * to be wrong.
 */
export function lastAnnounceOk(events: readonly SaleEvent[]): boolean | null {
  let result: boolean | null = null;
  let atSeq = -Infinity;
  for (const e of events) {
    if (e.kind === 'sys' && e.payload.t === 'announced' && e.seq > atSeq) {
      result = e.payload.ok;
      atSeq = e.seq;
    }
  }
  return result;
}

/**
 * FR-12.6. Returns the anomaly to record, or null.
 *
 * Note what this does NOT do: it never reorders anything. A wrong clock is
 * flagged and displayed; `seq` still decides what happened first.
 */
export function detectClockAnomaly(
  prev: SaleEvent | null,
  ts: number,
  startedTs: number | null,
): { anomaly: 'backwards' | 'before-sale-start' | 'implausible-jump'; deltaMs: number } | null {
  if (startedTs !== null && ts < startedTs) {
    return { anomaly: 'before-sale-start', deltaMs: ts - startedTs };
  }
  if (prev) {
    const delta = ts - prev.ts;
    if (delta < 0) return { anomaly: 'backwards', deltaMs: delta };
    if (delta > IMPLAUSIBLE_JUMP_MS) return { anomaly: 'implausible-jump', deltaMs: delta };
  }
  return null;
}
