/**
 * E15-S01 · the sale prep checklist (เตรียมการขาย). Pure core; stub until the code commit.
 */

import type { FinanceEvent, Payer } from './types';

/** The one prep's record (PREP-8: one at a time). */
export const SALE_PREP_TARGET = 'sale-prep';

export interface SalePrep {
  readonly buyerId: string | null;
  readonly buyerName: string;
  readonly date: string | null;
  readonly time: string | null;
  readonly priceSatangPerKg: number | null;
  readonly updatedTs: number;
}

export interface PrepDebtInput {
  readonly worker: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly deleted: boolean;
}

export function salePrep(_events: readonly FinanceEvent[]): SalePrep | null {
  throw new Error('not yet');
}

export function prepLeft(_prep: SalePrep | null, _unsplit: number): number {
  throw new Error('not yet');
}

export function newFertDebts(_debts: readonly PrepDebtInput[], _lastSaleDay: string | null): { worker: Payer; satang: number }[] {
  throw new Error('not yet');
}
