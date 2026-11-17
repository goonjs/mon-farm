/**
 * The one sale being weighed (v2 allows a single open sale at a time): read
 * from every sale's log, shared by the home rows and by เริ่มการขาย, which
 * opens it instead of starting a second one.
 */

import { homeSales, type HomeSales } from '../../core/home';
import type { SaleEvent } from '../../core/types';
import { store } from '../../store/store';

export interface SaleLog {
  readonly id: string;
  readonly events: readonly SaleEvent[];
}

/** Every sale's log, and the home rows read from them (the tiles need the logs too: E15-S06). */
export async function loadHomeSaleLogs(): Promise<{ sales: HomeSales; logs: readonly SaleLog[] }> {
  const ids = await store.listSales();
  const logs = await Promise.all(ids.map(async (id) => ({ id, events: await store.load(id) })));
  return { sales: homeSales(logs), logs };
}

export async function loadHomeSales(): Promise<HomeSales> {
  return (await loadHomeSaleLogs()).sales;
}
