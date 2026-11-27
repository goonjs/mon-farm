/**
 * Web binding of the finance log (E01-S28 round 2): `EventFinanceStore` over
 * the IndexedDB event store, so money is in the outbox and syncs.
 *
 * The old log, localStorage `mon-farm:finance-events` (one JSON array, read
 * whole), is copied in once on first use and then left in place, read-only:
 * nothing writes it any more, and clearing it is a later story the owner
 * approves (S28-AC7).
 */

import type { FinanceEvent } from '../core/finance/types';
import type { FinanceStore } from './finance';
import { EventFinanceStore, type LegacyFinanceLog } from './finance-log';
import { deviceClock } from './record';
import { sessionScope } from './session';
import { store } from './store';

const KEY = 'mon-farm:finance-events';

/** The old web finance log, read-only. Unreadable storage reads as empty, as it always did. */
export class WebLegacyFinanceLog implements LegacyFinanceLog {
  async load(): Promise<FinanceEvent[]> {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as FinanceEvent[]) : [];
    } catch {
      return [];
    }
  }
}

export const financeStore: FinanceStore = new EventFinanceStore(store, deviceClock, new WebLegacyFinanceLog(), sessionScope);
