/**
 * The forward-looking side of the farm's money (E11-S05..S08): special
 * payments to workers, trips, leases and income, the reserve, and the
 * monthly cashflow table. Pure: everything is derived from the finance log
 * and the sale history rows; unknown amounts stay unknown and flag their
 * month instead of counting as zero (SYNC-12).
 */

import { foldRecordPublic, headOf, nextMonth, type FinanceState } from './ledger';
import type { FinanceEvent, IncomeFields, LeaseFields, Payer, Trip } from './types';

// ── E11-S05 ────────────────────────────────────────────────────────────────

/** Special payments per worker within [from, to] (dates "YYYY-MM-DD"), biggest first. */
export function aidByWorker(state: FinanceState, from: string, to: string): { worker: Payer; totalSatang: number; ids: string[] }[] {
  const by = new Map<string, { worker: Payer; totalSatang: number; ids: string[] }>();
  for (const x of state.expenses) {
    if (x.deleted || !x.worker || x.date < from || x.date > to) continue;
    const row = by.get(x.worker.id) ?? { worker: x.worker, totalSatang: 0, ids: [] };
    row.totalSatang += x.amountSatang ?? 0;
    row.ids.push(x.id);
    by.set(x.worker.id, row);
  }
  return [...by.values()].sort((a, b) => b.totalSatang - a.totalSatang);
}

// ── E11-S06 ────────────────────────────────────────────────────────────────

export type TripProblem = 'lines-total' | 'split-total';

/** The trip's amount is its lines' sum; a split, if any, must add up to it — never split automatically (FIN-7). */
export function checkTrip(trip: Trip, amountSatang: number): TripProblem[] {
  const out: TripProblem[] = [];
  const lines = trip.lines.reduce((s, l) => s + l.satang, 0);
  if (lines !== amountSatang) out.push('lines-total');
  if (trip.split && trip.split.reduce((s, x) => s + x.satang, 0) !== amountSatang) out.push('split-total');
  return out;
}

// ── E11-S07 / S08 records ──────────────────────────────────────────────────

export interface Lease extends LeaseFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
}

export interface Income extends IncomeFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
}

export interface Reserve {
  readonly amountSatang: number;
  readonly assumption: string;
  readonly source: string;
  readonly head: string;
}

export function projectPlan(events: readonly FinanceEvent[]): { leases: Lease[]; incomes: Income[]; reserve: Reserve | null } {
  const by = new Map<string, FinanceEvent[]>();
  for (const e of events) {
    const list = by.get(e.targetId) ?? [];
    list.push(e);
    by.set(e.targetId, list);
  }
  const leases: { l: Lease; first: string }[] = [];
  const incomes: Income[] = [];
  let reserve: Reserve | null = null;
  for (const [id, evs] of by) {
    const create = evs.find((e) => e.baseEventId === null);
    const t = create?.payload.t ?? evs[0].payload.t;
    if (t === 'lease_added') {
      const f = foldRecordPublic(evs, (c) => ({ ...(c.payload as { fields: LeaseFields }).fields, deleted: false }), ['rentSatang', 'sharePct']);
      if (f) leases.push({ l: { ...f.state, id, headEventId: f.head }, first: create!.id });
    } else if (t === 'income_recorded') {
      const f = foldRecordPublic(evs, (c) => ({ ...(c.payload as { fields: IncomeFields }).fields, deleted: false }), ['amountSatang', 'stage']);
      if (f) incomes.push({ ...f.state, id, headEventId: f.head });
    } else if (t === 'reserve_set') {
      const head = headOf(evs);
      const p = evs.find((e) => e.id === head)?.payload;
      if (p?.t === 'reserve_set' && head) reserve = { amountSatang: p.amountSatang, assumption: p.assumption, source: p.source, head };
    }
  }
  return {
    leases: leases.sort((a, b) => (a.first < b.first ? -1 : 1)).map((x) => x.l),
    incomes: incomes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1)),
    reserve,
  };
}

/** Rubber income = the owner's share of each closed, not-deleted sale, linked to it (FIN-8). */
export function rubberIncome(
  rows: readonly { saleId: string; startedTs: number | null; status: 'open' | 'closed'; ownerSatang: number | null; deleted: boolean }[],
): { saleId: string; date: string; satang: number }[] {
  return rows
    .filter((r) => r.status === 'closed' && !r.deleted && r.ownerSatang !== null && r.startedTs !== null)
    .map((r) => ({ saleId: r.saleId, date: new Date(r.startedTs!).toISOString().slice(0, 10), satang: r.ownerSatang! }));
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = nextMonth(m)) out.push(m);
  return out;
}

/**
 * Expected lease income per month in [from, to]: yearly rent in the start's
 * month each year, monthly rent every month, until the end. A lease whose
 * rent or period is unknown makes each month from its start "incomplete".
 */
export function leaseIncome(leases: readonly Lease[], from: string, to: string) {
  const expected: { leaseId: string; month: string; satang: number }[] = [];
  const incomplete = new Set<string>();
  for (const l of leases) {
    if (l.deleted || !l.start) continue;
    const startMonth = l.start.slice(0, 7);
    const endMonth = l.end ? l.end.slice(0, 7) : to;
    for (const m of monthsBetween(from, to)) {
      if (m < startMonth || m > endMonth) continue;
      if (l.rentSatang === null || l.period === null) {
        incomplete.add(m);
        continue;
      }
      if (l.period === 'month' || m.slice(5) === startMonth.slice(5)) expected.push({ leaseId: l.id, month: m, satang: l.rentSatang });
    }
  }
  return { expected, incompleteMonths: [...incomplete].sort() };
}

export interface CashflowRow {
  readonly month: string;
  readonly inActual: number;
  readonly inPlanned: number;
  readonly outActual: number;
  readonly outCommitted: number;
  readonly outPlanned: number;
  readonly netActual: number;
  /** Net if everything committed and planned happens as written. */
  readonly netAll: number;
  /** Some amount this month is unknown — shown as "ข้อมูลไม่ครบ", never filled in (SYNC-12). */
  readonly incomplete: boolean;
  /** Every record behind the figures: expense, income, lease and sale ids (ANA-3). */
  readonly sources: readonly string[];
}

export function cashflow(i: {
  state: FinanceState;
  plan: ReturnType<typeof projectPlan>;
  rubber: readonly { saleId: string; date: string; satang: number }[];
  fromMonth: string;
  toMonth: string;
}): CashflowRow[] {
  const leases = leaseIncome(i.plan.leases, i.fromMonth, i.toMonth);
  return monthsBetween(i.fromMonth, i.toMonth).map((month) => {
    const sources: string[] = [];
    let inActual = 0;
    let inPlanned = 0;
    let outActual = 0;
    let outCommitted = 0;
    let outPlanned = 0;
    let incomplete = leases.incompleteMonths.includes(month);
    for (const x of i.state.expenses) {
      if (x.deleted || !x.date.startsWith(month)) continue;
      sources.push(x.id);
      if (x.amountSatang === null) {
        incomplete = true;
        continue;
      }
      if (x.stage === 'actual') outActual += x.amountSatang;
      else if (x.stage === 'committed') outCommitted += x.amountSatang;
      else outPlanned += x.amountSatang;
    }
    for (const inc of i.plan.incomes) {
      if (inc.deleted || !inc.date.startsWith(month)) continue;
      sources.push(inc.id);
      if (inc.stage === 'actual') inActual += inc.amountSatang;
      else inPlanned += inc.amountSatang;
    }
    for (const r of i.rubber) {
      if (!r.date.startsWith(month)) continue;
      sources.push(r.saleId);
      inActual += r.satang;
    }
    for (const e of leases.expected) {
      if (e.month !== month) continue;
      sources.push(e.leaseId);
      inPlanned += e.satang;
    }
    return {
      month,
      inActual,
      inPlanned,
      outActual,
      outCommitted,
      outPlanned,
      netActual: inActual - outActual,
      netAll: inActual + inPlanned - outActual - outCommitted - outPlanned,
      incomplete,
      sources,
    };
  });
}
