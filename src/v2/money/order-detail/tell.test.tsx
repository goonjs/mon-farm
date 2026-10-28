import type { Expense } from '../../../core/finance/ledger';
import { checkShare, splitShare } from '../../../core/finance/share';
import { buildShare, editItemPatch, editItemProblems, itemGross, itemSacks, reasonsPatch, tapperPatch, tapperProblems, tapperSplit, unifyOrder, zonesPatch } from './tell';

const item = (over: Partial<Expense> = {}): Expense =>
  ({
    id: 'o1-a',
    deleted: false,
    history: [],
    conflicts: [],
    waiting: false,
    headEventId: 'ev1',
    heads: ['ev1'],
    createdOn: 'd',
    amountSatang: 2_200_000,
    discountSatang: 100_000,
    date: '2026-10-27',
    stage: 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: '15-15-15',
    note: '',
    payer: null,
    orderId: 'o1',
    line: { qty: 20, unit: 'กระสอบ', grossSatang: 2_300_000, itemDiscountSatang: 100_000 },
    fertilizer: { type: 'chemical', formula: '15-15-15', brand: '', sackKg: 50, reasons: ['r1', 'r2'], zones: [{ zoneId: 'z1', zoneName: 'หน้า', sacks: 3, reasons: ['r1', 'r2'], note: 'x' }], shop: '', orderedBy: '', sacks: 20 },
    ...over,
  }) as Expense;

const A = { id: 'p1', name: 'แดง' };
const B = { id: 'p2', name: 'นัด' };

describe('order-detail tell helpers', () => {
  it('sacks and gross come from the order item, else the legacy share', () => {
    expect(itemSacks(item())).toBe(20);
    expect(itemGross(item())).toBe(2_300_000);
    const legacy = item({ line: undefined, fertilizer: { ...item().fertilizer!, sacks: undefined }, share: { billSatang: 500, discountSatang: 0, totalSacks: 7, lines: [] } });
    expect(itemSacks(legacy)).toBe(7);
    expect(itemGross(legacy)).toBe(500);
  });

  it('share = gross bill + item discount + sacks, amountSatang stays the net and travels with it', () => {
    const p = tapperPatch(item(), [{ worker: A, sacks: 6, pct: 50, settle: 'debt' }]);
    expect(p.amountSatang).toBe(2_200_000);
    expect(p.share).toEqual({ billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines: [{ worker: A, sacks: 6, workerPct: 50, settle: 'debt' }] });
    expect(Object.keys(p).sort()).toEqual(['amountSatang', 'share']);
  });

  it('"ไม่แบ่ง" writes share: null', () => {
    expect(tapperPatch(item(), null).share).toBeNull();
  });

  it('tappers over the sacks are a problem; the split is the engine\'s', () => {
    const over = [{ worker: A, sacks: 15, pct: 50, settle: 'debt' as const }, { worker: B, sacks: 6, pct: 50, settle: 'paid' as const }];
    expect(tapperProblems(item(), over)).toContain('sacks-over');
    expect(tapperSplit(item(), over)).toBeNull();
    const ok = tapperSplit(item(), [{ worker: A, sacks: 10, pct: 50, settle: 'debt' }]);
    expect(ok?.leftoverSacks).toBe(10);
    expect(ok?.lines[0].costSatang).toBe(1_100_000);
    expect(buildShare(item(), []).lines).toEqual([]);
  });

  it('reasons patch replaces the fertilizer object whole and drops zone reasons no longer chosen', () => {
    const p = reasonsPatch(item(), ['r2']);
    expect(p.fertilizer?.reasons).toEqual(['r2']);
    expect(p.fertilizer?.zones[0].reasons).toEqual(['r2']);
    expect(p.fertilizer?.formula).toBe('15-15-15');
  });

  it('zones patch keeps per-zone note, drops zero zones, sets the farm on an item without one', () => {
    const p = zonesPatch(item(), [{ zoneId: 'z1', zoneName: 'หน้า', sacks: 8 }, { zoneId: 'z2', zoneName: 'หลัง', sacks: 0 }], 'f1');
    expect(p.fertilizer?.zones).toEqual([{ zoneId: 'z1', zoneName: 'หน้า', sacks: 8, reasons: ['r1', 'r2'], note: 'x' }]);
    expect(p.propertyId).toBe('f1');
    // zones saved for another farm move the item to that farm; the same farm or no zones leave it alone
    expect(zonesPatch(item({ propertyId: 'f0' }), [{ zoneId: 'z1', zoneName: 'หน้า', sacks: 1 }], 'f1').propertyId).toBe('f1');
    expect(zonesPatch(item({ propertyId: 'f1' }), [{ zoneId: 'z1', zoneName: 'หน้า', sacks: 1 }], 'f1').propertyId).toBeUndefined();
    expect(zonesPatch(item({ propertyId: 'f0' }), [], 'f1').propertyId).toBeUndefined();
    expect(zonesPatch(item(), [], 'f1').propertyId).toBeUndefined();
  });

  it('a legacy share (no top-level discount) keeps bill − discount = amount after a tapper edit', () => {
    const legacy = item({ line: undefined, discountSatang: undefined, amountSatang: 2_200_000, share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines: [] } });
    const p = tapperPatch(legacy, [{ worker: A, sacks: 5, pct: 50, settle: 'debt' }]);
    expect(p.share!.billSatang - p.share!.discountSatang).toBe(p.amountSatang);
    expect(p.share!.discountSatang).toBe(100_000);
  });
});

describe('editItemPatch', () => {
  const money = (over = {}) => ({ qty: 30, unitPrice: null, gross: 3_000_000, discount: 50_000, mode: 'total' as const, ...over });

  it('patches amount, discount (item + the bill share it already had), line and fertilizer', () => {
    // old: gross 2,300,000, item discount 100,000, discountSatang 130,000 -> bill share 30,000
    const e = item({ discountSatang: 130_000, amountSatang: 2_170_000 });
    const p = editItemPatch(e, money(), 'กระสอบ');
    expect(p.discountSatang).toBe(80_000);
    expect(p.amountSatang).toBe(2_920_000);
    expect(p.line).toEqual({ qty: 30, unit: 'กระสอบ', grossSatang: 3_000_000, itemDiscountSatang: 50_000 });
    expect(p.fertilizer).toMatchObject({ sacks: 30, pricePerSackSatang: 100_000, itemDiscountSatang: 50_000, formula: '15-15-15' });
    expect(p.share).toBeUndefined();
  });

  it('rebuilds an existing share in the same patch, lines kept', () => {
    const lines = [{ worker: A, sacks: 6, workerPct: 50, settle: 'debt' as const }];
    const e = item({ share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines } });
    const p = editItemPatch(e, money({ discount: 0 }), 'กระสอบ');
    expect(p.share).toEqual({ billSatang: 3_000_000, discountSatang: 0, totalSacks: 30, lines });
    expect(p.share!.billSatang - p.share!.discountSatang).toBe(p.amountSatang);
    expect(checkShare(p.share!)).toEqual([]);
    expect(splitShare(p.share!).lines).toHaveLength(1);
  });

  it('a share decided "not shared" (null) stays null (not touched)', () => {
    expect(editItemPatch(item({ share: null }), money(), 'กระสอบ').share).toBeUndefined();
  });

  it('blocks a quantity below the sacks given to tappers or placed in zones', () => {
    const e = item({ share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines: [{ worker: A, sacks: 12, workerPct: 50, settle: 'debt' }] } });
    expect(editItemProblems(e, money({ qty: 11 }))).toMatchObject({ tappers: 12 });
    expect(editItemProblems(e, money({ qty: 12 }))).toEqual({});
    // item() has 3 sacks placed in zone z1
    expect(editItemProblems(item(), money({ qty: 2 }))).toMatchObject({ zones: 3 });
  });

  it('blocks a discount that, with the bill share, leaves a negative amount', () => {
    const e = item({ discountSatang: 130_000 });
    expect(editItemProblems(e, money({ gross: 100_000, discount: 90_000, qty: 20 }))).toMatchObject({ discount: true });
  });
});

describe('unifyOrder', () => {
  it('writes the order\'s own stage (planned stays planned) on the items that differ', () => {
    const a = item({ id: 'o1-a', headEventId: 'e-a', stage: 'planned' });
    const b = item({ id: 'o1-b', headEventId: 'e-b', stage: 'actual', date: '2026-10-20' });
    const order = { orderId: 'o1', legacy: false, items: [a, b], date: b.date, stage: 'actual', payer: null, shop: '', netSatang: 0, billDiscountSatang: 0, consistent: false } as never;
    expect(unifyOrder(order)).toEqual([{ id: 'o1-a', baseEventId: 'e-a', patch: { date: '2026-10-20', stage: 'actual' } }]);
    const plannedOrder = { ...(order as object), stage: 'planned' } as never;
    expect(unifyOrder(plannedOrder).find((w) => w.id === 'o1-b')?.patch.stage).toBe('planned');
  });
});
