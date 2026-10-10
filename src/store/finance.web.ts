/**
 * Web finance log: localStorage, one JSON array — the same trade-off as
 * `people.web.ts` (small, read whole). Moves into IndexedDB `events` with the
 * envelope redesign (see `finance.ts`).
 */

import type { FinanceEvent } from '../core/finance/types';
import { markNotDurable } from './durability';
import type { FinanceStore } from './finance';
import { shouldInsert } from './finance-memory';

const KEY = 'mon-farm:finance-events';

function read(): FinanceEvent[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as FinanceEvent[]) : [];
  } catch {
    return [];
  }
}

export class WebFinanceStore implements FinanceStore {
  async append(event: FinanceEvent): Promise<void> {
    const rows = read();
    if (!shouldInsert(rows.find((e) => e.id === event.id), event)) return;
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify([...rows, event]));
    } catch (err) {
      // Quota or blocked storage. Money must not vanish quietly: raise the
      // app-wide storage warning AND fail this save so the form says so.
      markNotDurable(err);
      throw err;
    }
  }

  async load(): Promise<FinanceEvent[]> {
    return read();
  }
}

export const financeStore: FinanceStore = new WebFinanceStore();
