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

import { compareEvents } from './order';
import type {
  Deduction,
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
    deductions: [],
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
}

interface MutZone {
  id: ZoneId;
  name: string;
  status: OpenClosed;
  pileIds: ZoneId[];
  contract: ZoneContract | null;
}

/**
 * Pure and total: events are folded in `compareEvents` order, never in
 * timestamp order, so the result does not depend on clocks or on the order
 * rows arrived in. The same event id twice is a programming error upstream
 * (the store dedupes), so this throws rather than guessing.
 */
export function projectSale(events: readonly SaleEvent[], saleId?: string): SaleState {
  const id = saleId ?? events[0]?.saleId ?? '';
  const base = emptySale(id);

  assertUniqueIds(events);
  const ordered = [...events].sort(compareEvents);

  const piles = new Map<PileId, MutPile>();
  const zones = new Map<ZoneId, MutZone>();
  const deductions = new Map<string, Deduction>();

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
        zones.set(payload.zoneId, {
          id: payload.zoneId,
          name: payload.name,
          status: 'open',
          pileIds: [],
          contract: null,
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
        });
        zones.get(payload.zoneId)?.pileIds.push(payload.pileId);
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

      case 'deduction_added':
        deductions.set(payload.deductionId, {
          id: payload.deductionId,
          personId: payload.personId,
          personName: payload.personName,
          satang: payload.satang,
          reason: payload.reason,
          agreedBy: payload.agreedBy,
          voided: false,
          voidReason: null,
        });
        break;

      case 'deduction_voided': {
        // An unresolvable reference is ignored elsewhere in this fold too
        // (e.g. zero_check/tare_confirmed on an unknown pileId) — a void
        // naming a deductionId this log has never seen, or one already
        // voided, changes nothing.
        const d = deductions.get(payload.deductionId);
        if (d && !d.voided) {
          deductions.set(payload.deductionId, { ...d, voided: true, voidReason: payload.reason });
        }
        break;
      }

      case 'announced':
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
      }),
    ),
    clockSuspect,
    speechOn,
    deductions: [...deductions.values()],
  };
}

function assertUniqueIds(events: readonly SaleEvent[]): void {
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) {
      throw new Error(
        `Duplicate event id ${e.id}. The log is the record of what happened; ` +
          `one event cannot appear in it twice.`,
      );
    }
    seen.add(e.id);
  }
}

// ── Guards. Each answers a question the UI asks before offering an action. ──

/** Counting requires a pile that has been made ready, in an open zone and sale. */
export function canCount(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.status !== 'counting') return false;
  if (state.status !== 'open') return false;
  const zone = state.zones.find((z) => z.id === pile.zoneId);
  return zone?.status === 'open';
}

/** Ready requires both pre-count checks to have been performed. */
export function canReady(state: SaleState, pileId: PileId): boolean {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.status !== 'not-started') return false;
  if (state.status !== 'open') return false;
  return pile.zeroChecked && pile.tareConfirmed;
}

/**
 * A closed sale is a hard boundary: nothing beneath it reopens until the sale
 * itself does. Without this, "the sale is settled" would mean nothing.
 */
export function canReopenPile(state: SaleState, pileId: PileId): boolean {
  if (state.status !== 'open') return false;
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile || pile.status !== 'closed') return false;
  const zone = state.zones.find((z) => z.id === pile.zoneId);
  return zone?.status === 'open';
}

/** Piles still counting when a zone closes — named in the warning, then forced. */
export function pilesStillCounting(state: SaleState, zoneId: ZoneId): readonly Pile[] {
  return state.piles.filter((p) => p.zoneId === zoneId && p.status === 'counting');
}

/**
 * The outcome of the most recent `announced` event, or `null` before any
 * attempt has been made. Drives the counter's degraded-speech pill (S10,
 * FR-11.10) — derived from the log rather than kept as separate React state,
 * the same reasoning as everything else in this module: one fold, one place
 * to be wrong.
 */
export function lastAnnounceOk(events: readonly SaleEvent[]): boolean | null {
  let latest: { e: SaleEvent; ok: boolean } | null = null;
  for (const e of events) {
    if (e.kind === 'sys' && e.payload.t === 'announced' && (!latest || compareEvents(e, latest.e) > 0)) {
      latest = { e, ok: e.payload.ok };
    }
  }
  return latest?.ok ?? null;
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
