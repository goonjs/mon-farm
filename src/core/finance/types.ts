/**
 * The farm finance ledger (E11): expenses, money the farm owes back, and
 * repayments. Pure types — nothing here imports react, react-native or expo.
 *
 * MONEY IS INTEGER SATANG, as everywhere in `src/core` (NFR-3).
 * DATES ARE "YYYY-MM-DD" — the calendar day the money moved, chosen by a
 * person; it is a fact about the expense, not a clock reading, so ordering by
 * it is allowed (the device `ts` still never orders anything).
 *
 * ── Shape: the architecture's record model, already ─────────────────────────
 *
 * Every event names the record it creates or changes (`targetId`) and, for a
 * change, the head the editor saw (`baseEventId`) — the model in
 * architecture §Sync engine. Two changes with the same base are concurrent;
 * the projection merges them field by field and raises a Conflict when both
 * touched a money or stage field (D-30), instead of letting one silently win.
 *
 * Expenses are not sale-scoped, so they live in their own append-only log
 * (`src/store/finance.ts`) rather than in a sale's — the sale log is still
 * keyed `(saleId, seq)` until the envelope redesign lands (E04-S01), and the
 * two meet in one `events` table then.
 */

import type { Actor, EventId, GroupId, Source } from '../types';

/** The payer id for the farm's own money — "เงินสวน" (D-62). Creates nothing owed back. */
export const FARM_FUNDS = 'farm';

/** Who paid / who is repaid. `name` is a snapshot, like `workerName` on a contract. */
export interface Payer {
  readonly id: string;
  readonly name: string;
}

export type Stage = 'actual' | 'committed' | 'planned';

export interface ExpenseFields {
  /** null only while planned — "ไม่ทราบ", never a silent zero (D-62, SYNC-12). */
  readonly amountSatang: number | null;
  readonly date: string;
  readonly stage: Stage;
  readonly categoryId: string | null;
  /** Optional: which farm (สวน) — E03-S02 ids. */
  readonly propertyId: string | null;
  readonly item: string;
  readonly note: string;
  /** null = not recorded yet (F7: fertilizer owner-share expenses may leave it for later). */
  readonly payer: Payer | null;
  /** E11-S05: a special payment to a worker (aid) — never touches a sale's settlement. */
  readonly worker?: Payer | null;
  readonly aidKind?: AidKind | null;
  /** E11-S06: a trip — the amount is the sum of its lines. null clears it (an absent key cannot, once stored). */
  readonly trip?: Trip | null;
  /** E11-S10: split with tappers (by sacks for fertilizer). `amountSatang` is then the net bill. null = not shared. */
  readonly share?: ExpenseShare | null;
  /** E11-S10: what was bought and why — data for tracking, no money in it. */
  readonly fertilizer?: FertilizerDetails | null;
  /** E11-S11: items bought on one shop order share an `orderId`; absent/null = a single expense (legacy or one-off). */
  readonly orderId?: string | null;
  /** E11-S11: the item's own typed discount plus its allocated share of the order discount; `amountSatang` is the net (gross − this). */
  readonly discountSatang?: number;
  /** E11-S11: how many units of what at what price, for any item of an order (fertilizer items also keep sacks in `fertilizer`). */
  readonly line?: OrderLine | null;
}

/** One item of a shop order: `grossSatang` is the source of truth (a unit price may not divide it exactly). */
export interface OrderLine {
  readonly qty: number;
  /** "กระสอบ", "ลิตร", "ขวด"… */
  readonly unit: string;
  readonly grossSatang: number;
  /** Typed on the item (E11-S11 FO-15); the allocated share of the bill discount is NOT here. */
  readonly itemDiscountSatang: number;
}

/** "ลงหนี้" makes a worker debt once the expense is actual; "จ่ายแล้ว" records that they paid their part. */
export type ShareSettle = 'debt' | 'paid';

export interface ShareLine {
  readonly worker: Payer;
  /** Whole sacks; null when the expense is not counted in sacks (one tapper only). */
  readonly sacks: number | null;
  readonly workerPct: number;
  readonly settle: ShareSettle;
}

export interface ExpenseShare {
  readonly billSatang: number;
  readonly discountSatang: number;
  /** null = not counted in sacks. Sacks no line takes are the farm's (and stock, E10-S04). */
  readonly totalSacks: number | null;
  readonly lines: readonly ShareLine[];
}

export type FertilizerType = 'chemical' | 'manure' | 'other';

export interface FertilizerZoneUse {
  readonly zoneId: string;
  readonly zoneName: string;
  readonly sacks: number;
  /** Ids of saved reasons, or a typed reason prefixed `text:`. */
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface FertilizerDetails {
  readonly type: FertilizerType;
  /** Free text or a saved option's name, snapshot like `Payer.name`. */
  readonly formula: string;
  readonly brand: string;
  /** null = ไม่ทราบ. */
  readonly sackKg: number | null;
  readonly reasons: readonly string[];
  /** Empty = not recorded yet ("บันทึกภายหลังได้"). */
  readonly zones: readonly FertilizerZoneUse[];
  readonly shop: string;
  readonly orderedBy: string;
}

/** Saved choices the fertilizer flow offers again (ตั้งค่าปุ๋ย). */
export type FertOptionKind = 'reason' | 'formula' | 'brand' | 'sackKg';

export type AidKind = 'accident' | 'general' | 'food' | 'other';

export type TripCostKind = 'fuel' | 'toll' | 'lodging' | 'food' | 'other';

/** A farm (สวน) a cost can be split to — named here until a property store exists (E03-S02). */
export interface FarmRef {
  readonly id: string;
  readonly name: string;
}

export interface Trip {
  readonly from: string;
  readonly to: string;
  readonly purposes: readonly string[];
  readonly farms: readonly FarmRef[];
  readonly lines: readonly { readonly kind: TripCostKind; readonly satang: number }[];
  /** null = not split ("ไม่ได้แบ่ง") — never split automatically (FIN-7). */
  readonly split: readonly { readonly farmId: string; readonly satang: number }[] | null;
}

/** Fields an edit may set. `deleted` is Soft Delete (SYNC-10), carried as one more field. */
export type ExpensePatch = Partial<ExpenseFields> & { readonly deleted?: boolean };

export interface Allocation {
  readonly expenseId: string;
  readonly satang: number;
}

export interface RepaymentFields {
  /** Who handed the money over — default farm funds (D-59). */
  readonly from: Payer;
  /** Who received it — default the person owed. */
  readonly to: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly note: string;
  /** Which debts this repays; sums to `amountSatang`. Oldest-first by default (D-67). */
  readonly allocations: readonly Allocation[];
  /** Set when the repayment is netting at a sale's settlement (D-60). */
  readonly saleId: string | null;
}

export type RepaymentPatch = Partial<RepaymentFields> & { readonly deleted?: boolean };

// ── Worker debts (E06-S03) ──────────────────────────────────────────────────

export type DebtKind = 'loan' | 'fertilizer' | 'other';

export interface DebtFields {
  readonly worker: Payer;
  readonly kind: DebtKind;
  /** What the worker owes — for fertilizer, their share of the bill. */
  readonly amountSatang: number;
  readonly date: string;
  /** Required for "other" (D-59); for fertilizer it is what a later fertilizer system matches on. */
  readonly note: string;
  /** Loans only: who lent it. Farm funds = deductible; anyone else = shown, never deducted (D-69). */
  readonly lender: Payer | null;
  /** Manual fertilizer debt (D-59): the bill and the whole-number % the worker carries (F8). */
  readonly fertilizer: { readonly totalSatang: number; readonly workerPct: number } | null;
  /** Balance from before the app (F6) — still one of the three kinds. */
  readonly carriedForward: boolean;
  /** Set on a debt made from an expense's share (E11-S10) — edited at the expense, not here. */
  readonly expenseId?: string;
}

export type DebtPatch = Partial<DebtFields> & { readonly deleted?: boolean };

/**
 * How a repayment reached the creditor. The three settlement methods are
 * D-71's; `netting` is the farm's own money owed back set against the debt
 * (D-60); `outside` is paid back away from any sale.
 */
export type DebtPaymentMethod = 'outside' | 'cash-from-share' | 'buyer-split' | 'transfer-with-owner' | 'netting';

export interface DebtPaymentFields {
  readonly worker: Payer;
  /** Farm funds, or the outside lender the worker paid directly (D-69). */
  readonly creditor: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly note: string;
  readonly method: DebtPaymentMethod;
  /** The sale it was deducted at; a cancelled/deleted sale's deductions stop counting. */
  readonly saleId: string | null;
  /** Netting only: the farm-side repayment written with it, so the two void together. */
  readonly repaymentId?: string;
}

export type DebtPaymentPatch = Partial<DebtPaymentFields> & { readonly deleted?: boolean };

// ── Receiving accounts (E05-S07) ────────────────────────────────────────────

export interface AccountFields {
  /** What the owner calls it, e.g. "บัญชีหลัก". */
  readonly label: string;
  readonly bankCode: string | null;
  readonly accountNo: string;
  readonly accountName: string;
  readonly promptPay: { readonly type: 'mobile' | 'nationalId'; readonly id: string } | null;
}

export type AccountPatch = Partial<AccountFields> & { readonly deleted?: boolean };

/** Where a sale's owner transfer goes — an account, cash, a free note, or nothing recorded (all optional, D-38). */
export type SaleAccountChoice =
  | { readonly kind: 'account'; readonly accountId: string }
  | { readonly kind: 'cash' }
  | { readonly kind: 'note'; readonly note: string };

/** SET-6: pending · weight verified · sale total verified · difference found. */
export type BuyerCheckStatus = 'pending' | 'weight' | 'total' | 'diff';

/** Our figures for a sale, from the recorded baskets. */
export interface SaleFigures {
  readonly netG: number;
  readonly satangPerKg: number;
  readonly grossSatang: number;
  readonly baskets: number;
}

/** What the buyer said; null = not given. */
export interface BuyerFigures {
  readonly netG: number | null;
  readonly grossSatang: number | null;
  readonly baskets: number | null;
}
// ── Salary, income, leases, reserve (E11-S04, S07, S08) ─────────────────────

export interface SalaryRule {
  readonly recipient: Payer;
  readonly payer: Payer;
  readonly amountSatang: number;
  /** "YYYY-MM" — the first month owed. */
  readonly startMonth: string;
  /** Day of the month it falls due (1–28). */
  readonly dueDay: number;
}

export type IncomeTag = 'family' | 'insurance' | 'reserve';

export interface LeaseFields {
  readonly farmName: string;
  readonly tenant: string;
  /** null = ไม่ทราบ (SYNC-12) — never read as zero. */
  readonly rentSatang: number | null;
  readonly period: 'year' | 'month' | null;
  /** "YYYY-MM-DD", null = ไม่ทราบ. */
  readonly start: string | null;
  readonly end: string | null;
  /** Whole-number share %, null = ไม่ทราบ or none. */
  readonly sharePct: number | null;
  readonly note: string;
}

export type LeasePatch = Partial<LeaseFields> & { readonly deleted?: boolean };

export interface IncomeFields {
  readonly amountSatang: number;
  readonly date: string;
  readonly stage: 'actual' | 'planned';
  readonly leaseId: string | null;
  readonly note: string;
  readonly tag: IncomeTag | null;
}

export type IncomePatch = Partial<IncomeFields> & { readonly deleted?: boolean };

export type FinancePayload =
  | { readonly t: 'expense_created'; readonly fields: ExpenseFields }
  | { readonly t: 'expense_changed'; readonly patch: ExpensePatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'category_added'; readonly name: string }
  | { readonly t: 'category_renamed'; readonly name: string }
  /** E11-S10, targetId the category id: the default tapper % (whole 0–100); null = not shared. */
  | { readonly t: 'category_share_set'; readonly workerPct: number | null }
  /** E11-S10, targetId `fopt-<kind>-<key>` where key is the normalised name, so two devices adding one name meet. */
  | { readonly t: 'fert_option_set'; readonly kind: FertOptionKind; readonly name: string; readonly description: string; readonly hidden: boolean }
  | { readonly t: 'repayment_recorded'; readonly fields: RepaymentFields }
  | { readonly t: 'repayment_changed'; readonly patch: RepaymentPatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'debt_added'; readonly fields: DebtFields }
  | { readonly t: 'debt_changed'; readonly patch: DebtPatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'debt_payment_recorded'; readonly fields: DebtPaymentFields }
  | { readonly t: 'debt_payment_changed'; readonly patch: DebtPaymentPatch; readonly alsoBasedOn?: readonly EventId[] }
  /** One plan per worker (targetId `plan-<workerId>`); null cancels it. Instalment = per sale (D-59). */
  | { readonly t: 'debt_plan_set'; readonly worker: Payer; readonly perSaleSatang: number | null }
  | { readonly t: 'account_added'; readonly fields: AccountFields }
  | { readonly t: 'account_changed'; readonly patch: AccountPatch; readonly alsoBasedOn?: readonly EventId[] }
  /** targetId `default-account`; null = no default. */
  | { readonly t: 'account_default_set'; readonly accountId: string | null }
  /** targetId `sale-account-<saleId>`; null clears the choice. */
  | { readonly t: 'sale_account_set'; readonly saleId: string; readonly choice: SaleAccountChoice | null }
  /** targetId `sale-rounding-<saleId>` (E05-S02). The latest one this device wrote is next sale's default. */
  | { readonly t: 'sale_rounding_set'; readonly saleId: string; readonly mode: 'worker' | 'owner' | 'none' }
  /**
   * E05-S03: the one-time check against the buyer's figures, targetId
   * `buyer-check-<saleId>`. `basis` is our figures at the moment of the
   * check, so a basket edited afterwards shows as "check again" without a
   * write. Money always comes from our baskets, never from `buyer` (D-15).
   */
  /**
   * E05-S05: one payee's money handed over (a worker's cash, or 'owner' for
   * the owner's transfer), targetId `payment-<saleId>-<payee>`. Keeps the
   * amount it was ticked at, so a later change to that amount flags a recheck.
   */
  | { readonly t: 'payment_mark_set'; readonly saleId: string; readonly payee: string; readonly done: boolean; readonly amountSatang: number; readonly alsoBasedOn?: readonly EventId[] }
  | {
      readonly t: 'buyer_check_set';
      readonly saleId: string;
      readonly status: BuyerCheckStatus;
      readonly basis: SaleFigures;
      readonly buyer: BuyerFigures | null;
      readonly reason: string;
      readonly alsoBasedOn?: readonly EventId[];
    }
  /** targetId `salary-<id>`: creates the rule. */
  | { readonly t: 'salary_set'; readonly rule: SalaryRule }
  /** A new amount from `fromMonth` on; months already paid keep what was paid (FIN-5). */
  | { readonly t: 'salary_amount_set'; readonly fromMonth: string; readonly amountSatang: number }
  /** targetId `salary-<id>:<month>`; one per month however many devices tap it. */
  | { readonly t: 'salary_paid'; readonly month: string; readonly amountSatang: number; readonly date: string }
  | { readonly t: 'salary_unpaid'; readonly month: string }
  | { readonly t: 'lease_added'; readonly fields: LeaseFields }
  | { readonly t: 'lease_changed'; readonly patch: LeasePatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'income_recorded'; readonly fields: IncomeFields }
  | { readonly t: 'income_changed'; readonly patch: IncomePatch; readonly alsoBasedOn?: readonly EventId[] }
  /** targetId `reserve`: the owner's figure — the app never computes it (FIN-9). */
  | { readonly t: 'reserve_set'; readonly amountSatang: number; readonly assumption: string; readonly source: string };

export interface FinanceEvent {
  readonly id: EventId;
  /** The farm group this was recorded in — never absent (D-24, E02-S02). */
  readonly groupId: GroupId;
  readonly deviceSeq: number;
  /** Wall clock, for people reading the log. Never orders anything. */
  readonly ts: number;
  readonly actor: Actor;
  readonly source: Source;
  readonly targetId: string;
  /** The head the editor saw; null creates the record. */
  readonly baseEventId: EventId | null;
  readonly payload: FinancePayload;
}
