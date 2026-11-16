/** E15-S01 · เตรียมการขาย. Stub until the code commit. */

import type { FinanceEvent, SalePrepPatch } from '../../core/finance/types';

export interface PrepViewProps {
  readonly events: readonly FinanceEvent[];
  readonly today: string;
  readonly lastSaleDay: string | null;
  readonly lastSaleTs: number | null;
  readonly onWrite: (patch: SalePrepPatch) => Promise<unknown>;
  readonly onBuyer: () => void;
  readonly onFert: () => void;
  readonly onBack: () => void;
}

export function PrepView(_p: PrepViewProps): null {
  return null;
}

export function PrepBuyerView(_p: {
  buyers: readonly { id: string; name: string }[];
  latestId: string | null;
  onPick: (b: { id: string; name: string }) => void;
  onAdd: () => void;
  onBack: () => void;
}): null {
  return null;
}
