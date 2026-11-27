/**
 * Native binding of the finance log (E01-S28 round 2): `EventFinanceStore`
 * over the expo-sqlite event store (`mon-farm-v1.db`, table `events`), so
 * money is in the outbox and syncs once Android does (E01-S06).
 *
 * The old log, table `finance_events` in `mon-farm.db`, is copied in once on
 * first use and then left in place, read-only: nothing writes it any more,
 * and dropping it is a later story the owner approves (S28-AC7).
 */

import * as SQLite from 'expo-sqlite';

import type { FinanceEvent } from '../core/finance/types';
import type { FinanceStore } from './finance';
import { EventFinanceStore, type LegacyFinanceLog } from './finance-log';
import { deviceClock } from './record';
import { sessionScope } from './session';
import { store } from './store';

const DB_NAME = 'mon-farm.db';

/** The old native finance log, read-only. A database with no such table (a new install) reads as empty. */
export class SqliteLegacyFinanceLog implements LegacyFinanceLog {
  async load(): Promise<FinanceEvent[]> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const table = await db.getFirstAsync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'finance_events'`);
    if (!table) return [];
    const rows = await db.getAllAsync<{ body: string }>(`SELECT body FROM finance_events`);
    return rows.map((r) => JSON.parse(r.body) as FinanceEvent);
  }
}

export const financeStore: FinanceStore = new EventFinanceStore(store, deviceClock, new SqliteLegacyFinanceLog(), sessionScope);
