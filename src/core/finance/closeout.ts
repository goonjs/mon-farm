/**
 * Sale close-out, one page (E05-S11 · D-60, D-67, D-71, D-72, D-85).
 *
 * Pure logic for the new "สรุปจ่ายเงิน" page. Nothing here changes a money
 * rule: it composes `deduct.ts` (cap, proposal, rounding, notes), `debts.ts`
 * (balances) and `pilesCheck` into one plan for the whole sale, held as a
 * DRAFT on screen until the owner presses "ยืนยันยอด" once (CO-3). Then
 * `confirmWrites` lists the existing events to write (no new event type).
 *
 * Order (D-60): share → deduct debt → round → cash to pay. Deduction never
 * above share + netting (D-18); netting only when the owner presses it.
 */

import type { DebtAccount } from './debts';
import { cashNotes, deductSheet, nettingPayloads, pickNotes, pilesCheck, workerCash, type DeductProblem, type RoundingMode } from './deduct';
import { roundSettlement } from './rounding';
import { FARM_FUNDS, type DebtKind, type DebtPaymentMethod, type FinancePayload, type Payer } from './types';
import type { Reimbursement } from './ledger';

const toFarm = (p: Payer | null | undefined) => !p || p.id === FARM_FUNDS;
const sumOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// ── Menus (CO-19 order; the first item is the first-time default, CO-23) ────

export type RepayRoute = Exclude<DebtPaymentMethod, 'outside' | 'netting'>;
/** โอนรวม · คนซื้อแยกเงินสด · หยิบจากเงิน{ชื่อ} */
export const REPAY_ROUTES: readonly RepayRoute[] = ['transfer-with-owner', 'buyer-split', 'cash-from-share'];
/** ให้คนกรีด · ไม่ปัด · ให้เจ้าของ */
export const ROUNDING_MENU: readonly RoundingMode[] = ['worker', 'none', 'owner'];

// ── CO-22 · debt pieces, oldest first ───────────────────────────────────────

export interface DebtPiece {
  readonly id: string;
  readonly kind: DebtKind;
  readonly date: string;
  readonly amountSatang: number;
  /** Left on this piece before this sale's deduction (other payments applied oldest first). */
  readonly leftBeforeSatang: number;
  /** Left after this sale's (draft) deduction, applied oldest first. */
  readonly leftAfterSatang: number;
}

/**
 * The worker's deductible pieces (farm debts only, D-69), oldest first by
 * (date, id), with every counted farm payment EXCEPT this sale's applied
 * oldest first, then `deductSatang` applied oldest first. Pieces already
 * fully paid before this sale are left out. Display only — the balance
 * itself still comes from `projectDebts`.
 */
export function debtPieces(account: DebtAccount, saleId: string, deductSatang: number): DebtPiece[] {
  const pieces = account.debts
    .filter((d) => !d.deleted && (d.kind !== 'loan' || toFarm(d.lender)))
    .sort((x, y) => (x.date !== y.date ? (x.date < y.date ? -1 : 1) : x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  // Oldest first is a sum spread over the pieces, so the payments' own order does not matter.
  let paid = sumOf(account.payments.filter((p) => !p.deleted && p.counts && toFarm(p.creditor) && p.saleId !== saleId).map((p) => p.amountSatang));
  let deduct = Math.max(0, deductSatang);
  const out: DebtPiece[] = [];
  for (const d of pieces) {
    const before = d.amountSatang - Math.min(d.amountSatang, Math.max(0, paid));
    paid -= d.amountSatang - before;
    if (before <= 0) continue;
    const take = Math.min(before, deduct);
    deduct -= take;
    out.push({
      id: d.id,
      kind: d.kind,
      date: d.date,
      amountSatang: d.amountSatang,
      leftBeforeSatang: before,
      leftAfterSatang: before - take,
    });
  }
  return out;
}

// ── CO-3 / CO-5 · one worker's draft ────────────────────────────────────────

export interface CloseoutWorkerInput {
  readonly id: string;
  readonly name: string;
  readonly shareSatang: number;
  /** Farm debt as if nothing were deducted at this sale yet. */
  readonly balanceSatang: number;
  readonly planPerSaleSatang: number | null;
  /** What the farm owes the worker (for netting), with this sale's netting added back. */
  readonly owedBackSatang: number;
  /** This sale's recorded lines (already confirmed once), or null when none. */
  readonly recorded: { readonly totalSatang: number; readonly nettingSatang: number; readonly route: RepayRoute | null } | null;
}

/** What the owner changed on screen; anything absent follows the proposal / recorded lines / preference. */
export interface CloseoutWorkerDraft {
  /** Total deducted at this sale (route + netting); null = follow the proposal. */
  readonly totalSatang?: number | null;
  readonly nettingSatang?: number;
  readonly route?: RepayRoute;
}

export type ProposalReason = 'plan' | 'all' | 'cut';

export interface CloseoutWorker {
  readonly id: string;
  readonly name: string;
  readonly shareSatang: number;
  readonly hasDebt: boolean;
  readonly proposedSatang: number;
  /** "หักตามงวดผ่อน" / "หักเต็ม…" / cut at the share (CO-3, A2). */
  readonly reason: ProposalReason;
  readonly capSatang: number;
  readonly totalSatang: number;
  readonly nettingSatang: number;
  readonly netCapSatang: number;
  /** Collected by the chosen route (total − netting). */
  readonly routeSatang: number;
  readonly route: RepayRoute;
  readonly cashBeforeSatang: number;
  readonly adjustSatang: number;
  /** Cash handed to the worker after rounding (route 1 already lifted out). */
  readonly cashSatang: number;
  readonly debtLeftSatang: number;
  /** CO-4: debt left while cash is 0 (or debt above the share) → yellow chip "หนี้ยังเหลือ X". */
  readonly leftChip: boolean;
  /** The draft amount is outside 0..cap (or below netting): the sheet's ตกลง stays off. */
  readonly invalid: boolean;
  /** Why it is invalid, so the sheet says the right thing (null when valid). */
  readonly problem: Exclude<DeductProblem, 'nothing'> | null;
  /** Draft differs from what is recorded (needs a write on confirm). */
  readonly dirty: boolean;
}

/** CO-5 shortcuts. half = cap / 2 floored to whole baht. */
export function quickAmounts(capSatang: number): { full: number; half: number; none: number } {
  const full = Math.max(0, capSatang);
  return { full, half: Math.floor(full / 200) * 100, none: 0 };
}

/**
 * CO-7 / CO-26 (owner Q1: partial netting): the draft patch that nets
 * `nettingSatang` of what the farm owes this worker against their debt.
 * Only the netting part of the deduction moves (what the route collects
 * stays), never past the worker's whole debt. Ceiling = `netCapSatang`
 * (what the farm owes, capped by the debt); above it, or below 0 → null
 * (refused). 0 removes the netting.
 */
export function netDraft(w: CloseoutWorker, nettingSatang: number): { nettingSatang: number; totalSatang: number } | null {
  if (!Number.isInteger(nettingSatang) || nettingSatang < 0 || nettingSatang > w.netCapSatang) return null;
  const balance = w.totalSatang + w.debtLeftSatang;
  const routePart = Math.max(0, w.totalSatang - w.nettingSatang);
  return { nettingSatang, totalSatang: Math.min(routePart + nettingSatang, balance) };
}

// ── CO-1 / CO-9 / CO-19 · the whole sale ────────────────────────────────────

export interface CloseoutInput {
  readonly saleTotalSatang: number;
  readonly ownerShareSatang: number;
  readonly workers: readonly CloseoutWorkerInput[];
  readonly drafts: Readonly<Record<string, CloseoutWorkerDraft>>;
  /** The route to start from per worker when nothing is recorded (CO-23 preference). */
  readonly defaultRoute: (workerId: string) => RepayRoute;
  /** Recorded rounding for this sale, else the CO-23 preference. */
  readonly rounding: RoundingMode;
}

export interface TallyBar {
  readonly ok: boolean;
  /** Σ − sale total: < 0 short, > 0 over. */
  readonly diffSatang: number;
  readonly sumSatang: number;
}

export interface CloseoutPlan {
  readonly workers: readonly CloseoutWorker[];
  readonly rounding: RoundingMode;
  /** Any worker's cash before rounding has satang (CO-19: the rounding row shows only then). */
  readonly hasFraction: boolean;
  /** Owner share before rounding (the sale's split, D-85: shown apart from the rounding). */
  readonly ownerShareSatang: number;
  /** Owner share after rounding. */
  readonly ownerSatang: number;
  /** Into the farm's account: owner share after rounding + route-3 repayments (D-71, D-85 split below). */
  readonly transferSatang: number;
  readonly transferRepaySatang: number;
  /** Debt cash the buyer hands apart (route 2). */
  readonly buyerSplitSatang: number;
  /** Debt cash lifted out of workers' cash (route 1). */
  readonly pickedSatang: number;
  /** CO-9: Σ worker cash + transfer + buyer-split + picked = sale total. */
  readonly tally: TallyBar;
  /** CO-19: skip the cash step when no one has a deduction and nothing has satang. */
  readonly cashStepNeeded: boolean;
  readonly anyInvalid: boolean;
}

/**
 * One worker before rounding. Every number comes from `deductSheet` (the
 * E06-S04 sheet), so the proposal and cap are the old ones exactly.
 *
 * Starting point, per field: the draft; else this sale's recorded lines;
 * else the proposal (total), 0 (netting) and `defaultRoute` (route). A draft
 * total of `null` is "follow the proposal" even over recorded lines (the
 * owner reset it). reason: 'plan' = the instalment was proposed; 'all' = the
 * whole balance fits; 'cut' = cut at the share (+ netting).
 */
function workerDraft(w: CloseoutWorkerInput, d: CloseoutWorkerDraft | undefined, defaultRoute: (id: string) => RepayRoute) {
  const rec = w.recorded;
  const nettingSatang = d?.nettingSatang ?? rec?.nettingSatang ?? 0;
  const typed = d && d.totalSatang !== undefined ? d.totalSatang : rec ? rec.totalSatang : null;
  const sheet = deductSheet({
    balanceSatang: w.balanceSatang,
    shareSatang: w.shareSatang,
    owedBackSatang: w.owedBackSatang,
    planPerSaleSatang: w.planPerSaleSatang,
    totalSatang: typed,
    nettingSatang,
    editing: rec !== null,
  });
  const route = d?.route ?? rec?.route ?? defaultRoute(w.id);
  const balance = Math.max(0, w.balanceSatang);
  const reason: ProposalReason = w.planPerSaleSatang !== null && sheet.proposedSatang === w.planPerSaleSatang ? 'plan' : sheet.proposedSatang >= balance ? 'all' : 'cut';
  const invalid = sheet.problem !== null && sheet.problem !== 'nothing';
  const recRoute = rec ? rec.totalSatang - rec.nettingSatang : 0;
  const dirty = rec
    ? rec.totalSatang !== sheet.totalSatang || rec.nettingSatang !== sheet.nettingSatang || (sheet.routeSatang > 0 && (recRoute !== sheet.routeSatang || rec.route !== route))
    : sheet.totalSatang > 0;
  // D-60: cash = share + netting − deduction (route 1 is lifted out of it later, so it is in the deduction too).
  const cashBeforeSatang = workerCash({
    shareSatang: Math.max(0, w.shareSatang),
    deductionSatang: sheet.totalSatang,
    nettingSatang: sheet.nettingSatang,
    adjustSatang: 0,
  });
  return {
    sheet,
    route,
    reason,
    invalid,
    dirty,
    cashBeforeSatang,
    hasDebt: balance > 0,
  };
}

/**
 * The whole sale (D-60 order: share → deduct → round → cash). Rounding is
 * `roundSettlement` over every worker's cash before rounding; the owner
 * absorbs the opposite. CO-4 `leftChip`: debt left after this sale while the
 * worker's cash is 0 (the debt was above what the share could take).
 */
export function closeoutPlan(input: CloseoutInput): CloseoutPlan {
  const drafted = input.workers.map((w) => ({
    w,
    ...workerDraft(w, input.drafts[w.id], input.defaultRoute),
  }));
  const rounded = roundSettlement(
    drafted.map((x) => ({ id: x.w.id, cashBeforeSatang: x.cashBeforeSatang })),
    input.rounding,
    input.ownerShareSatang,
  );
  const workers: CloseoutWorker[] = drafted.map((x, i) => {
    const r = rounded.workers[i];
    return {
      id: x.w.id,
      name: x.w.name,
      shareSatang: x.w.shareSatang,
      hasDebt: x.hasDebt,
      proposedSatang: x.sheet.proposedSatang,
      reason: x.reason,
      capSatang: x.sheet.capSatang,
      totalSatang: x.sheet.totalSatang,
      nettingSatang: x.sheet.nettingSatang,
      netCapSatang: x.sheet.netCapSatang,
      routeSatang: x.sheet.routeSatang,
      route: x.route,
      cashBeforeSatang: x.cashBeforeSatang,
      adjustSatang: r.adjustSatang,
      cashSatang: r.cashSatang,
      debtLeftSatang: x.sheet.debtLeftSatang,
      leftChip: x.sheet.debtLeftSatang > 0 && r.cashSatang === 0,
      invalid: x.invalid,
      problem: x.sheet.problem === 'nothing' ? null : x.sheet.problem,
      dirty: x.dirty,
    };
  });
  const by = (route: RepayRoute) => sumOf(workers.filter((w) => w.route === route).map((w) => w.routeSatang));
  const transferRepaySatang = by('transfer-with-owner');
  const buyerSplitSatang = by('buyer-split');
  const pickedSatang = by('cash-from-share');
  const transferSatang = rounded.ownerSatang + transferRepaySatang;
  const tally = pilesCheck([...workers.map((w) => ({ satang: w.cashSatang })), { satang: transferSatang }, { satang: buyerSplitSatang }, { satang: pickedSatang }], input.saleTotalSatang);
  const hasFraction = rounded.needsAsking;
  return {
    workers,
    rounding: input.rounding,
    hasFraction,
    ownerShareSatang: input.ownerShareSatang,
    ownerSatang: rounded.ownerSatang,
    transferSatang,
    transferRepaySatang,
    buyerSplitSatang,
    pickedSatang,
    tally,
    cashStepNeeded: hasFraction || workers.some((w) => w.routeSatang > 0),
    anyInvalid: workers.some((w) => w.invalid),
  };
}

// ── CO-9 · "ดูที่มา" (A8): the three checks of D-85 ──────────────────────────

export type SourceParty = 'worker' | 'farm';

export interface SourcesSheet {
  /** ① shares + owner = sale. */
  readonly shares: { readonly lines: readonly { readonly id: string; readonly name: string; readonly satang: number }[]; readonly ownerSatang: number; readonly ok: boolean };
  /**
   * ② per tapper ↘ "จ่ายหนี้" (−total) and ↗ netting got back (+); then the
   * farm: ONE ↘ "รับคืนหนี้" (+Σ total, netting included) and ↗ per netted
   * tapper (−netting). Sums to 0. down = Σ total = received + netted (A8, A25).
   */
  readonly debt: {
    readonly lines: readonly { readonly id: string; readonly party: SourceParty; readonly name: string; readonly way: 'in' | 'out'; readonly satang: number }[];
    readonly downSatang: number;
    readonly receivedSatang: number;
    readonly nettedSatang: number;
    readonly ok: boolean;
  };
  /** ③ rounding adjustments, workers vs farm; sums to 0. */
  readonly rounding: { readonly lines: readonly { readonly id: string; readonly party: SourceParty; readonly name: string; readonly satang: number }[]; readonly ok: boolean };
  /** Money really paid by the buyer: cash per worker, cash repayments, transfer = sale; the transfer told apart (A8). */
  readonly paid: {
    readonly lines: readonly { readonly id: string; readonly kind: 'cash' | 'transfer' | 'repay-cash'; readonly name: string; readonly satang: number }[];
    readonly transfer: { readonly ownerShareSatang: number; readonly roundSatang: number; readonly repaySatang: number };
    readonly ok: boolean;
  };
}

/**
 * Line ids: shares and cash use the worker id; ② uses `<id>-pay` (worker
 * pays, −total), `<id>-net` (↗ the worker gets netting back, +),
 * 'farm-recv' (the farm receives every deduction, netting included, +) and
 * `farm-net-<id>` (↗ the farm repays by netting, −); ③ and owner lines use
 * id 'owner' with an empty name and party 'farm' (the screen names the
 * farm); paid uses the worker id (cash), `<id>-repay` (repay-cash) and
 * 'transfer'. Each check is computed from the money as it stands: ② fails
 * when a worker's cash was held at 0 below share − route (over the cap, D-61).
 */
export function sourcesSheet(plan: CloseoutPlan, saleTotalSatang: number, ownerShareSatang: number): SourcesSheet {
  const ws = plan.workers;
  const shareLines = ws.map((w) => ({ id: w.id, name: w.name, satang: w.shareSatang }));
  const worker = 'worker' as const;
  const farm = 'farm' as const;
  const paying = ws.filter((w) => w.totalSatang > 0 || w.nettingSatang > 0);
  const netted = ws.filter((w) => w.nettingSatang > 0);
  const downSatang = sumOf(paying.map((w) => w.totalSatang));
  const nettedSatang = sumOf(netted.map((w) => w.nettingSatang));
  const debtLines = [
    ...paying.flatMap((w) => [
      { id: `${w.id}-pay`, party: worker, name: w.name, way: 'in' as const, satang: -w.totalSatang },
      ...(w.nettingSatang > 0 ? [{ id: `${w.id}-net`, party: worker, name: w.name, way: 'out' as const, satang: w.nettingSatang }] : []),
    ]),
    ...(paying.length ? [{ id: 'farm-recv', party: farm, name: '', way: 'in' as const, satang: downSatang }] : []),
    ...netted.map((w) => ({ id: `farm-net-${w.id}`, party: farm, name: w.name, way: 'out' as const, satang: -w.nettingSatang })),
  ];
  const roundLines = [
    ...ws.filter((w) => w.adjustSatang !== 0).map((w) => ({ id: w.id, party: worker, name: w.name, satang: w.adjustSatang })),
    ...(plan.ownerSatang !== ownerShareSatang ? [{ id: 'owner', party: farm, name: '', satang: plan.ownerSatang - ownerShareSatang }] : []),
  ];
  const paidLines = [
    ...ws.map((w) => ({ id: w.id, kind: 'cash' as const, name: w.name, satang: w.cashSatang })),
    ...ws.filter((w) => w.routeSatang > 0 && w.route !== 'transfer-with-owner').map((w) => ({ id: `${w.id}-repay`, kind: 'repay-cash' as const, name: w.name, satang: w.routeSatang })),
    { id: 'transfer', kind: 'transfer' as const, name: '', satang: plan.transferSatang },
  ];
  const piles = ws.every((w) => w.cashBeforeSatang === w.shareSatang + w.nettingSatang - w.totalSatang);
  // Paying lines carry their own netting, so the sheet's ② holds only when every route part and netting is inside the total.
  const consistent = paying.every((w) => w.routeSatang + w.nettingSatang === w.totalSatang);
  return {
    shares: { lines: shareLines, ownerSatang: ownerShareSatang, ok: sumOf(shareLines.map((l) => l.satang)) + ownerShareSatang === saleTotalSatang },
    debt: {
      lines: debtLines,
      downSatang,
      receivedSatang: sumOf(ws.map((w) => w.routeSatang)),
      nettedSatang,
      ok: piles && consistent && sumOf(debtLines.map((l) => l.satang)) === 0,
    },
    rounding: { lines: roundLines, ok: sumOf(roundLines.map((l) => l.satang)) === 0 },
    paid: {
      lines: paidLines,
      transfer: { ownerShareSatang, roundSatang: plan.ownerSatang - ownerShareSatang, repaySatang: plan.transferRepaySatang },
      ok: sumOf(paidLines.map((l) => l.satang)) === saleTotalSatang,
    },
  };
}

// ── CO-24 · break a note so route 1 can be lifted out exactly ───────────────

export interface NoteCount {
  readonly satang: number;
  readonly count: number;
}

export interface BreakPlan {
  /** The worker's cash pile as the buyer hands it (cashNotes), grouped. */
  readonly pile: readonly NoteCount[];
  /** What the farm lifts out after the break, grouped. */
  readonly take: readonly NoteCount[];
  /** Small money (below the note broken) in the pile, and how short it is of what is needed. */
  readonly smallSatang: number;
  readonly shortSatang: number;
  /** The one note to ask the buyer to break, and what into: Σ into = broken (test). */
  readonly broken: number;
  readonly into: readonly NoteCount[];
}

const NOTE_STEPS = [100000, 50000, 10000, 5000, 2000, 1000, 500, 200, 100];

/** Exact subset of an explicit note list summing to `take` (largest first), or null. */
export function liftableNotes(notes: readonly number[], takeSatang: number): number[] | null {
  if (takeSatang === 0) return [];
  if (takeSatang < 0) return null;
  // Reachable totals → (the total before, the note added): a back-pointer, not a copied list per total.
  const from = new Map<number, readonly [number, number]>([[0, [0, 0]]]);
  for (const n of [...notes].sort((a, b) => b - a)) {
    for (const r of [...from.keys()]) if (r + n <= takeSatang && !from.has(r + n)) from.set(r + n, [r, n]);
    if (from.has(takeSatang)) {
      const out: number[] = [];
      for (let r = takeSatang; r > 0; r = from.get(r)![0]) out.push(from.get(r)![1]);
      return out.sort((a, b) => b - a);
    }
  }
  return null;
}

/** The largest total ≤ cap a subset of `notes` reaches. */
function bestBelow(notes: readonly number[], cap: number): number {
  let reach = new Set<number>([0]);
  for (const n of notes) for (const r of [...reach]) if (r + n <= cap) reach.add(r + n);
  return Math.max(...reach);
}

/**
 * The preferred change for one note (story CO-24): one of the next lower
 * note, then the rest in the note below that except one of it, which goes
 * into the note below again; any remainder greedily. ฿1,000 → ฿500 ×1 ·
 * ฿100 ×4 · ฿50 ×2. ฿1 has no smaller note: null.
 */
function preferredMix(n: number): number[] | null {
  const lower = NOTE_STEPS.filter((x) => x < n);
  if (!lower.length) return null;
  const [l1, l2] = lower;
  const out = [l1];
  let rest = n - l1;
  if (l2 !== undefined && rest > l2) {
    const k = Math.floor(rest / l2) - 1;
    for (let i = 0; i < k; i += 1) out.push(l2);
    rest -= k * l2;
    for (const x of lower.filter((y) => y < l2))
      while (rest >= x) {
        out.push(x);
        rest -= x;
      }
  }
  for (const x of lower)
    while (rest >= x) {
      out.push(x);
      rest -= x;
    }
  return rest === 0 ? out : null;
}

/**
 * null when no break is needed (pickNotes works), nothing can be taken
 * (take ≤ 0 or above the pile), or no single break can do it (a take whose
 * satang the pile's coins cannot make). Otherwise the smallest note in the
 * pile whose break makes `take` liftable exactly. Mix tried first: the
 * preferred change (`preferredMix`, ฿1,000 → ฿500 ×1 · ฿100 ×4 · ฿50 ×2);
 * failing that, the note is changed into exactly what is missing (the take
 * less the most the other notes reach without passing it) plus the rest,
 * both as cashNotes — always possible for a whole-baht take, since every
 * note left out of that best total is larger than the gap.
 * smallSatang = money in notes below the broken one; shortSatang = what the
 * take needs below the broken note (take − the most the broken-or-larger
 * notes reach without passing it) minus smallSatang.
 */
export function breakPlan(pileSatang: number, takeSatang: number): BreakPlan | null {
  if (takeSatang <= 0 || takeSatang > pileSatang || pickNotes(pileSatang, takeSatang) !== null) return null;
  const notes = cashNotes(pileSatang);
  const breakable = [...new Set(notes)].filter((n) => NOTE_STEPS.includes(n) && n > NOTE_STEPS[NOTE_STEPS.length - 1]).sort((a, b) => a - b);
  for (const n of breakable) {
    const rest = [...notes];
    rest.splice(rest.indexOf(n), 1);
    const mixes: number[][] = [];
    const pref = preferredMix(n);
    if (pref) mixes.push(pref);
    // Else exactly what is missing: the gap between the take and the most the other notes reach without passing it.
    // The satang coin (cashNotes' leftover) can only be in it whole: with a satang take, it must be.
    const coin = rest.find((x) => !NOTE_STEPS.includes(x)) ?? 0;
    const target = takeSatang % 100 === 0 ? takeSatang : takeSatang - coin;
    const gap =
      target -
      bestBelow(
        rest.filter((x) => NOTE_STEPS.includes(x)),
        target,
      );
    if (gap > 0 && gap < n && gap % 100 === 0) mixes.push([...cashNotes(gap), ...cashNotes(n - gap)]);
    for (const mix of mixes) {
      const after = [...rest, ...mix];
      const take = liftableNotes(after, takeSatang);
      if (!take) continue;
      const smallSatang = sumOf(notes.filter((x) => x < n));
      const need =
        takeSatang -
        bestBelow(
          notes.filter((x) => x >= n),
          takeSatang,
        );
      return {
        pile: groupNotes(notes),
        take: groupNotes(take),
        smallSatang,
        shortSatang: Math.max(0, need - smallSatang),
        broken: n,
        into: groupNotes(mix),
      };
    }
  }
  return null;
}

/** Group a note list (largest first) into chips "฿1,000 ×9". */
export function groupNotes(notes: readonly number[]): NoteCount[] {
  const out: { satang: number; count: number }[] = [];
  for (const n of [...notes].sort((a, b) => b - a)) {
    const last = out[out.length - 1];
    if (last && last.satang === n) last.count += 1;
    else out.push({ satang: n, count: 1 });
  }
  return out;
}

// ── CO-17 / CO-26 · the confirm button's gate ───────────────────────────────

export type ConfirmGate =
  | { readonly kind: 'ready' }
  | { readonly kind: 'check-debt'; readonly names: readonly string[] }
  | { readonly kind: 'check-owed' }
  | { readonly kind: 'check-both' }
  | { readonly kind: 'answer-debt' }
  | { readonly kind: 'answer-owed' }
  | { readonly kind: 'answer-both' }
  | { readonly kind: 'tally' }
  | { readonly kind: 'invalid' };

export function confirmGate(i: {
  /** Workers with farm debt (debt card shows them); empty = the card asks "มีหนี้ค้างไหม". */
  readonly debtors: readonly { readonly id: string; readonly name: string }[];
  readonly debtChecked: ReadonlySet<string>;
  /** Asking card answered "ไม่มี" (no debts recorded). */
  readonly debtAnswered: boolean;
  /** Workers the farm owes (owed card); empty = asking card. */
  readonly owed: readonly { readonly id: string }[];
  readonly owedChecked: ReadonlySet<string>;
  readonly owedAnswered: boolean;
  /**
   * D-61: a recorded deduction above the share (the sale edited down after) is
   * NOT a gate of its own — the summary is where the owner fixes it. Its draft
   * starts at the recorded total, above the cap, so the plan is invalid
   * ('invalid' below) until the owner lowers it; the payment page keeps its
   * ticks and close locked meanwhile.
   */
  readonly plan: CloseoutPlan;
}): ConfirmGate {
  const unchecked = i.debtors.filter((d) => !i.debtChecked.has(d.id));
  const debt: 'check' | 'answer' | null = i.debtors.length ? (unchecked.length ? 'check' : null) : i.debtAnswered ? null : 'answer';
  const owed: 'check' | 'answer' | null = i.owed.length ? (i.owed.some((o) => !i.owedChecked.has(o.id)) ? 'check' : null) : i.owedAnswered ? null : 'answer';
  // Both cards pending: "ตอบ…ทั้ง 2 ใบ" only when both ask; any card with names to check makes it "ตรวจ…ทั้ง 2 ใบ".
  if (debt && owed)
    return {
      kind: debt === 'answer' && owed === 'answer' ? 'answer-both' : 'check-both',
    };
  if (debt === 'check') return { kind: 'check-debt', names: unchecked.map((d) => d.name) };
  if (debt === 'answer') return { kind: 'answer-debt' };
  if (owed === 'check') return { kind: 'check-owed' };
  if (owed === 'answer') return { kind: 'answer-owed' };
  if (i.plan.anyInvalid) return { kind: 'invalid' };
  if (!i.plan.tally.ok) return { kind: 'tally' };
  // The cash step is not a gate (owner 2026-10-31, A3): its defaults stand until the owner changes them.
  return { kind: 'ready' };
}

// ── Confirm: the existing events, one worker at a time ──────────────────────

export interface RecordedLine {
  readonly id: string;
  readonly headEventId: string;
  readonly method: DebtPaymentMethod;
  readonly amountSatang: number;
  readonly repaymentId?: string;
  /** The live repayment a netting line rides on (its head), when any. */
  readonly repaymentHead?: string;
}

export type CloseoutWrite =
  | { readonly op: 'void-repayment'; readonly id: string; readonly base: string }
  | { readonly op: 'void-payment'; readonly id: string; readonly base: string }
  | { readonly op: 'write'; readonly id: string; readonly base: null; readonly payload: FinancePayload };

/**
 * The writes for one worker so the recorded lines equal the plan: nothing
 * when they already match (idempotent — re-running after a stop writes only
 * what is missing, and a second tap on the same device finds its own lines).
 * Old lines are voided first (repayment before its debt payment), then
 * netting (debt payment, then repayment), then the route line. Returns
 * { ok:false } when the netting cannot be placed, or the plan is invalid
 * (nothing is written).
 *
 * Ids (owner 2026-11-01): fresh ones from `newId` (the app passes the
 * UUIDv7 `newId`, as the old page did; tests pass a counter), never built
 * from the sale or the worker. Two offline devices confirming the same sale
 * then write separate records that BOTH count — the sum shows as deducted
 * over the share (D-61) for the owner to fix, instead of one device's lines
 * silently replacing the other's (or a netting debt payment pairing with
 * another device's repayment of a different amount).
 * "Matches" = netting total equal, route total equal, and every route line
 * on the plan's route (no route lines when routeSatang is 0).
 */
export function confirmWrites(i: {
  readonly saleId: string;
  readonly date: string;
  readonly worker: Payer;
  readonly farm: Payer;
  readonly plan: CloseoutWorker;
  readonly recorded: readonly RecordedLine[];
  readonly owed: readonly Reimbursement[];
  /** A fresh, globally unique id with this prefix ('dpay-' debt payment, 'rep-' repayment). */
  readonly newId: (prefix: 'dpay-' | 'rep-') => string;
}): { ok: true; writes: CloseoutWrite[] } | { ok: false } {
  const { plan, recorded, saleId, worker } = i;
  if (plan.invalid) return { ok: false };
  const netLines = recorded.filter((l) => l.method === 'netting');
  const routeLines = recorded.filter((l) => l.method !== 'netting');
  const matches =
    sumOf(netLines.map((l) => l.amountSatang)) === plan.nettingSatang &&
    sumOf(routeLines.map((l) => l.amountSatang)) === plan.routeSatang &&
    (plan.routeSatang === 0 ? routeLines.length === 0 : routeLines.every((l) => l.method === plan.route));
  if (matches) return { ok: true, writes: [] };

  const id = {
    net: plan.nettingSatang > 0 ? i.newId('dpay-') : '',
    rep: plan.nettingSatang > 0 ? i.newId('rep-') : '',
    route: plan.routeSatang > 0 ? i.newId('dpay-') : '',
  };

  const netting =
    plan.nettingSatang > 0
      ? nettingPayloads({
          worker,
          farm: i.farm,
          owed: i.owed,
          amountSatang: plan.nettingSatang,
          saleId,
          date: i.date,
          repaymentId: id.rep,
        })
      : null;
  if (netting && !netting.ok) return { ok: false };

  const writes: CloseoutWrite[] = [];
  // The old lines go first, so a stop part-way leaves less deducted, never twice; a repayment before its debt payment.
  for (const l of recorded) {
    if (l.method === 'netting' && l.repaymentId && l.repaymentHead)
      writes.push({
        op: 'void-repayment',
        id: l.repaymentId,
        base: l.repaymentHead,
      });
    writes.push({ op: 'void-payment', id: l.id, base: l.headEventId });
  }
  if (netting?.ok) {
    // The debt payment counts only with its repayment: written first, a stop between the two changes nothing.
    writes.push({
      op: 'write',
      id: id.net,
      base: null,
      payload: netting.debtPayment,
    });
    writes.push({
      op: 'write',
      id: id.rep,
      base: null,
      payload: netting.repayment,
    });
  }
  if (plan.routeSatang > 0) {
    writes.push({
      op: 'write',
      id: id.route,
      base: null,
      payload: {
        t: 'debt_payment_recorded',
        fields: {
          worker,
          creditor: i.farm,
          amountSatang: plan.routeSatang,
          date: i.date,
          note: '',
          method: plan.route,
          saleId,
        },
      },
    });
  }
  return { ok: true, writes };
}

// ── CO-25 · repayments not yet received ─────────────────────────────────────

export interface PendingRepay {
  readonly workerId: string;
  readonly name: string;
  readonly satang: number;
  readonly how: 'transfer' | 'cash';
}

/** Repayments whose money has not been ticked as received (owner transfer tick / debt-cash tick). */
export function pendingRepays(
  plan: CloseoutPlan,
  ticked: { readonly owner: boolean; readonly debtCash: (workerId: string) => boolean },
): PendingRepay[] {
  return plan.workers
    .filter((w) => w.routeSatang > 0)
    .map((w) => ({
      workerId: w.id,
      name: w.name,
      satang: w.routeSatang,
      how: w.route === 'transfer-with-owner' ? ('transfer' as const) : ('cash' as const),
    }))
    .filter((p) => (p.how === 'transfer' ? !ticked.owner : !ticked.debtCash(p.workerId)));
}
