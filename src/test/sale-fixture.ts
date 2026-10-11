/**
 * The sale mockup's farm, for the v2 sale screen tests: แดง taps จันทเขลม
 * จุด 1–3, นัด taps จันทเขลม จุด 4 and คลองพลู จุด 1; จันทเขลม จุดใหม่ has no
 * tapper. A buyer and a manager fill the sale header.
 */

import type { MasterStore } from '../store/master-store';
import type { EventStore } from '../store/store';
import type { SaleEvent } from '../core/types';

export interface MockFarm {
  readonly red: string;
  readonly nat: string;
  readonly farmA: string;
  readonly farmB: string;
  /** จันทเขลม จุด 1–4, then จุดใหม่ (no tapper). */
  readonly a: readonly string[];
  readonly b1: string;
  readonly buyer: string;
}

export async function seedMockFarm(m: MasterStore): Promise<MockFarm> {
  const red = (await m.create('แดง', ['tapper'])).id;
  const nat = (await m.create('นัด', ['tapper'])).id;
  await m.create('อ.สมหวัง', ['manager']);
  const buyer = (await m.addBuyer('คนรับซื้อยาง ก')).id;
  const farmA = (await m.addProperty({ name: 'จันทเขลม', crop: 'rubber', plantedYearBe: null, gps: null })).id;
  const farmB = (await m.addProperty({ name: 'คลองพลู', crop: 'rubber', plantedYearBe: null, gps: null })).id;
  const a: string[] = [];
  for (const n of ['จุด 1', 'จุด 2', 'จุด 3', 'จุด 4', 'จุดใหม่']) a.push((await m.addPoint(farmA, n)).id);
  const b1 = (await m.addPoint(farmB, 'จุด 1')).id;
  for (const p of a.slice(0, 3)) await m.assignTapper(p, red, null);
  await m.assignTapper(a[3], nat, null);
  await m.assignTapper(b1, nat, null);
  return { red, nat, farmA, farmB, a, b1, buyer };
}

/** Stores events verbatim, as if pulled — for seeding a sale log. */
export async function seedSale(store: EventStore, events: readonly SaleEvent[]): Promise<void> {
  for (const e of events) await store.insertPulled(e);
}
