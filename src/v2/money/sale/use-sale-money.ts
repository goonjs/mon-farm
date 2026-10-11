/**
 * One sale's money, for the v2 settlement chain (E05 · D-82): the settlement
 * from the recorded baskets, each tapper's figures (weight, sale amount,
 * share, deductions, cash before and after rounding, debt left), and the
 * owner's transfer. Logic only — every v2 sale screen reads the same numbers.
 */

import { useMemo, useState } from 'react';

import { projectDebts, type DebtAccount } from '../../../core/finance/debts';
import { isPointSale, settlePoints } from '../../../core/point-settle';
import { saleDay } from '../../../core/sale-list';
import { settle, SettlementUnavailable, type Settlement } from '../../../core/settle';
import { useFinance } from '../../../finance/use-finance';
import { useSaleCounts } from '../../../finance/use-live-sales';
import { useSaleRounding } from '../../../finance/use-sale-rounding';
import { useSale } from '../../../store/SaleProvider';
import { useMaster } from '../../farm/pieces';

export interface TapperMoney {
  readonly id: string;
  readonly name: string;
  readonly zoneIds: readonly string[];
  readonly netG: number;
  readonly baskets: number;
  readonly grossSatang: number;
  /** The tapper's % of their zones (the first zone's when they differ). */
  readonly pct: number;
  readonly shareSatang: number;
  /** Old S29 deductions (kept until the owner decides, D-81 deletion list). */
  readonly s29Satang: number;
  /** Debt deducted at this sale, netting excluded. */
  readonly debtDeductedSatang: number;
  readonly nettedSatang: number;
  readonly cashBeforeSatang: number;
  readonly cashSatang: number;
  readonly adjustSatang: number;
  readonly account: DebtAccount | undefined;
}

const EMPTY: readonly never[] = [];

export function useSaleMoney() {
  const { events, state, append } = useSale();
  const fin = useFinance();
  const counts = useSaleCounts();
  const { state: master } = useMaster();
  const [now] = useState(() => Date.now());
  // A sale weighed on points settles per tapper on the sale day (E05-S01); older pile sales per zone.
  const pointSale = isPointSale(events);
  const settlement = useMemo<Settlement | null>(() => {
    try {
      if (pointSale) return master ? settlePoints(events, state, master, saleDay(state.startedTs, now)) : null;
      return settle(events, state);
    } catch (err) {
      if (err instanceof SettlementUnavailable) return null;
      throw err;
    }
  }, [events, state, master, pointSale, now]);

  const workers = useMemo(
    () => (settlement?.perWorker ?? EMPTY).map((w) => ({ id: w.personId, name: w.workerName || w.personId, shareSatang: Math.max(0, w.payoutSatang) })),
    [settlement],
  );
  const rounding = useSaleRounding(state.id, workers, settlement?.ownerSatang ?? 0, settlement?.grossSatang ?? 0);
  const debts = useMemo(() => projectDebts(fin.events ?? [], counts), [fin.events, counts]);

  const tappers: TapperMoney[] = (settlement?.perWorker ?? EMPTY).map((w, i) => {
    const zones = settlement!.perZone.filter((z) => w.zoneIds.includes(z.zoneId));
    const here = (debts.get(w.personId)?.payments ?? []).filter((p) => p.saleId === state.id && !p.deleted);
    const r = rounding.result.workers[i];
    return {
      id: w.personId,
      name: w.workerName || w.personId,
      zoneIds: w.zoneIds,
      netG: zones.reduce((s, z) => s + z.totals.netG, 0),
      baskets: zones.reduce((s, z) => s + z.totals.baskets, 0),
      grossSatang: zones.reduce((s, z) => s + z.grossSatang, 0),
      pct: zones.length ? 100 - zones[0].ownerPct : 0,
      shareSatang: w.workerSatang,
      s29Satang: w.deductionSatang,
      debtDeductedSatang: here.filter((p) => p.method !== 'netting').reduce((s, p) => s + p.amountSatang, 0),
      nettedSatang: here.filter((p) => p.method === 'netting').reduce((s, p) => s + p.amountSatang, 0),
      cashBeforeSatang: rounding.before[i]?.cashBeforeSatang ?? 0,
      cashSatang: r?.cashSatang ?? 0,
      adjustSatang: r?.adjustSatang ?? 0,
      account: debts.get(w.personId),
    };
  });

  return {
    loaded: fin.events !== null && (!pointSale || master !== null),
    master,
    events,
    state,
    append,
    settlement,
    tappers,
    rounding,
    debts,
    /** The owner's transfer: owner share after rounding + debt the buyer transfers with it (D-71 route 3). */
    ownerTransferSatang: rounding.result.ownerSatang + rounding.transferInSatang,
  };
}
