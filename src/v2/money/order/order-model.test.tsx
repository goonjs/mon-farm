import type { Expense } from '../../../core/finance/ledger';
import { buildOrderExpenses, type OrderView } from '../../../core/finance/fert-order';
import { repeatLines, moneyOfLine, moneyOk, moneyProblems, EMPTY_MONEY, perUnit, withGross, withQty, withUnitPrice, withMode, lineIdAt, nextLineId, lineOf, fertSpec, productName } from './order-model';

describe('order model — item money', () => {
  it('a unit price follows the quantity; a typed total does not', () => {
    let m = withUnitPrice(EMPTY_MONEY, 115000);
    expect(m.gross).toBeNull(); // no quantity yet
    m = withQty(m, 20);
    expect(m.gross).toBe(2_300_000);
    m = withQty(m, 10);
    expect(m.gross).toBe(1_150_000);
    m = withGross(m, 999_999);
    expect(m.unitPrice).toBeNull();
    expect(withQty(m, 3).gross).toBe(999_999);
  });

  it('an existing line opens per-unit only when the gross is an exact multiple', () => {
    expect(moneyOfLine({ qty: 20, grossSatang: 2_300_000, itemDiscountSatang: 50_000 })).toMatchObject({ mode: 'per', unitPrice: 115_000, discount: 50_000 });
    expect(moneyOfLine({ qty: 3, grossSatang: 1_000, itemDiscountSatang: 0 })).toMatchObject({ mode: 'total', unitPrice: null, gross: 1_000 });
    expect(perUnit(1_000, 3)).toBe(333);
  });

  it('problems are named, not silent', () => {
    expect(moneyProblems(EMPTY_MONEY)).toEqual({ qty: true, price: true, discount: false });
    expect(moneyOk(moneyProblems({ ...EMPTY_MONEY, qty: 2, gross: 500, unitPrice: 250 }))).toBe(true);
    expect(moneyProblems({ ...EMPTY_MONEY, qty: 2, gross: 500, discount: 600 }).discount).toBe(true);
  });

  it('builds a line; a fertilizer spec carries its details', () => {
    const spec = fertSpec({ type: 'chemical', formula: '15-15-15', brand: 'ตราใบไม้ทอง', sackKg: 50 }, 'กระสอบ');
    expect(spec.item).toBe('15-15-15 ตราใบไม้ทอง');
    const l = lineOf('a', spec, { ...EMPTY_MONEY, qty: 20, unitPrice: 115000, gross: 2_300_000, discount: 0 });
    expect(l).toMatchObject({ id: 'a', categoryId: 'cat-fertilizer', qty: 20, unit: 'กระสอบ', grossSatang: 2_300_000, itemDiscountSatang: 0, fertilizer: { formula: '15-15-15', sackKg: 50 } });
    expect(productName(' 46-0-0 ', '')).toBe('46-0-0');
  });

  it('repeat keeps the quantity, unit and price of a non-fertilizer item (its own line)', () => {
    const e = { id: 'o-1', item: 'ไกลโฟเซต', categoryId: 'cat-herbicide', amountSatang: 300_000, discountSatang: 20_000, line: { qty: 10, unit: 'ลิตร', grossSatang: 320_000, itemDiscountSatang: 20_000 } } as unknown as Expense;
    const [l] = repeatLines({ items: [e] } as unknown as OrderView, () => 'n', 'กระสอบ', 'ชิ้น');
    expect(l).toMatchObject({ id: 'li-000-n', categoryId: 'cat-herbicide', item: 'ไกลโฟเซต', qty: 10, unit: 'ลิตร', grossSatang: 320_000, itemDiscountSatang: 0 });
  });

  it('switching to the total keeps the typed total when the quantity changes later', () => {
    let m = withQty(withUnitPrice(EMPTY_MONEY, 115_000), 20); // gross 2,300,000
    m = withMode(m, 'total');
    expect(m).toMatchObject({ mode: 'total', unitPrice: null, gross: 2_300_000 });
    m = withGross(m, 999_999);
    expect(withQty(m, 3).gross).toBe(999_999);
    // back to per-unit: the price is derived only when exact
    expect(withMode({ ...m, qty: 3, gross: 1_000 }, 'per')).toMatchObject({ mode: 'per', unitPrice: null });
    expect(withMode({ ...m, qty: 4, gross: 1_000 }, 'per')).toMatchObject({ mode: 'per', unitPrice: 250 });
  });

  it('line ids minted in entry order build expense ids that sort in the same order', () => {
    const rand = ['zzz', 'aaa', 'mmm'];
    const ids: string[] = [];
    for (const r of rand) ids.push(nextLineId(ids, () => r));
    ids.push(lineIdAt(10, () => 'a'));
    const lines = ids.map((id, i) => ({ id, categoryId: 'cat-other', item: `x${i}`, qty: 1, unit: 'ชิ้น', grossSatang: 100, itemDiscountSatang: 0 }));
    const built = buildOrderExpenses({ orderId: 'ord-1', date: '2026-10-27', stage: 'committed', payer: null, shop: '', orderedBy: '', propertyId: null, billDiscountSatang: 0, lines });
    const sorted = built.map((b) => b.id).sort();
    expect(sorted).toEqual(built.map((b) => b.id));
    // a removed position is never reused
    expect(nextLineId([ids[0], ids[2]], () => 'q')).toMatch(/^li-003-/);
  });
});
