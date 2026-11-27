/**
 * The finance log port (E11): expenses, repayments, categories, debts …
 *
 * Since E01-S28 round 2 this is not a log of its own: every finance event is
 * an event in the one `EventStore` under `FINANCE_SCOPE`, so it sits in the
 * outbox and syncs (see `finance-log.ts`, `EventFinanceStore`). The port stays
 * so the money screens do not change; `finance.web.ts` / `finance.native.ts`
 * bind it to the platform store and copy the old device-only log in once.
 * `finance-memory.ts` backs the component tests that need no sync.
 */

import type { FinanceEvent } from '../core/finance/types';

export interface FinanceStore {
  /**
   * Same rule as the sale log: a new id is inserted, the same id with the
   * same content is a no-op, the same id with different content is refused
   * (`IntegrityError`). Nothing is ever overwritten.
   */
  append(event: FinanceEvent): Promise<void>;
  /** Every finance event on this device. The projection orders them itself. */
  load(): Promise<FinanceEvent[]>;
}

/** Ambient — see the matching note in `store.ts`. */
export declare const financeStore: FinanceStore;

export { MemoryFinanceStore } from './finance-memory';
