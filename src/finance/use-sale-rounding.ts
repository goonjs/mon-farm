/**
 * The settlement screen's rounding state (E05-S02): each worker's cash after
 * debt deductions, the sale's rounding choice, and the rounded result. One
 * hook so the rounding card and the account card agree on the owner amount.
 */

import { useMemo } from 'react';

import { projectDebts } from '../core/finance/debts';
import { workerCash, type RoundingMode } from '../core/finance/deduct';
import { roundingFor, roundSettlement } from '../core/finance/rounding';
import { useFinance } from './use-finance';
import { useInFlight } from './use-in-flight';
import { useSaleCounts } from './use-live-sales';

export function useSaleRounding(saleId: string, workers: readonly { id: string; name: string; shareSatang: number }[], ownerShareSatang: number) {
  const fin = useFinance();
  const counts = useSaleCounts();
  const inFlight = useInFlight();
  const debts = useMemo(() => projectDebts(fin.events ?? [], counts), [fin.events, counts]);

  const before = workers.map((w) => {
    const here = (debts.get(w.id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted);
    const deducted = here.filter((p) => p.method !== 'netting').reduce((s, p) => s + p.amountSatang, 0);
    const netted = here.filter((p) => p.method === 'netting').reduce((s, p) => s + p.amountSatang, 0);
    return { id: w.id, name: w.name, cashBeforeSatang: workerCash({ shareSatang: w.shareSatang, deductionSatang: deducted + netted, nettingSatang: netted, adjustSatang: 0 }) };
  });

  const choice = roundingFor(fin.events ?? [], saleId, fin.deviceId ?? '');
  const result = roundSettlement(before, choice.mode, ownerShareSatang);
  // Ready once there is nothing to round, or the owner answered for this sale (?B1).
  const ready = !result.needsAsking || choice.asked;

  const set = (mode: RoundingMode) =>
    inFlight.run(async () => {
      await fin.write(`sale-rounding-${saleId}`, choice.head, { t: 'sale_rounding_set', saleId, mode });
    });

  return { loaded: fin.events !== null, before, choice, result, ready, set, busy: inFlight.busy };
}

export type SaleRounding = ReturnType<typeof useSaleRounding>;
