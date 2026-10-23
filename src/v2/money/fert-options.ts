/**
 * Writing a saved fertilizer choice (ตั้งค่าปุ๋ย, E11-S10). One record per
 * kind + normalised name (`fertOptionId`), so the same name added on two
 * devices meets; an edit names the head it saw, and a rename keeps the id.
 *
 * Adding by name (no `id`): a hidden option of that name is shown again and
 * keeps its description unless a new one is typed; if the name's id is
 * held by an option since renamed to something else, the new name gets a
 * fresh id rather than renaming that option back.
 */

import { fertOptionId, headOf, type FertOption } from '../../core/finance/ledger';
import type { FertOptionKind } from '../../core/finance/types';
import type { UseFinance } from '../../finance/use-finance';
import { newId } from '../../lib/id';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** The shown or hidden option already called `name`, if any. */
export function optionNamed(options: readonly FertOption[], kind: FertOptionKind, name: string): FertOption | undefined {
  return options.find((o) => o.kind === kind && norm(o.name) === norm(name));
}

export async function setFertOption(
  fin: Pick<UseFinance, 'events' | 'write' | 'state'>,
  o: { kind: FertOptionKind; name: string; description: string; hidden: boolean; id?: string },
): Promise<string> {
  const options = fin.state?.fertOptions ?? [];
  let id = o.id;
  let description = o.description.trim();
  if (!id) {
    const same = optionNamed(options, o.kind, o.name);
    const base = fertOptionId(o.kind, o.name);
    id = same?.id ?? (options.some((x) => x.id === base) ? newId(`${base}-`) : base);
    if (!description) description = same?.description ?? '';
  }
  const prior = (fin.events ?? []).filter((e) => e.targetId === id);
  await fin.write(id, prior.length ? headOf(prior) : null, { t: 'fert_option_set', kind: o.kind, name: o.name.trim(), description, hidden: o.hidden });
  return id;
}
