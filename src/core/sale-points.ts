/**
 * The sale model on weighing points (E04-S01): baskets are recorded at any
 * point, any farm, in any order, each with a number fixed when it is
 * recorded (SALE-10), and totals roll up by point, tapper, farm and sale.
 *
 * Additive to the pile model (S3/S4): a point-based basket is an ordinary
 * `accept`/`short` event that also carries `pointId` and `basketNo`, so the
 * existing liveness rules (voids, Soft Delete) and `basketNetG` apply as is.
 * All weights are integer grams (NFR-3).
 */

import { basketGroups, openBasketIn, stdNetOfLog } from './bridge';
import { activePoints, tapperOn, type BasketPair, type MasterState, type PointRecord } from './master';
import { compareEvents } from './order';
import { ZERO_TOTALS, addTotals, basketNetG, liveBaskets } from './totals';
import type { BasketEvent, NumberingMode, PersonId, SaleEvent, SaleState, SysPayload, Totals } from './types';

export type TapperOf = (pointId: string) => PersonId | null;

/**
 * Which number sequence a basket at `pointId` belongs to: its tapper's
 * (mode a, D-79) or its point's (mode b, D-46). A point with no tapper on the
 * day counts on its own, so it can never borrow someone else's numbers.
 */
function sequenceOf(pointId: string, mode: NumberingMode, tapperOf: TapperOf): string {
  const tapper = mode === 'per-tapper' ? tapperOf(pointId) : null;
  return tapper ? `t:${tapper}` : `p:${pointId}`;
}

/** Whether two points number their baskets in one sequence (review S1: a move stays inside it). */
export function sameSequence(a: string, b: string, mode: NumberingMode, tapperOf: TapperOf): boolean {
  return sequenceOf(a, mode, tapperOf) === sequenceOf(b, mode, tapperOf);
}

/**
 * The number the next basket at `pointId` gets: one above the highest in its
 * sequence. Voided and deleted baskets still hold their number — the gap
 * shows (E04-S09). Only an undone last basket gives its number back.
 */
export function nextBasketNo(events: readonly SaleEvent[], pointId: string, mode: NumberingMode, tapperOf: TapperOf): number {
  const seq = sequenceOf(pointId, mode, tapperOf);
  // An undone basket hands its number back (owner 2026-10-03, E04-S09).
  const undone = undoneIds(events);
  let max = 0;
  for (const e of events) {
    if ((e.kind !== 'accept' && e.kind !== 'short') || !e.pointId || e.basketNo === undefined) continue;
    if (undone.has(e.id)) continue;
    if (sequenceOf(e.pointId, mode, tapperOf) === seq) max = Math.max(max, e.basketNo);
  }
  return max + 1;
}

/** The sale's numbering mode: the last `numbering_set` in fold order, else the group default. */
export function saleNumbering(events: readonly SaleEvent[], groupDefault: NumberingMode): NumberingMode {
  let mode = groupDefault;
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind === 'sys' && e.payload.t === 'numbering_set') mode = e.payload.numbering;
  }
  return mode;
}

export interface SaleRollup {
  readonly byPoint: ReadonlyMap<string, Totals>;
  /** Keyed by the point's tapper on the sale day (SALE-4). */
  readonly byTapper: ReadonlyMap<PersonId, Totals>;
  readonly byFarm: ReadonlyMap<string, Totals>;
  /** Baskets at a point with no tapper that day — shown, never dropped (D-63). */
  readonly unassigned: Totals;
  readonly sale: Totals;
}

function one(b: BasketEvent): Totals {
  const netG = basketNetG(b);
  const standard = b.kind === 'accept';
  return {
    baskets: 1,
    standardBaskets: standard ? 1 : 0,
    shortBaskets: standard ? 0 : 1,
    netG,
    standardNetG: standard ? netG : 0,
    shortNetG: standard ? 0 : netG,
  };
}

function bump(map: Map<string, Totals>, key: string, t: Totals) {
  map.set(key, addTotals(map.get(key) ?? ZERO_TOTALS, t));
}

/**
 * Live point-based baskets of the sale, rolled up. Every level is a sum of
 * the same per-basket figures, so they agree to the gram whichever numbering
 * mode the sale used — money is settled on weight, never on numbers.
 */
export function saleRollup(events: readonly SaleEvent[], master: MasterState, saleDay: string): SaleRollup {
  const farmOf = new Map(master.points.map((p) => [p.id, p.propertyId]));
  const byPoint = new Map<string, Totals>();
  const byTapper = new Map<PersonId, Totals>();
  const byFarm = new Map<string, Totals>();
  let unassigned = ZERO_TOTALS;
  let sale = ZERO_TOTALS;
  for (const b of liveBaskets(events)) {
    if (!b.pointId) continue;
    const t = one(b);
    bump(byPoint, b.pointId, t);
    const tapper = tapperOn(master, b.pointId, saleDay);
    if (tapper) bump(byTapper, tapper, t);
    else unassigned = addTotals(unassigned, t);
    const farm = farmOf.get(b.pointId);
    if (farm) bump(byFarm, farm, t);
    sale = addTotals(sale, t);
  }
  return { byPoint, byTapper, byFarm, unassigned, sale };
}

export interface RecorderFigures {
  /** Whose figures these are: the tapper's sequence (D-79) or the point's own (D-46). */
  readonly scope: { readonly tapperId: PersonId } | { readonly pointId: string };
  /** The basket being weighed now — the number the next hold records. */
  readonly currentNo: number;
  readonly done: number;
  readonly netG: number;
  /** What the open short basket of the scope holds so far (E04-S06); null when none is open. */
  readonly openShortG: number | null;
  /** How much it still lacks to be full: "เหลือเติม" (E04-S06). */
  readonly missingG: number | null;
  /** The open short basket's first part, when one is open. */
  readonly openId: string | null;
  /** Money at the sale's price (D-40); null while no price is set. */
  readonly satang: number | null;
  /** The scope's last live basket — what "ย้อนกลับ" undoes (E04-S09). */
  readonly lastId: string | null;
}

/**
 * The figures the recorder screen keeps in view at `pointId` (E04-S05,
 * SALE-14): the same sequence `nextBasketNo` numbers in, so the big number,
 * "done" and kg always agree with one another.
 */
export function recorderFigures(
  events: readonly SaleEvent[],
  master: MasterState,
  saleDay: string,
  pointId: string,
  mode: NumberingMode,
  satangPerKg: number | null,
): RecorderFigures {
  const tapperOf: TapperOf = (id) => tapperOn(master, id, saleDay);
  const seq = sequenceOf(pointId, mode, tapperOf);
  const mine = liveBaskets(events)
    .filter((b) => b.pointId && sequenceOf(b.pointId, mode, tapperOf) === seq)
    .sort(compareEvents);
  const netG = mine.reduce((sum, b) => sum + basketNetG(b), 0);
  // An open short basket is the one being worked on (E04-S06): its number stays current.
  const open = openBasketIn(events, master, saleDay, pointId, mode, stdNetOfLog(events));
  // The last basket is the highest number (fold order breaks ties), not the
  // newest event: an edit re-records an old number later in the log.
  const last = mine.reduce<BasketEvent | undefined>((top, b) => (!top || (b.basketNo ?? 0) >= (top.basketNo ?? 0) ? b : top), undefined);
  const tapperId = tapperOf(pointId);
  return {
    scope: seq.startsWith('t:') && tapperId ? { tapperId } : { pointId },
    currentNo: open ? open.basketNo : nextBasketNo(events, pointId, mode, tapperOf),
    // One basket per number: later parts of a bridged basket and the open one are not "done".
    done: mine.filter((b) => !b.partOf && b.id !== open?.rootId).length,
    netG,
    openShortG: open ? open.haveG : null,
    missingG: open ? open.missingG : null,
    openId: open?.rootId ?? null,
    satang: satangPerKg === null ? null : Math.floor((2 * netG * satangPerKg + 1000) / 2000),
    lastId: last?.id ?? null,
  };
}

export interface PointChoices {
  /** Points grouped under their tapper on the sale day, in point-name order (E04-S02). */
  readonly byTapper: readonly { tapperId: PersonId; points: readonly PointRecord[] }[];
  /** Points with no tapper that day: weighable, shown apart with a warning (D-63, D-70). */
  readonly unassigned: readonly PointRecord[];
}

export function pointChoices(master: MasterState, propertyId: string, saleDay: string): PointChoices {
  const byTapper = new Map<PersonId, PointRecord[]>();
  const unassigned: PointRecord[] = [];
  for (const p of activePoints(master, propertyId)) {
    const tapper = tapperOn(master, p.id, saleDay);
    if (!tapper) unassigned.push(p);
    else byTapper.set(tapper, [...(byTapper.get(tapper) ?? []), p]);
  }
  return { byTapper: [...byTapper].map(([tapperId, points]) => ({ tapperId, points })), unassigned };
}

/**
 * What to append so the sale can weigh at `pointId` with today's counter: its
 * farm as a zone and the point as a pile, each once, keyed by their master
 * ids, carrying the default net + basket weight as the pile's snapshot
 * (MD-7). Additive — the pile counter stays the one way to record baskets.
 */
export function pointSetupPayloads(sale: SaleState, master: MasterState, pointId: string, pair: BasketPair): SysPayload[] {
  const point = master.points.find((p) => p.id === pointId);
  const farm = point && master.properties.find((f) => f.id === point.propertyId);
  if (!point || !farm) return [];
  const out: SysPayload[] = [];
  if (!sale.zones.some((z) => z.id === farm.id)) out.push({ t: 'zone_added', zoneId: farm.id, name: farm.name });
  if (!sale.piles.some((p) => p.id === point.id)) {
    out.push({ t: 'pile_added', pileId: point.id, zoneId: farm.id, name: point.name, tareG: pair.basketG, stdNetG: pair.netG });
  }
  return out;
}

/** A weight as typed (kg, up to 3 decimals) → integer grams; null if not a weight > 0. */
export function parseKgG(text: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(text.trim());
  if (!m) return null;
  const g = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  return g > 0 ? g : null;
}

/** A price as typed (฿/kg, up to 2 decimals) → integer satang; blank = not set yet (SALE-3). */
export function parsePrice(text: string): { ok: true; satang: number | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, satang: null };
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return { ok: false };
  const satang = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return satang > 0 ? { ok: true, satang } : { ok: false };
}

function undoneIds(events: readonly SaleEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) if (e.kind === 'correction' && e.mode === 'undo-last') out.add(e.targetId);
  return out;
}

export interface BasketRow {
  readonly id: string;
  readonly basketNo: number;
  readonly pointId: string;
  readonly netG: number;
  readonly short: boolean;
  /**
   * Voided rows stay in the list, struck through (SALE-17). `undone` rows (the
   * last basket taken back) are only listed on request, for the audit view (E04-S15).
   */
  readonly status: 'live' | 'voided' | 'undone';
  /** When an undone basket was taken back. */
  readonly undoneTs?: number;
  /** A later part that topped up a short basket (listed only when it was taken back, E04-S15). */
  readonly part?: boolean;
  /** Re-recorded from the list (E04-S09); the replaced basket stays in the log only. */
  readonly edited: boolean;
  /** Who recorded this row — the device and when (SYNC-9). */
  readonly by: { readonly deviceId: string; readonly ts: number };
  /** A basket made of parts at several points: each part's net, "(20 + 30)" (E04-S06). */
  readonly partsG?: readonly number[];
  /** Entered afterwards as a point total (E04-S10): "บันทึกย้อนหลัง". */
  readonly backfill?: boolean;
  /** A short basket weighed on its own: what the scale read and the basket's weight (E04-S15 "22 − 2 = 20"). */
  readonly reading?: { readonly readingG: number; readonly tareG: number };
}

/**
 * The sale's point baskets for the recorder's list, newest first (E04-S09):
 * live and voided rows; an undone basket drops out (its number is used
 * again) and an edited one shows as its replacement.
 */
export function basketList(events: readonly SaleEvent[], opts: { withUndone?: boolean } = {}): readonly BasketRow[] {
  const live = new Set(liveBaskets(events).map((b) => b.id));
  const undone = undoneIds(events);
  const undoneAt = new Map<string, number>();
  for (const e of events) if (e.kind === 'correction' && e.mode === 'undo-last') undoneAt.set(e.targetId, e.ts);
  const groups = basketGroups(events, stdNetOfLog(events));
  const replaced = new Set<string>();
  // Only a replacement still standing hides its original; an undone edit gives the row back.
  for (const e of events) if ((e.kind === 'accept' || e.kind === 'short') && e.editOf && !undone.has(e.id)) replaced.add(e.editOf);
  const rows: BasketRow[] = [];
  for (const e of [...events].sort(compareEvents).reverse()) {
    if ((e.kind !== 'accept' && e.kind !== 'short') || !e.pointId || e.basketNo === undefined) continue;
    const wasUndone = undone.has(e.id);
    if ((wasUndone && !opts.withUndone) || replaced.has(e.id) || (e.partOf && !wasUndone)) continue;
    const group = groups.get(e.id);
    const bridged = !wasUndone && group && group.parts.length > 1 ? group : null;
    rows.push({
      id: e.id,
      basketNo: e.basketNo,
      pointId: e.pointId,
      netG: bridged ? bridged.netG : basketNetG(e),
      short: bridged ? bridged.status !== 'full' : e.kind === 'short',
      ...(bridged ? { partsG: bridged.partsG } : {}),
      ...((e.kind === 'accept' && e.input === 'backfill') || (e.kind === 'short' && e.backfill) ? { backfill: true } : {}),
      ...(e.kind === 'short' && !bridged ? { reading: { readingG: e.readingG, tareG: e.tareG } } : {}),
      status: wasUndone ? 'undone' : live.has(e.id) ? 'live' : 'voided',
      ...(wasUndone ? { undoneTs: undoneAt.get(e.id) } : {}),
      ...(e.partOf ? { part: true } : {}),
      edited: !!e.editOf,
      by: { deviceId: e.actor.deviceId, ts: e.ts },
    });
  }
  return rows;
}
