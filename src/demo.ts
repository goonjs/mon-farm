/**
 * A sale part-way through, so the app opens on something real to operate.
 *
 * Demo data only — nothing here is a product decision. It mirrors the worked
 * example in `docs/ux/mvp-screens.html`: ไร่คุณพ่อ selling to ล้งเจริญทรัพย์
 * at ฿26.50/kg, 60/40 owner/worker, 2 kg bucket, 50 kg standard basket.
 *
 * กอง 1 is left open and mid-count so the counter screen has somewhere to go.
 */

import type { SaleEvent, SysPayload } from './core/types';

export const DEMO_SALE_ID = 'demo-sale';

/**
 * How many standard baskets กอง 1 opens with.
 *
 * Overridable by `?baskets=` on web only, so a test can land directly on a
 * three-digit count instead of driving 58 holds through the UI to get there.
 * Same seam as `?holdMs=`, same reason: the state under test is the layout at
 * three digits, not the sixty interactions it takes to reach it.
 */
export function demoBasketCount(fallback = 41): number {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get('baskets');
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 999 ? n : fallback;
}

export function demoSeed(standardBaskets = demoBasketCount()): SaleEvent[] {
  const events: SaleEvent[] = [];
  let seq = 0;
  let ts = Date.now() - 1000 * 60 * 42;
  let mono = 0;

  const base = () => {
    seq += 1;
    ts += 4_000;
    mono += 4_000;
    return { saleId: DEMO_SALE_ID, seq, ts, mono, actor: 'สมชาย' };
  };
  const sys = (payload: SysPayload) => events.push({ ...base(), kind: 'sys', payload });
  const accept = (pileId: string) =>
    events.push({ ...base(), kind: 'accept', pileId, source: 'hold', netG: 50_000, tareG: 2_000 });
  const short = (pileId: string, readingG: number) =>
    events.push({ ...base(), kind: 'short', pileId, readingG, tareG: 2_000 });

  sys({
    t: 'sale_started',
    farmName: 'ไร่คุณพ่อ',
    buyer: 'ล้งเจริญทรัพย์',
    manager: 'สมชาย',
    workerLead: 'ประยุทธ',
    where: 'farm',
  });
  sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'ตลาดกลางหาดใหญ่ — 26.80' });
  sys({ t: 'split_set', ownerPct: 60, basis: 'gross' });

  sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' });
  sys({ t: 'zone_added', zoneId: 'zB', name: 'โซน B' });
  sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 });
  sys({ t: 'pile_added', pileId: 'p2', zoneId: 'zA', name: 'กอง 2', tareG: 2_000, stdNetG: 50_000 });
  sys({ t: 'pile_added', pileId: 'p3', zoneId: 'zB', name: 'กอง 3', tareG: 2_000, stdNetG: 50_000 });

  // กอง 1: checked, ready, and part-counted. Left open.
  sys({ t: 'zero_check', pileId: 'p1', ok: true, readingG: 0 });
  sys({ t: 'tare_confirmed', pileId: 'p1', tareG: 2_000 });
  sys({ t: 'ready', pileId: 'p1' });
  for (let i = 0; i < standardBaskets; i++) accept('p1');
  short('p1', 43_000); // 43 − 2 = 41 kg

  return events;
}
