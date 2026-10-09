/**
 * Projection of the finance log (E11-S01..S03): expenses with their stage
 * history, money the farm owes back (a pure projection of expenses — never
 * stored, so two devices can never create the same debt twice), and
 * repayments against it.
 *
 * Nothing here reads a clock. Within one record, changes are ordered by the
 * `baseEventId` chain (causal order), ties broken by event id so every device
 * folds the same log to the same answer.
 */

import type { EventId } from '../types';
import {
  FARM_FUNDS,
  type Allocation,
  type DebtFields,
  type ExpenseFields,
  type ExpensePatch,
  type FinanceEvent,
  type Payer,
  type RepaymentFields,
  type RepaymentPatch,
  type Stage,
} from './types';

// ── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  readonly id: string;
  readonly name: string;
}

/**
 * The starting set (D-62). Fixed ids so a rename is an event against a known
 * record, the same on every device, with nothing to seed or sync.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'cat-fertilizer', name: 'ปุ๋ย' },
  { id: 'cat-labour', name: 'ค่าแรง' },
  { id: 'cat-fuel', name: 'น้ำมันตัดหญ้า' },
  { id: 'cat-herbicide', name: 'ยาฆ่าหญ้า' },
  { id: 'cat-travel', name: 'เดินทาง' },
  { id: 'cat-salary', name: 'เงินเดือนผู้จัดการ' },
  { id: 'cat-worker-aid', name: 'ช่วยเหลือคนงาน' },
  { id: 'cat-repair', name: 'ซ่อมแซม/อุปกรณ์' },
  { id: 'cat-other', name: 'อื่น ๆ' },
];

// ── Record fold with conflict detection ─────────────────────────────────────

export interface FieldConflict {
  readonly field: string;
  /** The competing values, sorted — the user picks one (E01-S11). */
  readonly values: readonly unknown[];
}

interface Folded<S> {
  readonly state: S;
  /** State after the create and after each applied change, in fold order. */
  readonly history: readonly S[];
  readonly conflicts: readonly FieldConflict[];
  /** A change whose base has not arrived yet is held (architecture "รอข้อมูล"). */
  readonly waiting: boolean;
  readonly createdBy: FinanceEvent;
}

type Patch = Record<string, unknown>;

function patchOf(e: FinanceEvent): Patch | null {
  const p = e.payload;
  return 'patch' in p ? (p.patch as Patch) : null;
}

function alsoOf(e: FinanceEvent): readonly EventId[] {
  const p = e.payload;
  return ('alsoBasedOn' in p ? p.alsoBasedOn : undefined) ?? [];
}

const byId = (a: FinanceEvent, b: FinanceEvent) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Folds one record's events. `guarded` are the fields where two concurrent
 * edits may not merge silently (money, stage, payer — D-30): while such a
 * conflict is open, the field keeps its value from before the fork, so totals
 * use the base value (architecture §Sync engine).
 */
function foldRecord<S extends object>(
  events: readonly FinanceEvent[],
  initial: (create: FinanceEvent) => S,
  guarded: readonly string[],
): Folded<S> | null {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()].sort(byId);
  const create = unique.find((e) => e.baseEventId === null && patchOf(e) === null);
  if (!create) return null;

  // Causal order: a change applies once its base has.
  const known = new Set<EventId>([create.id]);
  let pending = unique.filter((e) => e !== create && patchOf(e) !== null);
  const order: FinanceEvent[] = [];
  for (;;) {
    const ready = pending.filter((e) => known.has(e.baseEventId as EventId));
    if (!ready.length) break;
    for (const e of ready) {
      order.push(e);
      known.add(e.id);
    }
    pending = pending.filter((e) => !known.has(e.id));
  }

  const ancestors = new Map<EventId, Set<EventId>>([[create.id, new Set()]]);
  for (const e of order) {
    const set = new Set<EventId>();
    for (const parent of [e.baseEventId as EventId, ...alsoOf(e)]) {
      set.add(parent);
      for (const a of ancestors.get(parent) ?? []) set.add(a);
    }
    ancestors.set(e.id, set);
  }

  // Conflicts, per guarded field. The field's "tips" are the changes that set
  // it with no later change on their own branch setting it again. Two tips
  // are concurrent (neither descends from the other, by construction); if
  // their values differ and no later change descends from both, the field is
  // in conflict. While it is, every change on a contested branch is held back
  // for that field, so the value stays what it was before the fork, and the
  // tips' values are what the user picks from — including an edit made on
  // one branch after the fork (review #1, #2).
  const isAncestor = (a: EventId, of: EventId) => ancestors.get(of)?.has(a) ?? false;
  const open: { field: string; held: Set<EventId>; values: unknown[] }[] = [];
  for (const field of guarded) {
    const setters = order.filter((e) => field in (patchOf(e) as Patch));
    const tips = setters.filter((s1) => !setters.some((s2) => s2 !== s1 && isAncestor(s1.id, s2.id)));
    if (tips.length < 2) continue;
    const valueOf = (e: FinanceEvent) => (patchOf(e) as Patch)[field];
    const distinct = new Set(tips.map((e) => JSON.stringify(valueOf(e))));
    if (distinct.size < 2) continue;
    const resolved = order.some((e) => tips.every((tip) => isAncestor(tip.id, e.id)));
    if (resolved) continue;
    // Held: every setter on a contested branch that is not shared history of all tips.
    const held = new Set(
      setters
        .filter((s1) => tips.some((tip) => s1 === tip || isAncestor(s1.id, tip.id)))
        .filter((s1) => !tips.every((tip) => s1 === tip || isAncestor(s1.id, tip.id)))
        .map((e) => e.id),
    );
    const values = [...new Map(tips.map((e) => [JSON.stringify(valueOf(e)), valueOf(e)])).values()].sort(compareValues);
    open.push({ field, held, values });
  }

  let state = initial(create);
  const history: S[] = [state];
  for (const e of order) {
    const patch = { ...(patchOf(e) as Patch) };
    for (const c of open) if (c.held.has(e.id)) delete patch[c.field];
    state = { ...state, ...patch } as S;
    history.push(state);
  }

  return {
    state,
    history,
    conflicts: open.map((c) => ({ field: c.field, values: c.values })),
    waiting: pending.length > 0,
    createdBy: create,
  };
}

// ── Projected records ───────────────────────────────────────────────────────

export interface Expense extends ExpenseFields {
  readonly id: string;
  readonly deleted: boolean;
  /** Every state the expense has been in, oldest first (SYNC-9). */
  readonly history: readonly (ExpenseFields & { readonly deleted: boolean })[];
  readonly conflicts: readonly FieldConflict[];
  readonly waiting: boolean;
  /** The current head — what an edit names as its `baseEventId`. */
  readonly headEventId: EventId;
  /** Every head (more than one while edits are concurrent) — a resolving edit names them all. Includes synthesised ones. */
  readonly heads: readonly EventId[];
  /** Device that created it — for "same payer as last time" (D-62). */
  readonly createdOn: string;
}

export interface Repayment extends RepaymentFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly conflicts: readonly FieldConflict[];
  readonly headEventId: EventId;
}

export type ReimbursementStatus = 'owed' | 'partial' | 'repaid' | 'overpaid';

/** Money the farm owes someone who paid a farm expense with their own money (FIN-4). */
export interface Reimbursement {
  readonly expenseId: string;
  readonly to: Payer;
  readonly originalSatang: number;
  readonly repaidSatang: number;
  /** Negative only when two devices repaid past the total — `overpaid`, flagged for the owner. */
  readonly remainingSatang: number;
  readonly date: string;
  readonly status: ReimbursementStatus;
  /** The live repayments that touched this debt, for drill-down (NFR-3). */
  readonly repayments: readonly Repayment[];
}

export interface FinanceState {
  readonly expenses: readonly Expense[];
  readonly categories: readonly Category[];
  readonly repayments: readonly Repayment[];
  readonly reimbursements: readonly Reimbursement[];
}

const EXPENSE_GUARDED = ['amountSatang', 'stage', 'payer'] as const;
const REPAYMENT_GUARDED = ['amountSatang', 'allocations', 'from', 'to'] as const;

function groupByTarget(events: readonly FinanceEvent[], kinds: readonly string[]) {
  const out = new Map<string, FinanceEvent[]>();
  for (const e of events) {
    if (!kinds.includes(e.payload.t)) continue;
    const list = out.get(e.targetId) ?? [];
    list.push(e);
    out.set(e.targetId, list);
  }
  return out;
}

/**
 * `saleCounts(saleId)`: whether a sale is still live. A repayment made by
 * netting at a sale that was later cancelled/deleted stops counting (D-67),
 * the same rule the debt ledger applies to that sale's deductions.
 */
export function projectFinance(
  events: readonly FinanceEvent[],
  saleCounts: (saleId: string) => boolean = () => true,
): FinanceState {
  const expenses: Expense[] = [];
  const all = [...events, ...ownerShareEvents(events)];
  for (const [id, evs] of groupByTarget(all, ['expense_created', 'expense_changed'])) {
    const f = foldRecord(
      evs,
      (c) => ({ ...(c.payload as { fields: ExpenseFields }).fields, deleted: false }) as ExpenseFields & { deleted: boolean },
      EXPENSE_GUARDED,
    );
    if (!f) continue;
    expenses.push({
      ...f.state,
      id,
      history: f.history,
      conflicts: f.conflicts,
      waiting: f.waiting,
      headEventId: latestHead(evs, f.createdBy.id) ?? f.createdBy.id,
      heads: headsOf(evs, id),
      createdOn: f.createdBy.actor.deviceId,
    });
  }

  const repayments: Repayment[] = [];
  for (const [id, evs] of groupByTarget(events, ['repayment_recorded', 'repayment_changed'])) {
    const f = foldRecord(
      evs,
      (c) => ({ ...(c.payload as { fields: RepaymentFields }).fields, deleted: false }) as RepaymentFields & { deleted: boolean },
      REPAYMENT_GUARDED,
    );
    if (!f) continue;
    repayments.push({ ...f.state, id, conflicts: f.conflicts, headEventId: latestHead(evs, f.createdBy.id) ?? f.createdBy.id });
  }
  repayments.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));

  const names = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
  const catEvents = events.filter((e) => e.payload.t === 'category_added' || e.payload.t === 'category_renamed');
  // Names carry no money, so a plain id order is enough to agree on one.
  for (const e of [...catEvents].sort(byId)) {
    const p = e.payload as { name: string };
    names.set(e.targetId, p.name);
  }
  const categories = [...names].map(([id, name]) => ({ id, name }));

  const live = repayments.filter((r) => !r.deleted && (!r.saleId || saleCounts(r.saleId)));
  const reimbursements: Reimbursement[] = [];
  for (const x of expenses) {
    if (x.deleted || x.stage !== 'actual' || !x.payer || x.payer.id === FARM_FUNDS || x.amountSatang === null) continue;
    const touching = live.filter((r) => r.allocations.some((a) => a.expenseId === x.id));
    const repaid = touching.reduce(
      (sum, r) => sum + r.allocations.filter((a) => a.expenseId === x.id).reduce((s, a) => s + a.satang, 0),
      0,
    );
    const remaining = x.amountSatang - repaid;
    reimbursements.push({
      expenseId: x.id,
      to: x.payer,
      originalSatang: x.amountSatang,
      repaidSatang: repaid,
      remainingSatang: remaining,
      date: x.date,
      status: remaining < 0 ? 'overpaid' : remaining === 0 ? 'repaid' : repaid > 0 ? 'partial' : 'owed',
      repayments: touching,
    });
  }
  reimbursements.sort(oldestFirst);

  return { expenses, categories, repayments, reimbursements };
}

/**
 * A manual fertilizer debt carries the owner's share as a farm expense (D-67,
 * D-74 F7): synthesised from the debt's own events under `<debtId>:owner`,
 * so editing or voiding the debt moves the expense with it, while the payer
 * (unset at first) is set later by ordinary edits on that id.
 */
export const OWNER_SHARE_SUFFIX = ':owner';

function ownerShareEvents(events: readonly FinanceEvent[]): FinanceEvent[] {
  const out: FinanceEvent[] = [];
  const debts = new Map<string, DebtFields & { deleted?: boolean }>();
  for (const e of events) if (e.payload.t === 'debt_added') debts.set(e.targetId, e.payload.fields);
  const derived = (f: Pick<DebtFields, 'fertilizer'>) => (f.fertilizer ? fertilizerSplit(f.fertilizer.totalSatang, f.fertilizer.workerPct).ownerSatang : null);
  for (const e of events) {
    const p = e.payload;
    const id = e.targetId + OWNER_SHARE_SUFFIX;
    const syn = (payload: FinanceEvent['payload']): FinanceEvent => ({
      ...e,
      id: e.id + OWNER_SHARE_SUFFIX,
      targetId: id,
      baseEventId: e.baseEventId === null ? null : e.baseEventId + OWNER_SHARE_SUFFIX,
      payload,
    });
    if (p.t === 'debt_added' && p.fields.kind === 'fertilizer' && p.fields.fertilizer) {
      out.push(
        syn({
          t: 'expense_created',
          fields: {
            amountSatang: derived(p.fields),
            date: p.fields.date,
            stage: 'actual',
            categoryId: 'cat-fertilizer',
            propertyId: null,
            item: p.fields.worker.name,
            note: p.fields.note,
            payer: null,
          },
        }),
      );
    } else if (p.t === 'debt_changed') {
      const base = debts.get(e.targetId);
      if (!base || base.kind !== 'fertilizer') continue;
      const patch: ExpensePatch = {
        ...(p.patch.fertilizer ? { amountSatang: derived(p.patch as DebtFields) } : {}),
        ...(p.patch.date !== undefined ? { date: p.patch.date } : {}),
        ...(p.patch.note !== undefined ? { note: p.patch.note } : {}),
        ...(p.patch.deleted !== undefined ? { deleted: p.patch.deleted } : {}),
        // No longer a fertilizer debt → no owner share (review #6).
        ...(p.patch.fertilizer === null || (p.patch.kind !== undefined && p.patch.kind !== 'fertilizer') ? { deleted: true } : {}),
      };
      out.push(syn({ t: 'expense_changed', patch, alsoBasedOn: (p.alsoBasedOn ?? []).map((a) => a + OWNER_SHARE_SUFFIX) }));
    }
  }
  return out;
}

/** Fertilizer bill × whole-number % → the worker's debt, rounded half-up to the satang; the rest is the owner's. */
export function fertilizerSplit(totalSatang: number, workerPct: number): { workerSatang: number; ownerSatang: number } {
  if (!Number.isInteger(workerPct) || workerPct < 0 || workerPct > 100) throw new RangeError('workerPct must be a whole 0–100');
  const workerSatang = Math.floor((totalSatang * workerPct + 50) / 100);
  return { workerSatang, ownerSatang: totalSatang - workerSatang };
}

/** The event no other event of this record names as its base — what the next edit builds on. */
function latestHead(evs: readonly FinanceEvent[], createId: EventId): EventId | null {
  const based = new Set<EventId>();
  for (const e of evs) {
    if (e.baseEventId) based.add(e.baseEventId);
    for (const a of alsoOf(e)) based.add(a);
  }
  const heads = evs.filter((e) => !based.has(e.id) && (e.id === createId || e.baseEventId !== null)).sort(byId);
  return heads.length ? heads[heads.length - 1].id : null;
}

/** Every head of a record — an edit that names them all resolves a conflict. */
export function headsOf(events: readonly FinanceEvent[], targetId: string): EventId[] {
  const evs = events.filter((e) => e.targetId === targetId);
  const based = new Set<EventId>();
  for (const e of evs) {
    if (e.baseEventId) based.add(e.baseEventId);
    for (const a of alsoOf(e)) based.add(a);
  }
  return evs.filter((e) => !based.has(e.id)).map((e) => e.id).sort();
}

function oldestFirst(a: { date: string; expenseId: string }, b: { date: string; expenseId: string }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.expenseId < b.expenseId ? -1 : a.expenseId > b.expenseId ? 1 : 0;
}

// ── Validation ──────────────────────────────────────────────────────────────

export type ExpenseProblem = 'amount-required' | 'amount-invalid' | 'date-required';

/** Only amount + date are required (D-62); a planned expense may leave the amount unknown. */
export function checkExpense(f: Pick<ExpenseFields, 'amountSatang' | 'date' | 'stage'>): ExpenseProblem[] {
  const out: ExpenseProblem[] = [];
  if (f.amountSatang === null) {
    if (f.stage !== 'planned') out.push('amount-required');
  } else if (!Number.isSafeInteger(f.amountSatang) || f.amountSatang < 0) {
    out.push('amount-invalid');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) out.push('date-required');
  return out;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export interface StageTotals {
  readonly actual: number;
  readonly committed: number;
  /** Unknown planned amounts are counted, never summed as zero (D-62). */
  readonly planned: { readonly knownSatang: number; readonly unknownCount: number };
}

export function stageTotals(expenses: readonly Expense[]): StageTotals {
  let actual = 0;
  let committed = 0;
  let knownSatang = 0;
  let unknownCount = 0;
  for (const x of expenses) {
    if (x.deleted) continue;
    if (x.amountSatang === null) {
      unknownCount += 1;
      continue;
    }
    if (x.stage === 'actual') actual += x.amountSatang;
    else if (x.stage === 'committed') committed += x.amountSatang;
    else knownSatang += x.amountSatang;
  }
  return { actual, committed, planned: { knownSatang, unknownCount } };
}

export interface ExpenseFilter {
  readonly stage?: Stage;
  readonly categoryId?: string;
  readonly propertyId?: string;
  /** "YYYY-MM" */
  readonly month?: string;
  /** F7: payer not recorded yet. */
  readonly payerMissing?: boolean;
  /** F7: still owed back to whoever paid. */
  readonly unrepaid?: boolean;
  readonly payerId?: string;
}

/** Live expenses matching every set filter, newest date first. */
export function filterExpenses(state: FinanceState, f: ExpenseFilter): Expense[] {
  const owing = new Set(state.reimbursements.filter((r) => r.remainingSatang > 0).map((r) => r.expenseId));
  return state.expenses
    .filter(
      (x) =>
        !x.deleted &&
        (!f.stage || x.stage === f.stage) &&
        (!f.categoryId || x.categoryId === f.categoryId) &&
        (!f.propertyId || x.propertyId === f.propertyId) &&
        (!f.month || x.date.startsWith(`${f.month}-`)) &&
        (!f.payerMissing || x.payer === null) &&
        (!f.unrepaid || owing.has(x.id)) &&
        (!f.payerId || x.payer?.id === f.payerId),
    )
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? -1 : 1));
}

/** The payer of the last expense this device recorded (D-62); null if none. */
export function defaultPayer(events: readonly FinanceEvent[], deviceId: string): Payer | null {
  let last: FinanceEvent | null = null;
  for (const e of events) {
    if (e.payload.t !== 'expense_created' || e.actor.deviceId !== deviceId) continue;
    if (!last || e.deviceSeq > last.deviceSeq) last = e;
  }
  return last ? (last.payload as { fields: ExpenseFields }).fields.payer : null;
}

export interface OwedTo {
  readonly payer: Payer;
  readonly remainingSatang: number;
  readonly oldestDate: string;
  /** Oldest first — drill-down to the expenses (FIN-1, ANA-1). */
  readonly items: readonly Reimbursement[];
}

/** "ค้างใคร": per person, the total the farm still owes them. */
export function owedByPerson(state: FinanceState): OwedTo[] {
  const by = new Map<string, Reimbursement[]>();
  for (const r of state.reimbursements) {
    const list = by.get(r.to.id) ?? [];
    list.push(r);
    by.set(r.to.id, list);
  }
  return [...by.values()]
    .map((items) => ({
      payer: items[items.length - 1].to,
      remainingSatang: items.reduce((s, r) => s + r.remainingSatang, 0),
      oldestDate: items[0].date,
      items,
    }))
    .sort((a, b) => b.remainingSatang - a.remainingSatang || a.payer.name.localeCompare(b.payer.name, 'th'));
}

/** Home card "รายการที่ต้องจ่าย": owed back + committed expenses (D-65). */
export function payableSatang(state: FinanceState): number {
  const owed = state.reimbursements.reduce((s, r) => s + Math.max(0, r.remainingSatang), 0);
  const committed = state.expenses
    .filter((x) => !x.deleted && x.stage === 'committed')
    .reduce((s, x) => s + (x.amountSatang ?? 0), 0);
  return owed + committed;
}

export type AllocationPlan =
  | { readonly ok: true; readonly allocations: readonly Allocation[] }
  | { readonly ok: false; readonly reason: 'over' | 'amount-invalid'; readonly maxSatang: number };

/** One repayment over several debts: oldest first (D-67); more than is owed is refused. */
export function allocateOldestFirst(debts: readonly Reimbursement[], amountSatang: number): AllocationPlan {
  const open = debts.filter((d) => d.remainingSatang > 0).sort(oldestFirst);
  const max = open.reduce((s, d) => s + d.remainingSatang, 0);
  if (!Number.isSafeInteger(amountSatang) || amountSatang <= 0) return { ok: false, reason: 'amount-invalid', maxSatang: max };
  if (amountSatang > max) return { ok: false, reason: 'over', maxSatang: max };
  const allocations: Allocation[] = [];
  let left = amountSatang;
  for (const d of open) {
    if (!left) break;
    const take = Math.min(left, d.remainingSatang);
    allocations.push({ expenseId: d.expenseId, satang: take });
    left -= take;
  }
  return { ok: true, allocations };
}

export type { ExpensePatch, RepaymentPatch };

/** The record fold for sibling projections (`debts.ts`): final state + the head an edit builds on. */
export function foldRecordPublic<S extends object>(
  events: readonly FinanceEvent[],
  initial: (create: FinanceEvent) => S,
  guarded: readonly string[],
): { state: S; head: EventId; conflicts: readonly FieldConflict[] } | null {
  const f = foldRecord(events, initial, guarded);
  return f ? { state: f.state, head: latestHead(events, f.createdBy.id) ?? f.createdBy.id, conflicts: f.conflicts } : null;
}

/** The newest head of a chain of events on one record (ties by id). */
export function headOf(events: readonly FinanceEvent[]): EventId | null {
  const heads = headsOf(events, events[0]?.targetId ?? '');
  return heads.length ? heads[heads.length - 1] : null;
}
