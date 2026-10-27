/**
 * Sharing an expense with tappers (E11-S10). The expense keeps the whole net
 * bill as one record; each tapper's part is a projection of it, so editing,
 * voiding or restoring the expense moves the debts with it, and two devices
 * can never create the same debt twice (the id is derived from the expense).
 *
 *   net = bill − discount
 *   cost per tapper = net × sacks ÷ total sacks   (all of it with no sacks)
 *   tapper's part   = fertilizerSplit(cost, %)    (half-up, rest is the owner's)
 *
 * Costs use cumulative rounding, so the lines plus the leftover sacks add up
 * to the net bill to the satang whatever the division.
 */

import { fertilizerSplit, type Expense } from './ledger';
import type { DebtFields, ExpenseShare, Payer, ShareSettle } from './types';

export { fertOptionId } from './ledger';

/** A share debt's id is `<expenseId>:share:<workerId>`. */
export const SHARE_DEBT_INFIX = ':share:';

export interface SplitLine {
  readonly worker: Payer;
  readonly sacks: number | null;
  readonly settle: ShareSettle;
  readonly costSatang: number;
  readonly workerSatang: number;
  readonly ownerSatang: number;
}

export interface SplitResult {
  readonly netSatang: number;
  readonly lines: readonly SplitLine[];
  readonly leftoverSacks: number;
  /** The leftover sacks' cost — the farm's. */
  readonly leftoverSatang: number;
  readonly workerTotalSatang: number;
  /** Owner parts of every line plus the leftover. */
  readonly ownerTotalSatang: number;
}

/** Callers check first (`checkShare`); a share that fails it still splits without throwing where it can. */
export function splitShare(share: ExpenseShare): SplitResult {
  const net = Math.max(0, share.billSatang - share.discountSatang);
  const total = share.totalSacks;
  let cum = 0;
  let given = 0;
  const at = (sacks: number) => (total ? Math.floor((2 * net * sacks + total) / (2 * total)) : net);
  const lines = share.lines.map((l) => {
    let cost: number;
    if (total && l.sacks !== null) {
      cum += l.sacks;
      const upTo = at(cum);
      cost = upTo - given;
      given = upTo;
    } else {
      cost = net;
    }
    const { workerSatang, ownerSatang } = fertilizerSplit(cost, l.workerPct);
    return { worker: l.worker, sacks: l.sacks, settle: l.settle, costSatang: cost, workerSatang, ownerSatang };
  });
  const leftoverSacks = total ? Math.max(0, total - cum) : 0;
  const leftoverSatang = total ? net - given : 0;
  const workerTotal = lines.reduce((s, l) => s + l.workerSatang, 0);
  return {
    netSatang: net,
    lines,
    leftoverSacks,
    leftoverSatang,
    workerTotalSatang: workerTotal,
    ownerTotalSatang: lines.reduce((s, l) => s + l.ownerSatang, 0) + leftoverSatang,
  };
}

export type ShareProblem = 'discount-over' | 'sacks-not-whole' | 'sacks-over' | 'pct-invalid' | 'worker-twice' | 'one-tapper-only';

export function checkShare(share: ExpenseShare): ShareProblem[] {
  const out = new Set<ShareProblem>();
  if (!Number.isSafeInteger(share.discountSatang) || share.discountSatang < 0 || share.discountSatang > share.billSatang) out.add('discount-over');
  const whole = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (share.totalSacks !== null) {
    if (!whole(share.totalSacks) || share.totalSacks < 1) out.add('sacks-not-whole');
    let sum = 0;
    for (const l of share.lines) {
      if (l.sacks === null || !whole(l.sacks)) out.add('sacks-not-whole');
      else sum += l.sacks;
    }
    if (sum > share.totalSacks) out.add('sacks-over');
  } else if (share.lines.length > 1) {
    out.add('one-tapper-only');
  }
  for (const l of share.lines) if (!Number.isInteger(l.workerPct) || l.workerPct < 0 || l.workerPct > 100) out.add('pct-invalid');
  if (new Set(share.lines.map((l) => l.worker.id)).size < share.lines.length) out.add('worker-twice');
  return [...out];
}

/** The sacks the last-picked tapper is given by default: whatever the others left (never negative). */
export function lastLineSacks(totalSacks: number, otherSacks: readonly number[]): number {
  return Math.max(0, totalSacks - otherSacks.reduce((a, b) => a + b, 0));
}

export interface ShareDebt extends DebtFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
  /** The expense's — a line added by a later edit counts from when the expense was made. */
  readonly recordedAt: number;
}

const owesNow = (x: { deleted: boolean; stage: string; share?: ExpenseShare | null }) => !x.deleted && x.stage === 'actual' && !!x.share;

/**
 * One debt per "ลงหนี้" line of an actual expense. A tapper whose line was
 * once owed and no longer is (voided, moved back from actual, switched to
 * "จ่ายแล้ว", removed) keeps a voided debt, so their history shows it.
 */
export function shareDebts(expenses: readonly Expense[]): ShareDebt[] {
  const out: ShareDebt[] = [];
  for (const x of expenses) {
    const ever = new Map<string, Payer>();
    for (const h of [...x.history, x]) {
      if (!owesNow(h)) continue;
      for (const l of h.share!.lines) if (l.settle === 'debt') ever.set(l.worker.id, l.worker);
    }
    if (!ever.size) continue;
    const now = owesNow(x) ? splitShare(x.share!).lines.filter((l) => l.settle === 'debt') : [];
    for (const [wid, worker] of ever) {
      const line = now.find((l) => l.worker.id === wid);
      out.push({
        id: `${x.id}${SHARE_DEBT_INFIX}${wid}`,
        worker: line?.worker ?? worker,
        kind: x.categoryId === 'cat-fertilizer' ? 'fertilizer' : 'other',
        amountSatang: line?.workerSatang ?? 0,
        date: x.date,
        note: x.fertilizer?.formula || x.item || x.note,
        lender: null,
        fertilizer: null,
        carriedForward: false,
        expenseId: x.id,
        deleted: !line,
        headEventId: x.headEventId,
        recordedAt: x.createdAt,
      });
    }
  }
  return out;
}
