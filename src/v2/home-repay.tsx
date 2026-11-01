/**
 * E06-S08 · what the home's "ควรรู้ / ควรจัดการ" needs about repayments
 * (mockup H1, H2 · PR-14, PR-16 · D-87):
 *
 * - waiting: repayments deducted but not yet ticked as received, summed per
 *   worker across sales (`pendingRepayLines`);
 * - owes: per sale, what the buyer still owes the farm (`buyerOwes`), with the
 *   sale's day and buyer name read from the sale's own log.
 *
 * Only reads; every figure comes from core. Summary lines show CompactMoney
 * and the Σ is taken from the full amounts (summary-lines).
 */

import { useEffect, useMemo, useState } from 'react';

import { projectDebts } from '../core/finance/debts';
import { formatDate } from '../core/finance/money';
import { buyerOwes, pendingRepayLines } from '../core/finance/pending-repays';
import type { FinanceEvent } from '../core/finance/types';
import { formatThaiDate } from '../core/master';
import { projectSale } from '../core/project';
import { useSaleCounts } from '../finance/use-live-sales';
import { store } from '../store/store';

export interface RepayWaitingPerson {
  readonly workerId: string;
  readonly name: string;
  readonly satang: number;
}

export interface OwesRow {
  readonly saleId: string;
  readonly dateText: string;
  /** '' when the sale has no buyer name. */
  readonly buyer: string;
  readonly transferSatang: number;
  readonly cash: readonly { readonly workerId: string; readonly name: string; readonly satang: number }[];
  readonly totalSatang: number;
}

interface SaleInfo {
  readonly buyer: string;
  readonly startedTs: number | null;
}

export function useRepayHome(events: readonly FinanceEvent[] | null, era: 'be' | 'ce') {
  const saleCounts = useSaleCounts();
  const base = useMemo(() => {
    if (!events) return { waiting: [] as RepayWaitingPerson[], waitTotal: 0, owes: [] as ReturnType<typeof buyerOwes>, names: new Map<string, string>(), dates: new Map<string, string>() };
    const accounts = projectDebts(events, saleCounts);
    const per = new Map<string, RepayWaitingPerson>();
    for (const l of pendingRepayLines(events, accounts)) {
      const prev = per.get(l.workerId);
      per.set(l.workerId, { workerId: l.workerId, name: l.name, satang: (prev?.satang ?? 0) + l.satang });
    }
    const waiting = [...per.values()];
    const names = new Map<string, string>();
    // The sale's day: its earliest deduction line, when it has one.
    const dates = new Map<string, string>();
    for (const a of accounts.values()) {
      names.set(a.worker.id, a.worker.name);
      for (const p of a.payments) {
        if (!p.saleId) continue;
        const d = dates.get(p.saleId);
        if (!d || p.date < d) dates.set(p.saleId, p.date);
      }
    }
    return { waiting, waitTotal: waiting.reduce((s, w) => s + w.satang, 0), owes: buyerOwes(events, saleCounts), names, dates };
  }, [events, saleCounts]);

  const saleIds = base.owes.map((o) => o.saleId).join('|');
  const [info, setInfo] = useState<ReadonlyMap<string, SaleInfo>>(new Map());
  useEffect(() => {
    if (!saleIds) return;
    let live = true;
    (async () => {
      const out = new Map<string, SaleInfo>();
      for (const id of saleIds.split('|')) {
        const s = projectSale(await store.load(id), id);
        out.set(id, { buyer: s.parties?.buyer.trim() ?? '', startedTs: s.startedTs });
      }
      if (live) setInfo(out);
    })().catch((err) => console.error('Sales could not be read.', err));
    return () => {
      live = false;
    };
  }, [saleIds]);

  const owes: OwesRow[] = base.owes.map((o) => {
    const i = info.get(o.saleId);
    const iso = base.dates.get(o.saleId);
    const dateText = iso ? formatDate(iso, era) : i?.startedTs ? formatThaiDate(i.startedTs, era) : '';
    return {
      saleId: o.saleId,
      dateText,
      buyer: i?.buyer ?? '',
      transferSatang: o.transferSatang,
      cash: o.cash.map((c) => ({ ...c, name: base.names.get(c.workerId) ?? '' })),
      totalSatang: o.totalSatang,
    };
  });
  return { waiting: base.waiting, waitTotal: base.waitTotal, owes };
}
