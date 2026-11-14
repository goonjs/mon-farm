/**
 * E11-S17 RM-4b / RM-7 · what stopping the old fertilizer split takes away, for the owner to see
 * before merge: how many fertilizer order items carry an old split, and per tapper the debt that
 * disappears, their balance before and after, and whether they are on an instalment plan.
 * Read only — it writes nothing.
 */

import { projectDebts } from './debts';
import { headOf, projectFinance } from './ledger';
import { legacyFertilizerSplitDebts } from './share';
import type { FinanceEvent, Payer } from './types';

export interface LegacySplitWorker {
  readonly worker: Payer;
  readonly goneSatang: number;
  readonly balanceBeforeSatang: number;
  readonly balanceAfterSatang: number;
  readonly hasPlan: boolean;
}

export interface LegacySplitReport {
  /** Live fertilizer items whose `share` names at least one tapper. */
  readonly itemsWithSplit: number;
  /** Only workers who lose something, biggest first. */
  readonly workers: readonly LegacySplitWorker[];
  readonly totalGoneSatang: number;
}

export function legacySplitReport(events: readonly FinanceEvent[]): LegacySplitReport {
  const { expenses } = projectFinance(events);
  const itemsWithSplit = expenses.filter((x) => !x.deleted && x.categoryId === 'cat-fertilizer' && (x.share?.lines.length ?? 0) > 0).length;
  const gone = new Map<string, { worker: Payer; satang: number }>();
  for (const d of legacyFertilizerSplitDebts(expenses)) {
    if (d.deleted || d.amountSatang === 0) continue;
    const g = gone.get(d.worker.id) ?? { worker: d.worker, satang: 0 };
    gone.set(d.worker.id, { ...g, satang: g.satang + d.amountSatang });
  }
  const accounts = projectDebts(events);
  // A tapper whose only debt was the old split has no account any more, so plans are read from their own events.
  const planned = new Set<string>();
  const planEvents = events.filter((e) => e.payload.t === 'debt_plan_set');
  for (const target of new Set(planEvents.map((e) => e.targetId))) {
    const evs = planEvents.filter((e) => e.targetId === target);
    const head = evs.find((e) => e.id === headOf(evs))?.payload;
    if (head?.t === 'debt_plan_set' && head.installments) planned.add(head.worker.id);
  }
  const workers = [...gone.values()]
    .map(({ worker, satang }) => {
      const acc = accounts.get(worker.id);
      const after = acc?.balanceSatang ?? 0;
      return { worker, goneSatang: satang, balanceBeforeSatang: after + satang, balanceAfterSatang: after, hasPlan: planned.has(worker.id) };
    })
    .sort((a, b) => b.goneSatang - a.goneSatang || (a.worker.id < b.worker.id ? -1 : 1));
  return { itemsWithSplit, workers, totalGoneSatang: workers.reduce((s, w) => s + w.goneSatang, 0) };
}
