/**
 * Test fixtures: a small builder for event logs.
 *
 * The builder assigns sequence numbers, which is the point — it makes it hard
 * to write a test that accidentally depends on timestamp ordering, because
 * timestamps here are deliberately arbitrary.
 */

import type { SaleEvent, SysPayload } from './types';

const DEFAULT_SALE_ID = 'sale-1';

export class LogBuilder {
  private events: SaleEvent[] = [];
  private seq = 0;
  private ts = 1_770_000_000_000;
  private mono = 0;
  private deviceSeqs = new Map<string, number>();
  private lastDeductionIdValue: string | undefined;

  /**
   * Defaults to a fixed id so existing unit tests are unaffected. e2e fixtures
   * pass a real sale id here so the events they seed carry the same id the
   * route/store actually key by, rather than a fixture placeholder.
   *
   * `deviceId` is the device that records the following events; `on()`
   * switches it mid-log to model a second phone.
   */
  constructor(
    private saleId: string = DEFAULT_SALE_ID,
    private deviceId: string = 'dev-A',
  ) {}

  /**
   * Event ids are deterministic rather than UUIDv7 so fixtures stay
   * reproducible; they are unique per (sale, device, deviceSeq), which is all
   * the store and projection rely on.
   */
  private idFor(deviceSeq: number): string {
    return `${this.saleId}/${this.deviceId}/${deviceSeq}`;
  }

  private base() {
    const deviceSeq = (this.deviceSeqs.get(this.deviceId) ?? 0) + 1;
    this.deviceSeqs.set(this.deviceId, deviceSeq);
    this.seq += 1;
    this.ts += 1_000;
    this.mono += 1_000;
    return {
      id: this.idFor(deviceSeq),
      saleId: this.saleId,
      seq: this.seq,
      deviceSeq,
      ts: this.ts,
      mono: this.mono,
      actor: { userId: 'user-somchai', deviceId: this.deviceId },
      source: 'app' as const,
    };
  }

  /** Records the following events on another device. */
  on(deviceId: string): this {
    this.deviceId = deviceId;
    return this;
  }

  /**
   * An independent copy recording on `deviceId` from here on — two phones
   * that shared this log and then went offline.
   */
  fork(deviceId: string): LogBuilder {
    const copy = new LogBuilder(this.saleId, deviceId);
    copy.events = [...this.events];
    copy.seq = this.seq;
    copy.ts = this.ts;
    copy.mono = this.mono;
    copy.deviceSeqs = new Map(this.deviceSeqs);
    copy.lastDeductionIdValue = this.lastDeductionIdValue;
    return copy;
  }

  sys(payload: SysPayload): this {
    this.events.push({ ...this.base(), kind: 'sys', payload });
    return this;
  }

  /** A standard basket. Weights in grams. */
  accept(pileId: string, netG = 50_000, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId, input: 'hold', netG, tareG });
    return this;
  }

  /**
   * A standard basket at a weighing point with its number (E04-S01). The
   * point stands in as the pile until the counter screen moves to points.
   */
  acceptAt(pointId: string, basketNo: number, netG = 50_000, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId: pointId, pointId, basketNo, input: 'hold', netG, tareG });
    return this;
  }

  /** A short basket at a weighing point with its number (E04-S05). */
  shortAt(pointId: string, basketNo: number, readingG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'short', pileId: pointId, pointId, basketNo, readingG, tareG });
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
      input: 'hold',
      reason: 'released-early',
      heldMs,
    });
    return this;
  }

  void(pileId: string, targetId: string, reason = 'mistap'): this {
    this.events.push({
      ...this.base(),
      kind: 'correction',
      pileId,
      targetId,
      mode: 'void',
      reason,
    });
    return this;
  }

  /**
   * Records a deduction against a worker's own share. `satang` is positive —
   * the sign lives in the arithmetic, not the event. The id is generated here
   * (deterministic, seq-based) and remembered so `voidDeduction()` can target
   * "the deduction just added" without the caller having to invent an id.
   */
  deduction(
    personId: string,
    satang: number,
    reason: string,
    agreedBy: string,
    personName = personId,
  ): this {
    const deductionId = `ded-${this.seq + 1}`;
    this.lastDeductionIdValue = deductionId;
    this.events.push({
      ...this.base(),
      kind: 'sys',
      payload: { t: 'deduction_added', deductionId, personId, personName, satang, reason, agreedBy },
    });
    return this;
  }

  /** The id of the most recently added deduction — for targeting a void. */
  lastDeductionId(): string {
    if (!this.lastDeductionIdValue) throw new Error('No deduction added yet.');
    return this.lastDeductionIdValue;
  }

  /** Voids a deduction by id (default: the one just added), naming a reason. */
  voidDeduction(reason = 'reversed', deductionId = this.lastDeductionId()): this {
    this.events.push({
      ...this.base(),
      kind: 'sys',
      payload: { t: 'deduction_voided', deductionId, reason },
    });
    return this;
  }

  /** Soft-deletes any record (named `remove` because `delete` reads badly as a method). */
  remove(targetId: string): this {
    this.events.push({ ...this.base(), kind: 'delete', targetId });
    return this;
  }

  restore(targetId: string): this {
    this.events.push({ ...this.base(), kind: 'restore', targetId });
    return this;
  }

  /** The id the next pushed event will get — for targeting a void. */
  nextId(): string {
    return this.idFor((this.deviceSeqs.get(this.deviceId) ?? 0) + 1);
  }

  build(): SaleEvent[] {
    return [...this.events];
  }
}

/**
 * Sale setup shared by most tests: two zones, three piles, price and a
 * SALE-LEVEL DEFAULT split of 50/50. No zone has its own contract — callers
 * that want per-zone variance add `zone_contract_set` on top (see
 * `withZoneContract`).
 */
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
    .sys({ t: 'split_set', ownerPct: 50 })
    .sys({ t: 'zone_added', zoneId: 'zA', name: 'โซน A' })
    .sys({ t: 'zone_added', zoneId: 'zB', name: 'โซน B' })
    .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'p2', zoneId: 'zA', name: 'กอง 2', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: 'p3', zoneId: 'zB', name: 'กอง 3', tareG: 2_000, stdNetG: 50_000 });
}

/** Gives one zone its own worker contract, overriding the sale default. */
export function withZoneContract(
  b: LogBuilder,
  zoneId: string,
  personId: string,
  workerName: string,
  ownerPct: number,
): LogBuilder {
  return b.sys({ t: 'zone_contract_set', zoneId, personId, workerName, ownerPct });
}

/** Takes a pile from not-started to counting. */
export function readyPile(b: LogBuilder, pileId: string, tareG = 2_000): LogBuilder {
  return b
    .sys({ t: 'zero_check', pileId, ok: true, readingG: 0 })
    .sys({ t: 'tare_confirmed', pileId, tareG })
    .sys({ t: 'ready', pileId });
}

/**
 * The worked example, formerly shown in docs/ux/mvp-screens.html screen 7
 * (that mockup predates per-zone contracts and is refreshed in S18).
 *
 * Zone A: กอง 1 = 87 standard + 2 short (41 kg, 38 kg);  กอง 2 = 62 standard + 1 short (44 kg)
 * Zone B: กอง 3 = 74 standard
 *
 * Each zone has ITS OWN contract, naming a different worker, both at 50/50 —
 * "same split for everyone today, but it has to vary" is proven by the fact
 * that these are two independent `zone_contract_set` events, not one sale-wide
 * split. `perZoneContractVariance` below is the fixture that actually varies
 * the percentage.
 *
 * Expected, by hand:
 *   net    = (87+62+74) × 50 + 41 + 38 + 44 = 11,150 + 123 = 11,273 kg
 *   gross  = 11,273 × 26.50                                = ฿ 298,734.50   (unaffected by the split)
 *   zone A = 7,573 kg → ฿ 200,684.50   ประยุทธ 50%  → owner ฿ 100,342.25  worker ฿ 100,342.25
 *   zone B = 3,700 kg → ฿  98,050.00   มานพ    50%  → owner ฿  49,025.00  worker ฿  49,025.00
 *   owner total = ฿ 149,367.25
 *
 * These figures are on a screen the owner has reviewed. If a change to the
 * money code breaks this test, the design document is now lying.
 *
 * `saleId` is exposed so e2e fixtures can seed this exact scenario under a
 * real, per-test sale id instead of the fixture's internal default.
 */
export function workedExample(saleId?: string): SaleEvent[] {
  return workedExampleLog(saleId).build();
}

/** The worked example as a builder, for tests that keep appending to it. */
export function workedExampleLog(saleId?: string): LogBuilder {
  const b = setUpSale(new LogBuilder(saleId));
  withZoneContract(b, 'zA', 'person-prayuth', 'ประยุทธ', 50);
  withZoneContract(b, 'zB', 'person-manop', 'มานพ', 50);

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
  return b;
}
