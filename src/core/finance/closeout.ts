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
import type { RoundingMode } from './deduct';
import type { DebtKind, DebtPaymentMethod, FinancePayload, Payer } from './types';
import type { Reimbursement } from './ledger';

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
  void account;
  void saleId;
  void deductSatang;
  throw new Error('not implemented');
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
  /** Draft differs from what is recorded (needs a write on confirm). */
  readonly dirty: boolean;
}

/** CO-5 shortcuts. half = cap / 2 floored to whole baht. */
export function quickAmounts(capSatang: number): { full: number; half: number; none: number } {
  void capSatang;
  throw new Error('not implemented');
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

export function closeoutPlan(input: CloseoutInput): CloseoutPlan {
  void input;
  throw new Error('not implemented');
}

// ── CO-9 · "ดูที่มา" (A8): the three checks of D-85 ──────────────────────────

export interface SourcesSheet {
  /** ① shares + owner = sale. */
  readonly shares: { readonly lines: readonly { readonly id: string; readonly name: string; readonly satang: number }[]; readonly ownerSatang: number; readonly ok: boolean };
  /** ② ↘ worker pays debt (−) and ↘ farm receives (+), ↗ netting pairs; sums to 0. */
  readonly debt: { readonly lines: readonly { readonly id: string; readonly name: string; readonly way: 'in' | 'out'; readonly satang: number }[]; readonly ok: boolean };
  /** ③ rounding adjustments, workers vs farm; sums to 0. */
  readonly rounding: { readonly lines: readonly { readonly id: string; readonly name: string; readonly satang: number }[]; readonly ok: boolean };
  /** Money really paid by the buyer: cash per worker, cash repayments, transfer = sale. */
  readonly paid: { readonly lines: readonly { readonly id: string; readonly kind: 'cash' | 'transfer' | 'repay-cash'; readonly name: string; readonly satang: number }[]; readonly ok: boolean };
}

export function sourcesSheet(plan: CloseoutPlan, saleTotalSatang: number, ownerShareSatang: number): SourcesSheet {
  void plan;
  void saleTotalSatang;
  void ownerShareSatang;
  throw new Error('not implemented');
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

/**
 * null when no break is needed (pickNotes works) or nothing can be taken
 * (take ≤ 0 or above the pile). Otherwise the smallest single note whose
 * break makes `take` liftable exactly; the mix offered for 1,000 is
 * ฿500 ×1 · ฿100 ×4 · ฿50 ×2 (story CO-24).
 */
export function breakPlan(pileSatang: number, takeSatang: number): BreakPlan | null {
  void pileSatang;
  void takeSatang;
  throw new Error('not implemented');
}

/** Group a note list (largest first) into chips "฿1,000 ×9". */
export function groupNotes(notes: readonly number[]): NoteCount[] {
  void notes;
  throw new Error('not implemented');
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
  | { readonly kind: 'cash-step' }
  | { readonly kind: 'tally' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'over' };

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
  readonly cashStepNeeded: boolean;
  readonly cashStepDone: boolean;
  readonly plan: CloseoutPlan;
  /** D-61: some worker is over-deducted already (sale edited after). */
  readonly over: boolean;
}): ConfirmGate {
  void i;
  throw new Error('not implemented');
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
 * what is missing). Old lines are voided first (repayment before its debt
 * payment), then netting (debt payment, then repayment), then the route
 * line. New ids are fixed per sale + worker + generation (`gen` = how many
 * lines this sale already had for the worker) so a double run cannot write
 * twice. Returns { ok:false } when the netting cannot be placed.
 */
export function confirmWrites(i: {
  readonly saleId: string;
  readonly date: string;
  readonly worker: Payer;
  readonly farm: Payer;
  readonly plan: CloseoutWorker;
  readonly recorded: readonly RecordedLine[];
  readonly owed: readonly Reimbursement[];
}): { ok: true; writes: CloseoutWrite[] } | { ok: false } {
  void i;
  throw new Error('not implemented');
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
  void plan;
  void ticked;
  throw new Error('not implemented');
}
