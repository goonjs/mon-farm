/**
 * `MemoryFinanceStore` and the shared append rule, in an unsuffixed file —
 * see `people-memory.ts` for why Jest needs the memory store kept apart from
 * the `.web`/`.native` adapters.
 */

import { canonicalJson } from '../core/canonical';
import type { FinanceEvent } from '../core/finance/types';
import { IntegrityError } from './errors';
import type { FinanceStore } from './finance';

/** True when `event` must be inserted; false for an exact repeat; throws on a rewrite. */
export function shouldInsert(existing: FinanceEvent | undefined, event: FinanceEvent): boolean {
  if (!existing) return true;
  if (canonicalJson(existing) === canonicalJson(event)) return false;
  throw new IntegrityError(`Finance event ${event.id} already stored with different content.`);
}

export class MemoryFinanceStore implements FinanceStore {
  private rows = new Map<string, FinanceEvent>();

  async append(event: FinanceEvent): Promise<void> {
    if (shouldInsert(this.rows.get(event.id), event)) this.rows.set(event.id, event);
  }

  async load(): Promise<FinanceEvent[]> {
    return [...this.rows.values()];
  }
}
