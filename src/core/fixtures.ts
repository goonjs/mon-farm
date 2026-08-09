/**
 * Test fixtures: a small builder for event logs.
 *
 * The builder assigns sequence numbers, which is the point — it makes it hard
 * to write a test that accidentally depends on timestamp ordering, because
 * timestamps here are deliberately arbitrary.
 */

import type { SaleEvent, SysPayload } from './types';

const SALE = 'sale-1';

export class LogBuilder {
  private events: SaleEvent[] = [];
  private seq = 0;
  private ts = 1_770_000_000_000;
  private mono = 0;

  private base() {
    this.seq += 1;
    this.ts += 1_000;
    this.mono += 1_000;
    return { saleId: SALE, seq: this.seq, ts: this.ts, mono: this.mono, actor: 'somchai' };
  }

  sys(payload: SysPayload): this {
    this.events.push({ ...this.base(), kind: 'sys', payload });
    return this;
  }

  /** A standard basket. Weights in grams. */
  accept(pileId: string, netG = 50_000, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId, source: 'hold', netG, tareG });
    return this;
  }

  /** An off-standard basket, given its gross scale reading. */
  short(pileId: string, readingG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'short', pileId, readingG, tareG });
    return this;
  }

  reject(pileId: string, heldMs = 800): this {
    this.events.push({
      ...this.base(),
      kind: 'reject',
      pileId,
      source: 'hold',
      reason: 'released-early',
      heldMs,
    });
    return this;
  }

  void(pileId: string, targetSeq: number, reason = 'mistap'): this {
    this.events.push({
      ...this.base(),
      kind: 'correction',
      pileId,
      targetSeq,
      mode: 'void',
      reason,
    });
    return this;
  }

  /** The seq the next pushed event will get — for targeting a void. */
  nextSeq(): number {
    return this.seq + 1;
  }

  build(): SaleEvent[] {
    return [...this.events];
  }
}

/** Sale setup shared by most tests: two zones, three piles, price and split. */
export function setUpSale(b = new LogBuilder()): LogBuilder {
  return b
    .sys({
      t: 'sale_started',
      farmName: 'ไร่คุณพ่อ',
      buyer: 'ล้งเจริญทรัพย์',
      manager: 'สมชาย',
      workerLead: 'ประยุทธ',
      where: 'farm',
    })
    .sys({ t: 'price_set', satangPerKg: 2650, indexRef: 'ตลาดกลางหาดใหญ่' })
    .sys({ t: 'split_set', ownerPct: 60, basis: 'gross' })
    .sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' })
    .sys({ t: 'zone_added', zoneId: 'zB', name: 'โซน B' })
    .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'p2', zoneId: 'zA', name: 'กอง 2', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'p3', zoneId: 'zB', name: 'กอง 3', tareG: 2_000, stdNetG: 50_000 });
}

/** Takes a pile from not-started to counting. */
export function readyPile(b: LogBuilder, pileId: string, tareG = 2_000): LogBuilder {
  return b
    .sys({ t: 'zero_check', pileId, ok: true, readingG: 0 })
    .sys({ t: 'tare_confirmed', pileId, tareG })
    .sys({ t: 'ready', pileId });
}

/**
 * The worked example from docs/ux/mvp-screens.html screen 7.
 *
 * Zone A: กอง 1 = 87 standard + 2 short (41 kg, 38 kg);  กอง 2 = 62 standard + 1 short (44 kg)
 * Zone B: กอง 3 = 74 standard
 *
 * Expected, by hand:
 *   net    = (87+62+74) × 50 + 41 + 38 + 44 = 11,150 + 123 = 11,273 kg
 *   gross  = 11,273 × 26.50                                = ฿ 298,734.50
 *   zone A = 7,573 kg → ฿ 200,684.50   owner ฿ 120,410.70  worker ฿ 80,273.80
 *   zone B = 3,700 kg → ฿  98,050.00   owner ฿  58,830.00  worker ฿ 39,220.00
 *   owner  = ฿ 179,240.70            worker = ฿ 119,493.80
 *
 * These figures are on a screen the owner has reviewed. If a change to the
 * money code breaks this test, the design document is now lying.
 */
export function workedExample(): SaleEvent[] {
  const b = setUpSale();

  readyPile(b, 'p1');
  for (let i = 0; i < 87; i++) b.accept('p1');
  b.short('p1', 43_000); // 43 − 2 = 41 kg
  b.short('p1', 40_000); // 40 − 2 = 38 kg
  b.sys({ t: 'pile_closed', pileId: 'p1', forced: false });

  readyPile(b, 'p2');
  for (let i = 0; i < 62; i++) b.accept('p2');
  b.short('p2', 46_000); // 46 − 2 = 44 kg
  b.sys({ t: 'pile_closed', pileId: 'p2', forced: false });
  b.sys({ t: 'zone_closed', zoneId: 'zA', forcedPiles: [] });

  readyPile(b, 'p3');
  for (let i = 0; i < 74; i++) b.accept('p3');
  b.sys({ t: 'pile_closed', pileId: 'p3', forced: false });
  b.sys({ t: 'zone_closed', zoneId: 'zB', forcedPiles: [] });

  b.sys({ t: 'sale_closed' });
  return b.build();
}
