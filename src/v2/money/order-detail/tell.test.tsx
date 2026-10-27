import type { Expense } from '../../../core/finance/ledger';
import { buildShare, itemGross, itemSacks, reasonsPatch, tapperPatch, tapperProblems, tapperSplit, zonesPatch } from './tell';

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
    expect(zonesPatch(item({ propertyId: 'f0' }), [{ zoneId: 'z1', zoneName: 'หน้า', sacks: 1 }], 'f1').propertyId).toBeUndefined();
    expect(zonesPatch(item(), [], 'f1').propertyId).toBeUndefined();
  });
});
