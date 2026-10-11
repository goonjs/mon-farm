/**
 * The finance log port (E11): expenses, repayments, categories — an
 * append-only event log of its own, because none of it belongs to a sale.
 *
 * Same port/adapter shape as `EventStore` (`store.ts`): `finance.native.ts`
 * (expo-sqlite) and `finance.web.ts` (localStorage, like `people.web.ts`)
 * implement it; `finance-memory.ts` backs the tests. When the envelope
 * redesign gives every event a `targetId` and a nullable `saleId`
 * (architecture §Schema), these rows move into the one `events` table and
 * join its outbox — the event shape is already that envelope.
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
