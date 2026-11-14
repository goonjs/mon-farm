/**
 * E16 · fertilizing (ใส่ปุ๋ย) — fertilizer stock per card, the sacks each
 * fertilizing draws, their cost, and the tappers' debts from it.
 *
 * Model (solution architect 2026-11-13, story E16-S02 "Offline / sync"):
 *
 *   stock in  = fertilizer order items that are delivered ("ได้ของแล้ว") and
 *               dated on or after STOCK_CUTOFF (older ones count as used up, D-96)
 *   card      = items of one type (type/formula/brand/sack kg) and one net
 *               price per sack (D-92) — what the screen shows as one card
 *   stock out = live fertilizings, in (date, id) order; each line draws its
 *               sacks oldest item first from the card(s) its `sources` are on
 *
 * Nothing is stored but the fertilizing event: draws, cost, stock and debts
 * are recomputed from the log, so every device folds the same answer and an
 * edit at the source order (price, stage, delete) moves them with it. An
 * expense event is never rewritten.
 *
 * Pure functions only. Money is integer satang.
 */

import { fertilizerSplit, foldRecordPublic, type Expense, type FieldConflict } from './ledger';
import type { EventId } from '../types';
import type { DebtFields, FertilizingFields, FertilizingLine, FertilizerType, FinanceEvent, Payer } from './types';

/** Items dated before this day count as used up, never as stock (D-96 (1), FL-4). */
export const STOCK_CUTOFF = '2026-10-01';
/** Only for a record that somehow lacks a %: the writer always stores one per taker from the category (review S2, `pct-missing`). */
export const DEFAULT_TAPPER_PCT = 50;
/** A fertilizing debt's id is `<fzId>:<workerId>` (one lump per worker per fertilizing, SP-8). */
export const FERTILIZING_DEBT_INFIX = ':';

const FERTILIZING_GUARDED = ['lines', 'pct', 'settle', 'zones', 'deleted'] as const;

/** R(k) = floor((2Mk + N) / 2N): the cost of the first k sacks of an item (net M, N sacks), half up, exact to the satang. */
const upTo = (netSatang: number, sacks: number, k: number) => Math.floor((2 * netSatang * k + sacks) / (2 * sacks));

/** The cost of sacks [from, to) of an item. Draws of one item add up to its net; past N the rate stays the same (over-use). */
export function drawCost(netSatang: number, sacks: number, from: number, to: number): number {
  return upTo(netSatang, sacks, to) - upTo(netSatang, sacks, from);
}

// ── Cards (stock in) ────────────────────────────────────────────────────────

export interface StockItem {
  readonly expenseId: string;
  readonly orderId: string | null;
  readonly date: string;
  readonly sacks: number;
  readonly netSatang: number;
  readonly shop: string;
}

export interface FertilizerCard {
  /** type, formula, brand, sack kg and the net price per sack as a reduced fraction. */
  readonly key: string;
  readonly type: FertilizerType;
  readonly formula: string;
  readonly brand: string;
  readonly sackKg: number | null;
  /** Net price per sack, half up to the satang — for display; draws use the exact fraction. */
  readonly perSackSatang: number;
  /** Oldest first (date, then id). */
  readonly items: readonly StockItem[];
  readonly shops: readonly string[];
  readonly deliveredSacks: number;
  /** Sacks the live fertilizings draw (over-use included). */
  readonly usedSacks: number;
  /** delivered − used; negative = used more than delivered (FL-3). */
  readonly leftSacks: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const sacksOf = (x: Expense): number | null => x.fertilizer?.sacks ?? x.line?.qty ?? x.share?.totalSacks ?? null;

const isFertilizerItem = (x: Expense) => !x.deleted && !!x.fertilizer && x.categoryId === 'cat-fertilizer';

const oldestFirst = (a: StockItem, b: StockItem) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.expenseId < b.expenseId ? -1 : a.expenseId > b.expenseId ? 1 : 0);

/** The stock cards before any fertilizing draws from them (`usedSacks` 0). Ordered by their oldest item. */
export function fertilizerCards(expenses: readonly Expense[]): FertilizerCard[] {
  const groups = new Map<string, { head: Expense; items: StockItem[] }>();
  for (const x of expenses) {
    if (!isFertilizerItem(x) || x.stage !== 'actual' || x.date < STOCK_CUTOFF) continue;
    const sacks = sacksOf(x);
    if (x.amountSatang === null || !sacks || sacks < 1) continue;
    const f = x.fertilizer!;
    const g = gcd(x.amountSatang, sacks) || 1;
    const key = JSON.stringify([f.type, f.formula.trim(), f.brand.trim(), f.sackKg, x.amountSatang / g, sacks / g]);
    const group = groups.get(key) ?? { head: x, items: [] };
    group.items.push({ expenseId: x.id, orderId: x.orderId ?? null, date: x.date, sacks, netSatang: x.amountSatang, shop: f.shop });
    groups.set(key, group);
  }
  const cards = [...groups].map(([key, { head, items }]): FertilizerCard => {
    const sorted = [...items].sort(oldestFirst);
    const delivered = sorted.reduce((s, i) => s + i.sacks, 0);
    const f = head.fertilizer!;
    return {
      key,
      type: f.type,
      formula: f.formula,
      brand: f.brand,
      sackKg: f.sackKg,
      perSackSatang: upTo(sorted[0].netSatang, sorted[0].sacks, 1),
      items: sorted,
      shops: [...new Set(sorted.map((i) => i.shop).filter(Boolean))],
      deliveredSacks: delivered,
      usedSacks: 0,
      leftSacks: delivered,
    };
  });
  return cards.sort((a, b) => oldestFirst(a.items[0], b.items[0]));
}

// ── Fertilizings (stock out) ────────────────────────────────────────────────

export interface Draw {
  readonly expenseId: string;
  readonly sacks: number;
  readonly costSatang: number;
}

export interface ProjectedLine extends FertilizingLine {
  /** Formula of the line's first source, for the debt note ("ดีเกลือ 40 ถุง"). */
  readonly label: string;
  readonly draws: readonly Draw[];
  /** Σ draws — the cost of the sacks actually drawn. */
  readonly costSatang: number;
  /** Sacks waiting for a source that went back to "สั่งไว้": no cost yet, not over-use. */
  readonly waitingSacks: number;
  /** Sacks past the card's delivered stock — kept, priced at the same rate, flagged (FL-3). */
  readonly overSacks: number;
  /** No live delivered source left at all (deleted, or dated before the cutoff). */
  readonly orphaned: boolean;
  readonly cardKeys: readonly string[];
}

export interface Fertilizing extends Omit<FertilizingFields, 'lines'> {
  readonly id: string;
  readonly deleted: boolean;
  readonly lines: readonly ProjectedLine[];
  /** Σ over-use sacks of its lines. */
  readonly over: number;
  readonly waiting: number;
  /** A line now draws from 2+ cards, or 2 lines share a card (a source price was edited elsewhere). */
  readonly regrouped: boolean;
  /** A source order's price was changed after this fertilizing was recorded, so its cost was worked out again (SP-10). */
  readonly repriced: boolean;
  readonly conflicts: readonly FieldConflict[];
  /** Every state the record has been in, oldest first — for "ever owed" voided debts. */
  readonly history: readonly (FertilizingFields & { readonly deleted: boolean })[];
  readonly headEventId: EventId;
}

export interface FertilizingProjection {
  /** Newest date first, then id. Deleted ones included (GC-5 restore). */
  readonly records: readonly Fertilizing[];
  readonly cards: readonly FertilizerCard[];
}

type FzState = FertilizingFields & { deleted: boolean };

function foldFertilizings(events: readonly FinanceEvent[]) {
  const byTarget = new Map<string, FinanceEvent[]>();
  for (const e of events) {
    if (e.payload.t !== 'fertilizing_recorded' && e.payload.t !== 'fertilizing_changed') continue;
    const list = byTarget.get(e.targetId) ?? [];
    list.push(e);
    byTarget.set(e.targetId, list);
  }
  const out: { id: string; state: FzState; history: readonly FzState[]; conflicts: readonly FieldConflict[]; head: EventId }[] = [];
  for (const [id, evs] of byTarget) {
    const f = foldRecordPublic<FzState>(evs, (c) => ({ ...(c.payload as { fields: FertilizingFields }).fields, deleted: false }), FERTILIZING_GUARDED);
    if (f) out.push({ id, state: f.state, history: f.history, conflicts: f.conflicts, head: f.head });
  }
  return out;
}

const byDateThenId = (a: { id: string; state: { date: string } }, b: { id: string; state: { date: string } }) =>
  a.state.date !== b.state.date ? (a.state.date < b.state.date ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Draws every live fertilizing from stock. `exclude` leaves one record out entirely — the one being
 * edited, so its screen shows "ในสต็อก" without its own sacks (FZ-9).
 */
export function projectFertilizing(
  events: readonly FinanceEvent[],
  expenses: readonly Expense[],
  opts: { readonly exclude?: string } = {},
): FertilizingProjection {
  const cards = fertilizerCards(expenses);
  const cardOf = new Map<string, FertilizerCard>();
  for (const c of cards) for (const i of c.items) cardOf.set(i.expenseId, c);
  const expenseById = new Map(expenses.map((x) => [x.id, x]));
  const used = new Map<string, number>();

  const folded = foldFertilizings(events);
  const projected = new Map<string, Fertilizing>();
  const label = (sources: readonly string[]) => sources.map((s) => expenseById.get(s)?.fertilizer?.formula).find(Boolean) ?? '';

  // The local log is in the order it was written (finance does not sync yet), so "after" is a later position.
  const at = new Map(events.map((e, i) => [e.id, i]));
  const createdAt = (id: string) => Math.min(...events.filter((e) => e.targetId === id).map((e) => at.get(e.id) ?? 0));
  const priced = (e: FinanceEvent) => e.payload.t === 'expense_changed' && ['amountSatang', 'discountSatang', 'line'].some((k) => k in (e.payload as { patch: object }).patch);
  const repricedAfter = (f: (typeof folded)[number]) => {
    const from = createdAt(f.id);
    const sources = new Set(f.state.lines.flatMap((l) => l.sources));
    return events.some((e) => sources.has(e.targetId) && priced(e) && (at.get(e.id) ?? 0) > from);
  };

  const asIs = (f: (typeof folded)[number]): Fertilizing => ({
    ...f.state,
    id: f.id,
    lines: f.state.lines.map((l) => ({ ...l, label: label(l.sources), draws: [], costSatang: 0, waitingSacks: 0, overSacks: 0, orphaned: false, cardKeys: [] })),
    over: 0,
    waiting: 0,
    regrouped: false,
    repriced: repricedAfter(f),
    conflicts: f.conflicts,
    history: f.history,
    headEventId: f.head,
  });

  const drawLines = (f: (typeof folded)[number], used: Map<string, number>, cardUse: Map<string, number>) =>
    f.state.lines.map((l): ProjectedLine => {
      const pool = [...new Set(l.sources.map((s) => cardOf.get(s)).filter((c): c is FertilizerCard => !!c))];
      for (const c of pool) cardUse.set(c.key, (cardUse.get(c.key) ?? 0) + 1);
      const items = pool.flatMap((c) => c.items).sort(oldestFirst);
      const draws = new Map<string, Draw>();
      const draw = (i: StockItem, take: number) => {
        const from = used.get(i.expenseId) ?? 0;
        used.set(i.expenseId, from + take);
        const prev = draws.get(i.expenseId);
        const cost = drawCost(i.netSatang, i.sacks, from, from + take);
        draws.set(i.expenseId, { expenseId: i.expenseId, sacks: (prev?.sacks ?? 0) + take, costSatang: (prev?.costSatang ?? 0) + cost });
      };
      let left = l.sacks;
      for (const i of items) {
        if (left === 0) break;
        const avail = i.sacks - (used.get(i.expenseId) ?? 0);
        if (avail <= 0) continue;
        const take = Math.min(avail, left);
        draw(i, take);
        left -= take;
      }
      let waitingSacks = 0;
      let overSacks = 0;
      if (left > 0) {
        const committed = l.sources.some((s) => {
          const x = expenseById.get(s);
          return !!x && isFertilizerItem(x) && x.stage !== 'actual';
        });
        if (committed) waitingSacks = left;
        else if (items.length) {
          draw(items[items.length - 1], left);
          overSacks = left;
        }
      }
      const ds = [...draws.values()];
      return {
        ...l,
        label: label(l.sources),
        draws: ds,
        costSatang: ds.reduce((s, d) => s + d.costSatang, 0),
        waitingSacks,
        overSacks,
        orphaned: pool.length === 0 && waitingSacks === 0,
        cardKeys: pool.map((c) => c.key),
      };
    });

  for (const f of [...folded].sort(byDateThenId)) {
    if (f.id === opts.exclude) {
      projected.set(f.id, asIs(f));
      continue;
    }
    if (f.state.deleted) {
      // Priced as if live on a copy of the stock drawn so far, so a voided lump can say what it owed (review of PR 188 S3);
      // it draws nothing from the real stock.
      projected.set(f.id, { ...asIs(f), lines: drawLines(f, new Map(used), new Map()) });
      continue;
    }
    const cardUse = new Map<string, number>();
    const lines = drawLines(f, used, cardUse);
    projected.set(f.id, {
      ...asIs(f),
      lines,
      over: lines.reduce((s, l) => s + l.overSacks, 0),
      waiting: lines.reduce((s, l) => s + l.waitingSacks, 0),
      regrouped: lines.some((l) => l.cardKeys.length > 1) || [...cardUse.values()].some((n) => n > 1),
    });
  }

  const withUse = cards.map((c) => {
    const usedSacks = c.items.reduce((s, i) => s + (used.get(i.expenseId) ?? 0), 0);
    return { ...c, usedSacks, leftSacks: c.deliveredSacks - usedSacks };
  });
  const records = [...projected.values()].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { records, cards: withUse };
}

// ── Debts ───────────────────────────────────────────────────────────────────

export interface FertilizingDebt extends DebtFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
  /** Its fertilizing was changed after it was first written: the amount is worked out again (SP-10). */
  readonly edited: boolean;
  /** A source order's price changed after the fertilizing: the amount is worked out again (SP-10). */
  readonly repriced: boolean;
}

const owes = (s: FzState, workerId: string) =>
  !s.deleted && (s.settle[workerId] ?? 'debt') === 'debt' && s.lines.some((l) => l.takes.some((t) => t.worker.id === workerId && t.sacks > 0));

/** What a lump is made of — date, lines, % and how to pay back — changed after it was written (SP-10, review of PR 188 S4). */
const debtChanged = (history: readonly FzState[]): boolean => {
  const key = (s: FzState) => JSON.stringify([s.date, s.lines, s.pct, s.settle]);
  return history.some((s) => key(s) !== key(history[0]));
};

/** A line's cost split over its takes by sacks, with cumulative rounding so the parts add up. */
export function takeCosts(l: ProjectedLine): Map<string, number> {
  const out = new Map<string, number>();
  if (l.sacks < 1) return out;
  let cum = 0;
  let given = 0;
  for (const t of l.takes) {
    cum += t.sacks;
    const at = Math.floor((2 * l.costSatang * cum + l.sacks) / (2 * l.sacks));
    out.set(t.worker.id, (out.get(t.worker.id) ?? 0) + at - given);
    given = at;
  }
  return out;
}

/**
 * One debt per worker per fertilizing: Σ their cost over every line, then their % once (SP-8). A worker
 * once owed and no longer (deleted, switched to "จ่ายสดแล้ว", taken off) keeps a voided row (SP-10).
 */
export function fertilizingDebts(p: FertilizingProjection): FertilizingDebt[] {
  const out: FertilizingDebt[] = [];
  for (const r of [...p.records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const ever = new Map<string, Payer>();
    for (const s of r.history) for (const l of s.lines) for (const t of l.takes) if (owes(s, t.worker.id)) ever.set(t.worker.id, t.worker);
    if (!ever.size) continue;
    const costs = new Map<string, number>();
    const notes = new Map<string, string[]>();
    for (const l of r.lines) {
      for (const [wid, c] of takeCosts(l)) costs.set(wid, (costs.get(wid) ?? 0) + c);
      for (const t of l.takes) if (t.sacks > 0) notes.set(t.worker.id, [...(notes.get(t.worker.id) ?? []), `${l.label} ${t.sacks} ถุง`]);
    }
    for (const [wid, worker] of ever) {
      // A take on an orphaned line (its source gone, or dated before the cutoff) owes nothing: no live 0.00 row (review N4).
      const onLive = r.lines.some((l) => !l.orphaned && l.takes.some((x) => x.worker.id === wid && x.sacks > 0));
      const live = owes(r, wid) && onLive;
      // A deleted fertilizing's lump keeps what it owed, so the history says what was voided (review of PR 188 S3).
      const shown = live || (r.deleted && owes({ ...r, deleted: false }, wid) && onLive);
      const take = r.lines.flatMap((l) => l.takes).find((t) => t.worker.id === wid);
      out.push({
        id: `${r.id}${FERTILIZING_DEBT_INFIX}${wid}`,
        worker: take?.worker ?? worker,
        kind: 'fertilizer',
        amountSatang: shown ? fertilizerSplit(costs.get(wid) ?? 0, r.pct[wid] ?? DEFAULT_TAPPER_PCT).workerSatang : 0,
        date: r.date,
        note: (notes.get(wid) ?? []).join(' · '),
        lender: null,
        fertilizer: null,
        carriedForward: false,
        fertilizingId: r.id,
        deleted: !live,
        headEventId: r.headEventId,
        edited: debtChanged(r.history),
        repriced: r.repriced,
      });
    }
  }
  return out;
}

// ── Validation ──────────────────────────────────────────────────────────────

export type FertilizingProblem =
  | 'date-required'
  | 'date-future'
  | 'no-lines'
  | 'line-sacks' // not a whole number ≥ 1
  | 'line-sources' // no source
  | 'source-twice' // one source on two lines
  | 'take-sacks' // a take not a whole number ≥ 0
  | 'takes-over' // takes add up to more than the line
  | 'worker-twice' // one worker twice on a line
  | 'pct-invalid'
  | 'pct-missing'; // a tapper takes sacks but has no stored % (review S2: the projection never guesses)

const whole = (n: number, min: number) => Number.isSafeInteger(n) && n >= min;

/** `today` is "YYYY-MM-DD" from the caller (no clocks in core). */
export function checkFertilizing(f: FertilizingFields, today: string): FertilizingProblem[] {
  const out = new Set<FertilizingProblem>();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) out.add('date-required');
  else if (f.date > today) out.add('date-future');
  if (f.lines.length === 0) out.add('no-lines');
  const seen = new Set<string>();
  for (const l of f.lines) {
    if (!whole(l.sacks, 1)) out.add('line-sacks');
    if (l.sources.length === 0) out.add('line-sources');
    for (const s of l.sources) {
      if (seen.has(s)) out.add('source-twice');
      seen.add(s);
    }
    if (l.takes.some((t) => !whole(t.sacks, 0))) out.add('take-sacks');
    else if (l.takes.reduce((s, t) => s + t.sacks, 0) > l.sacks) out.add('takes-over');
    if (new Set(l.takes.map((t) => t.worker.id)).size < l.takes.length) out.add('worker-twice');
  }
  for (const p of Object.values(f.pct)) if (!Number.isInteger(p) || p < 0 || p > 100) out.add('pct-invalid');
  for (const l of f.lines) for (const t of l.takes) if (t.sacks > 0 && f.pct[t.worker.id] === undefined) out.add('pct-missing');
  return [...out];
}
