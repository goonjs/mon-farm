/**
 * Test fixtures: a small builder for event logs.
 *
 * The builder assigns sequence numbers, which is the point — it makes it hard
 * to write a test that accidentally depends on timestamp ordering, because
 * timestamps here are deliberately arbitrary.
 */

import type { FinanceEvent, FinancePayload } from './finance/types';
import { FINANCE_SCOPE } from './finance-scope';
import type { SaleEvent, SysPayload } from './types';

const DEFAULT_SALE_ID = 'sale-1';
/** The group every fixture event is recorded in (E02-S02, D-24). */
export const FIXTURE_GROUP_ID = 'group-1';

export class LogBuilder {
  private events: SaleEvent[] = [];
  private seq = 0;
  private ts = 1_770_000_000_000;
  private mono = 0;
  private deviceSeqs = new Map<string, number>();

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
      groupId: FIXTURE_GROUP_ID,
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

  /** Undo the last basket (S12): its number goes back to the sequence (E04-S09). */
  undo(pileId: string, targetId: string, reason = 'mistap'): this {
    this.events.push({ ...this.base(), kind: 'correction', pileId, targetId, mode: 'undo-last', reason });
    return this;
  }

  /** The re-recorded basket of an edit (E04-S09); the caller voids `editOf` first. */
  editAt(editOf: string, pointId: string, basketNo: number, netG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId: pointId, pointId, basketNo, input: 'edit', netG, tareG, editOf });
    return this;
  }

  /** A later part of an open short basket, topped up at `pointId` (E04-S06): same number, `partOf` its first part. */
  partAt(partOf: string, pointId: string, basketNo: number, netG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId: pointId, pointId, basketNo, input: 'hold', netG, tareG, partOf });
    return this;
  }

  /** A later part weighed on its own as a short reading (E04-S06 option 2): it may still leave the basket short. */
  shortPartAt(partOf: string, pointId: string, basketNo: number, readingG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'short', pileId: pointId, pointId, basketNo, readingG, tareG, partOf });
    return this;
  }

  /** Backfilled baskets (E04-S10): a full one, and a short one given its reading. */
  backfillAt(pointId: string, basketNo: number, netG = 50_000, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'accept', pileId: pointId, pointId, basketNo, input: 'backfill', netG, tareG });
    return this;
  }

  backfillShortAt(pointId: string, basketNo: number, readingG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'short', pileId: pointId, pointId, basketNo, readingG, tareG, backfill: true });
    return this;
  }

  /** The re-recorded short basket of an edit (E04-S09). */
  editShortAt(editOf: string, pointId: string, basketNo: number, readingG: number, tareG = 2_000): this {
    this.events.push({ ...this.base(), kind: 'short', pileId: pointId, pointId, basketNo, readingG, tareG, editOf });
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
  /** Any basket or sys event body, as the app's `append` takes it; returns its id (E04-S19 catch-up). */
  push(body: Record<string, unknown>): string {
    const e = { ...this.base(), ...body } as unknown as SaleEvent;
    this.events.push(e);
    return e.id;
  }

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

/** An event in the finance scope as a pull would store it: `kind` the round-1 union does not know. */
export function scopeEvent(id: string, kind: string, payload: unknown, ts = 1): SaleEvent {
  return {
    id,
    groupId: FIXTURE_GROUP_ID,
    saleId: FINANCE_SCOPE,
    seq: 1,
    deviceSeq: 1,
    ts,
    mono: 1,
    actor: { userId: 'user-other', deviceId: 'dev-other' },
    source: 'app',
    kind,
    payload,
  } as unknown as SaleEvent;
}

/**
 * One payload of every finance `t` (E01-S28 round 2), for round-trip tests: the envelope must carry each one
 * whole. Keyed by `t`, so a new kind of finance event fails to compile here until it has a sample.
 * Shapes are plausible, not checked by a projection.
 */
export function financeSamples(): Record<FinancePayload['t'], FinancePayload> {
  const p = (x: Record<string, unknown>) => x as unknown as FinancePayload;
  const worker = { kind: 'person', id: 'p-red' };
  return {
    expense_created: p({ t: 'expense_created', fields: { amountSatang: 65_000, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าไฟ', note: '', payer: null } }),
    expense_changed: p({ t: 'expense_changed', patch: { amountSatang: 70_000 }, alsoBasedOn: ['e-head-2'] }),
    category_added: p({ t: 'category_added', name: 'ค่าไฟ' }),
    category_renamed: p({ t: 'category_renamed', name: 'ค่าน้ำไฟ' }),
    category_share_set: p({ t: 'category_share_set', workerPct: null }),
    fert_option_set: p({ t: 'fert_option_set', kind: 'formula', name: '15-15-15', description: '', hidden: false }),
    repayment_recorded: p({ t: 'repayment_recorded', fields: { from: { kind: 'farm' }, to: worker, amountSatang: 10_000, date: '2026-11-21', note: '', allocations: [{ expenseId: 'x1', amountSatang: 10_000 }], saleId: null } }),
    repayment_changed: p({ t: 'repayment_changed', patch: { deleted: true } }),
    debt_added: p({ t: 'debt_added', fields: { worker, kind: 'loan', amountSatang: 600_000, date: '2026-09-01', note: '', lender: { kind: 'farm' }, fertilizer: null, carriedForward: false } }),
    debt_changed: p({ t: 'debt_changed', patch: { amountSatang: 500_000 }, alsoBasedOn: [] }),
    debt_payment_recorded: p({ t: 'debt_payment_recorded', fields: { worker, creditor: { kind: 'farm' }, amountSatang: 100_000, date: '2026-11-22', note: '', method: 'cash', saleId: 'sale-1' } }),
    debt_payment_changed: p({ t: 'debt_payment_changed', patch: { deleted: true } }),
    debt_plan_set: p({ t: 'debt_plan_set', worker, perSaleSatang: 325_000, installments: { count: 4, fromSaleId: 'sale-1' } }),
    sale_prep_set: p({ t: 'sale_prep_set', patch: { buyerId: 'b1', date: '2026-11-28', time: null, priceSatangPerKg: 5_250 } }),
    account_added: p({ t: 'account_added', fields: { name: 'กสิกร', number: '0123456789', promptPay: null } }),
    account_changed: p({ t: 'account_changed', patch: { deleted: true }, alsoBasedOn: ['a-2'] }),
    account_default_set: p({ t: 'account_default_set', accountId: null }),
    sale_account_set: p({ t: 'sale_account_set', saleId: 'sale-1', choice: null }),
    sale_rounding_set: p({ t: 'sale_rounding_set', saleId: 'sale-1', mode: 'owner' }),
    payment_mark_set: p({ t: 'payment_mark_set', saleId: 'sale-1', payee: 'owner', done: true, amountSatang: 1_234_500, receivedSatang: 0 }),
    buyer_check_set: p({ t: 'buyer_check_set', saleId: 'sale-1', status: 'matched', basis: { netG: 1_000_000, grossSatang: 5_250_000 }, buyer: null, reason: '' }),
    salary_set: p({ t: 'salary_set', rule: { worker, amountSatang: 900_000, fromMonth: '2026-11', payDay: 1 } }),
    salary_amount_set: p({ t: 'salary_amount_set', fromMonth: '2026-12', amountSatang: 950_000 }),
    salary_paid: p({ t: 'salary_paid', month: '2026-11', amountSatang: 900_000, date: '2026-11-30' }),
    salary_unpaid: p({ t: 'salary_unpaid', month: '2026-11' }),
    lease_added: p({ t: 'lease_added', fields: { tenant: worker, amountSatang: 2_000_000, from: '2026-01-01', note: '' } }),
    lease_changed: p({ t: 'lease_changed', patch: { note: 'ปรับ' } }),
    income_recorded: p({ t: 'income_recorded', fields: { amountSatang: 300_000, date: '2026-11-01', note: 'ขายขี้ยาง' } }),
    income_changed: p({ t: 'income_changed', patch: { deleted: true } }),
    reserve_set: p({ t: 'reserve_set', amountSatang: 5_000_000, assumption: '3 เดือน', source: 'owner' }),
    fertilizing_recorded: p({ t: 'fertilizing_recorded', fields: { date: '2026-11-10', propertyId: 'farm-1', items: [] } }),
    fertilizing_changed: p({ t: 'fertilizing_changed', patch: { deleted: true } }),
  };
}

/** A finance event as the old finance log stored it (`FinanceEvent`), for migration and sync tests. */
export function legacyFinance(
  id: string,
  payload: FinancePayload,
  opts: { targetId?: string; base?: string | null; deviceSeq?: number; ts?: number; userId?: string; deviceId?: string; groupId?: string } = {},
): FinanceEvent {
  return {
    id,
    groupId: opts.groupId ?? FIXTURE_GROUP_ID,
    deviceSeq: opts.deviceSeq ?? 1,
    ts: opts.ts ?? 1_770_000_000_000,
    actor: { userId: opts.userId ?? 'user-somchai', deviceId: opts.deviceId ?? 'dev-A' },
    source: 'app',
    targetId: opts.targetId ?? id,
    baseEventId: opts.base ?? null,
    payload,
  };
}
