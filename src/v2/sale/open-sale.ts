/**
 * The one sale being weighed (v2 allows a single open sale at a time): read
 * from every sale's log, shared by the home rows and by เริ่มการขาย, which
 * opens it instead of starting a second one.
 */

import { homeSales, type HomeSales } from '../../core/home';
import { store } from '../../store/store';

export async function loadHomeSales(): Promise<HomeSales> {
  const ids = await store.listSales();
  const logs = await Promise.all(ids.map(async (id) => ({ id, events: await store.load(id) })));
  return homeSales(logs);
}
