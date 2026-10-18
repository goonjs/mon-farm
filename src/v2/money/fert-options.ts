/**
 * Writing a saved fertilizer choice (ตั้งค่าปุ๋ย, E11-S10). One record per
 * kind + normalised name (`fertOptionId`), so the same name added on two
 * devices meets; an edit names the head it saw, and a rename keeps the id.
 */

import { fertOptionId, headOf } from '../../core/finance/ledger';
import type { FertOptionKind } from '../../core/finance/types';
import type { UseFinance } from '../../finance/use-finance';

export function setFertOption(
  fin: Pick<UseFinance, 'events' | 'write'>,
  o: { kind: FertOptionKind; name: string; description: string; hidden: boolean; id?: string },
) {
  const id = o.id ?? fertOptionId(o.kind, o.name);
  const prior = (fin.events ?? []).filter((e) => e.targetId === id);
  return fin.write(id, prior.length ? headOf(prior) : null, { t: 'fert_option_set', kind: o.kind, name: o.name.trim(), description: o.description.trim(), hidden: o.hidden });
}
