import { describe, expect, it } from 'vitest';

import {
  allocateBillDiscount,
  buildOrderExpenses,
  checkOrder,
  deliverOrder,
  FERTILIZER_CATEGORY,
  groupOrders,
  lineNetSatang,
  missingDetails,
  orderProgress,
  orderTotals,
  patchOrderFields,
  type OrderDraft,
  type OrderLineDraft,
} from './fert-order';
import { owedByPerson, projectFinance, stageTotals, type Expense } from './ledger';
import { FARM_FUNDS, type ExpenseFields, type FinanceEvent, type Payer } from './types';

// ── fixtures ────────────────────────────────────────────────────────────────

const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };

const fertLine = (id: string, over: Partial<OrderLineDraft> = {}): OrderLineDraft => ({
  id,
  categoryId: FERTILIZER_CATEGORY,
  item: '15-15-15',
  fertilizer: { type: 'chemical', formula: '15-15-15', brand: 'ตราใบไม้ทอง', sackKg: 50 },
  qty: 10,
  unit: 'กระสอบ',
  grossSatang: 1_000_000,
  itemDiscountSatang: 0,
  ...over,
});

const oilLine = (id: string, over: Partial<OrderLineDraft> = {}): OrderLineDraft => ({
  id,
  categoryId: 'cat-fuel',
  item: 'น้ำมันเครื่อง',
  qty: 2,
  unit: 'ลิตร',
  grossSatang: 30_000,
  itemDiscountSatang: 0,
  ...over,
});

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  orderId: 'ord-1',
  date: '2026-10-27',
  stage: 'actual',
  payer: NAT,
  shop: 'ร้านสหกิจ',
  orderedBy: 'พี่หมู',
  propertyId: null,
  billDiscountSatang: 0,
  lines: [fertLine('a')],
  ...over,
});

// ── lineNet ─────────────────────────────────────────────────────────────────

describe('lineNetSatang', () => {
  it('is gross minus the item discount', () => {
    expect(lineNetSatang({ grossSatang: 1_000_000, itemDiscountSatang: 50_000 })).toBe(950_000);
    expect(lineNetSatang({ grossSatang: 1_000_000, itemDiscountSatang: 0 })).toBe(1_000_000);
  });
});

// ── allocateBillDiscount ────────────────────────────────────────────────────

describe('allocateBillDiscount — largest remainder, exact to the satang', () => {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it('splits in proportion to the nets', () => {
    expect(allocateBillDiscount([100_000, 300_000], 40_000)).toEqual([10_000, 30_000]);
  });

  it('a lone item takes the whole discount', () => {
    expect(allocateBillDiscount([123_456], 789)).toEqual([789]);
  });

  it('an odd satang goes to the earlier index on a tie (three equal nets)', () => {
    expect(allocateBillDiscount([100, 100, 100], 100)).toEqual([34, 33, 33]);
    expect(allocateBillDiscount([100, 100, 100], 101)).toEqual([34, 34, 33]);
  });

  it('the largest remainder gets the extra satang, not the largest net', () => {
    // exact shares 3.5*… : nets 1,2,7 of 10 for discount 5 → .5,1,3.5 → floors 0,1,3 (=4), remainders .5,0,.5 → earlier of the tie
    expect(allocateBillDiscount([1, 2, 7], 5)).toEqual([1, 1, 3]);
    // exact 0.9, 0.9, 8.1 for discount 10 over nets 1,1,9 /11 → remainders pick the biggest fractions
    const r = allocateBillDiscount([1, 1, 9], 10);
    expect(sum(r)).toBe(10);
  });

  it('a discount equal to the sum of the nets takes every net exactly', () => {
    expect(allocateBillDiscount([500, 250, 1_000], 1_750)).toEqual([500, 250, 1_000]);
  });

  it('zero discount → zeros; no items → []', () => {
    expect(allocateBillDiscount([500, 250], 0)).toEqual([0, 0]);
    expect(allocateBillDiscount([], 0)).toEqual([]);
  });

  it('a discount above the sum of the nets is refused', () => {
    expect(() => allocateBillDiscount([500, 250], 751)).toThrow(RangeError);
    expect(() => allocateBillDiscount([], 1)).toThrow(RangeError);
  });

  it('a negative or fractional discount is refused', () => {
    expect(() => allocateBillDiscount([500], -1)).toThrow(RangeError);
    expect(() => allocateBillDiscount([500], 0.5)).toThrow(RangeError);
  });

  it('an item with a zero net gets nothing', () => {
    expect(allocateBillDiscount([0, 100], 40)).toEqual([0, 40]);
  });

  it('big money (100 million baht lines) stays exact — no float overflow', () => {
    const nets = [1_000_000_000_000, 999_999_999_999, 3];
    const d = 1_234_567_891;
    const r = allocateBillDiscount(nets, d);
    expect(sum(r)).toBe(d);
    r.forEach((x, i) => expect(x).toBeLessThanOrEqual(nets[i]));
  });

  it('property: always sums exactly, never exceeds a net, over many shapes', () => {
    let seed = 7;
    const rnd = (m: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % m;
    };
    for (let i = 0; i < 300; i++) {
      const nets = Array.from({ length: 1 + rnd(6) }, () => rnd(5_000_000));
      const total = sum(nets);
      const d = total === 0 ? 0 : rnd(total + 1);
      const r = allocateBillDiscount(nets, d);
      expect(sum(r)).toBe(d);
      r.forEach((x, k) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(nets[k]);
      });
    }
  });
});

// ── checkOrder ──────────────────────────────────────────────────────────────

describe('checkOrder', () => {
  it('a good order has no problems', () => {
    expect(checkOrder(draft())).toEqual({ order: [], lines: { a: [] } });
  });

  it('no lines, no date', () => {
    const p = checkOrder(draft({ lines: [], date: '' }));
    expect(p.order).toEqual(expect.arrayContaining(['no-lines', 'date-required']));
  });

  it('a date that is not YYYY-MM-DD is refused', () => {
    expect(checkOrder(draft({ date: '27/10/2026' })).order).toContain('date-required');
  });

  it('qty must be a whole number ≥ 1', () => {
    for (const qty of [0, -1, 1.5, NaN]) expect(checkOrder(draft({ lines: [fertLine('a', { qty })] })).lines.a).toContain('line-qty');
  });

  it('price must be a positive safe integer', () => {
    for (const grossSatang of [0, -5, 10.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(checkOrder(draft({ lines: [fertLine('a', { grossSatang })] })).lines.a).toContain('line-price');
    }
  });

  it('a fertilizer line needs a formula, another line a name', () => {
    const blank = fertLine('a', { fertilizer: { type: 'chemical', formula: '  ', brand: '', sackKg: null } });
    expect(checkOrder(draft({ lines: [blank] })).lines.a).toContain('line-name-required');
    expect(checkOrder(draft({ lines: [oilLine('b', { item: ' ' })] })).lines.b).toContain('line-name-required');
  });

  it('item discount above its gross is refused, equal is fine (net 0)', () => {
    expect(checkOrder(draft({ lines: [fertLine('a', { itemDiscountSatang: 1_000_001 })] })).lines.a).toContain('item-discount-over');
    expect(checkOrder(draft({ lines: [fertLine('a', { itemDiscountSatang: 1_000_000 })] })).lines.a).toEqual([]);
  });

  it('bill discount above the sum of nets is refused, equal is fine', () => {
    const lines = [fertLine('a', { itemDiscountSatang: 100_000 }), oilLine('b')]; // nets 900_000 + 30_000
    expect(checkOrder(draft({ lines, billDiscountSatang: 930_001 })).order).toContain('bill-discount-over');
    expect(checkOrder(draft({ lines, billDiscountSatang: 930_000 })).order).toEqual([]);
  });

  it('reports problems on the right line', () => {
    const p = checkOrder(draft({ lines: [fertLine('a'), fertLine('b', { qty: 0 })] }));
    expect(p.lines.a).toEqual([]);
    expect(p.lines.b).toEqual(['line-qty']);
  });
});

// ── orderTotals ─────────────────────────────────────────────────────────────

describe('orderTotals', () => {
  it('adds up the items; net = gross − item discounts − bill discount; sacks count fertilizer only', () => {
    const d = draft({
      billDiscountSatang: 20_000,
      lines: [fertLine('a', { itemDiscountSatang: 50_000 }), fertLine('b', { qty: 4, grossSatang: 480_000 }), oilLine('c')],
    });
    expect(orderTotals(d)).toEqual({
      grossSatang: 1_000_000 + 480_000 + 30_000,
      itemDiscountSatang: 50_000,
      billDiscountSatang: 20_000,
      netSatang: 1_510_000 - 50_000 - 20_000,
      sacks: 14,
      lineCount: 3,
    });
  });
});

// ── buildOrderExpenses ──────────────────────────────────────────────────────

describe('buildOrderExpenses', () => {
  it('refuses an order with a problem', () => {
    expect(() => buildOrderExpenses(draft({ lines: [] }))).toThrow();
    expect(() => buildOrderExpenses(draft({ lines: [fertLine('a', { qty: 0 })] }))).toThrow();
  });

  it('one expense per line in line order, ids `${orderId}-${line.id}`', () => {
    const out = buildOrderExpenses(draft({ lines: [fertLine('a'), oilLine('b'), fertLine('c')] }));
    expect(out.map((x) => x.id)).toEqual(['ord-1-a', 'ord-1-b', 'ord-1-c']);
  });

  it('a fertilizer line carries the details, an empty reasons/zones, and NO share key', () => {
    const [x] = buildOrderExpenses(draft({ lines: [fertLine('a', { itemDiscountSatang: 50_000 })] }));
    const f = x.fields;
    expect('share' in f).toBe(false);
    expect(f).toMatchObject({
      amountSatang: 950_000,
      discountSatang: 50_000,
      date: '2026-10-27',
      stage: 'actual',
      categoryId: FERTILIZER_CATEGORY,
      propertyId: null,
      item: '15-15-15',
      note: '',
      payer: NAT,
      orderId: 'ord-1',
      line: { qty: 10, unit: 'กระสอบ', grossSatang: 1_000_000, itemDiscountSatang: 50_000 },
      fertilizer: {
        type: 'chemical',
        formula: '15-15-15',
        brand: 'ตราใบไม้ทอง',
        sackKg: 50,
        reasons: [],
        zones: [],
        shop: 'ร้านสหกิจ',
        orderedBy: 'พี่หมู',
        sacks: 10,
        pricePerSackSatang: 100_000,
        itemDiscountSatang: 50_000,
      },
    });
  });

  it('price per sack is the gross divided by qty, rounded to the satang (half up)', () => {
    const [a, b] = buildOrderExpenses(
      draft({ lines: [fertLine('a', { qty: 3, grossSatang: 100_000 }), fertLine('b', { qty: 3, grossSatang: 100_001 })] }),
    );
    expect(a.fields.fertilizer!.pricePerSackSatang).toBe(33_333); // 33333.33
    expect(b.fields.fertilizer!.pricePerSackSatang).toBe(33_334); // 33333.67
    const [half] = buildOrderExpenses(draft({ lines: [fertLine('a', { qty: 2, grossSatang: 101 })] }));
    expect(half.fields.fertilizer!.pricePerSackSatang).toBe(51); // 50.5 → 51
  });

  it('a non-fertilizer line has `line` only — no fertilizer, no share', () => {
    const [x] = buildOrderExpenses(draft({ lines: [oilLine('b')] }));
    expect('fertilizer' in x.fields).toBe(false);
    expect('share' in x.fields).toBe(false);
    expect(x.fields).toMatchObject({
      categoryId: 'cat-fuel',
      item: 'น้ำมันเครื่อง',
      amountSatang: 30_000,
      discountSatang: 0,
      line: { qty: 2, unit: 'ลิตร', grossSatang: 30_000, itemDiscountSatang: 0 },
    });
  });

  it('the bill discount is allocated over the nets; amounts sum to the order net', () => {
    const d = draft({ billDiscountSatang: 100_000, lines: [fertLine('a', { itemDiscountSatang: 50_000 }), fertLine('b', { grossSatang: 500_000 }), oilLine('c')] });
    const out = buildOrderExpenses(d);
    const nets = d.lines.map(lineNetSatang);
    const shares = allocateBillDiscount(nets, 100_000);
    out.forEach((x, i) => {
      expect(x.fields.discountSatang).toBe(d.lines[i].itemDiscountSatang + shares[i]);
      expect(x.fields.amountSatang).toBe(d.lines[i].grossSatang - (x.fields.discountSatang as number));
    });
    expect(out.reduce((s, x) => s + (x.fields.amountSatang as number), 0)).toBe(orderTotals(d).netSatang);
  });

  it('an item discount lives in line/fertilizer; the bill share is only in discountSatang', () => {
    const [x] = buildOrderExpenses(draft({ billDiscountSatang: 700, lines: [fertLine('a', { itemDiscountSatang: 50_000 })] }));
    expect(x.fields.discountSatang).toBe(50_700);
    expect(x.fields.line!.itemDiscountSatang).toBe(50_000);
    expect(x.fields.fertilizer!.itemDiscountSatang).toBe(50_000);
  });

  it('a committed order keeps its stage and a null payer', () => {
    const [x] = buildOrderExpenses(draft({ stage: 'committed', payer: null, propertyId: 'farm-1' }));
    expect(x.fields).toMatchObject({ stage: 'committed', payer: null, propertyId: 'farm-1' });
  });

  it('is deterministic — building twice gives the same ids and fields (a retry cannot double)', () => {
    expect(buildOrderExpenses(draft())).toEqual(buildOrderExpenses(draft()));
  });
});

// ── groupOrders & friends ───────────────────────────────────────────────────

function expense(id: string, over: Partial<ExpenseFields> = {}, extra: Partial<Expense> = {}): Expense {
  return {
    amountSatang: 100_000,
    date: '2026-10-27',
    stage: 'actual',
    categoryId: FERTILIZER_CATEGORY,
    propertyId: null,
    item: '15-15-15',
    note: '',
    payer: NAT,
    id,
    deleted: false,
    history: [],
    conflicts: [],
    waiting: false,
    headEventId: `head-${id}`,
    heads: [`head-${id}`],
    createdOn: 'dev',
    ...over,
    ...extra,
  } as Expense;
}

const asExpenses = (d: OrderDraft): Expense[] =>
  buildOrderExpenses(d).map((x) => expense(x.id, x.fields));

describe('groupOrders', () => {
  it('groups an order by orderId, items by id, totals and bill discount derived', () => {
    const d = draft({ billDiscountSatang: 1_001, lines: [fertLine('b'), oilLine('a', { itemDiscountSatang: 100 }), fertLine('c')] });
    const [o, ...rest] = groupOrders(asExpenses(d));
    expect(rest).toEqual([]);
    expect(o).toMatchObject({ orderId: 'ord-1', legacy: false, date: '2026-10-27', stage: 'actual', payer: NAT, shop: 'ร้านสหกิจ', consistent: true });
    expect(o.items.map((x) => x.id)).toEqual(['ord-1-a', 'ord-1-b', 'ord-1-c']);
    expect(o.netSatang).toBe(orderTotals(d).netSatang);
    expect(o.billDiscountSatang).toBe(1_001);
  });

  it('a legacy single expense is a one-item legacy order whose id is the expense id', () => {
    const [o] = groupOrders([expense('exp-old', { fertilizer: { type: 'chemical', formula: '46-0-0', brand: '', sackKg: null, reasons: [], zones: [], shop: 'ร้านเก่า', orderedBy: '' } })]);
    expect(o).toMatchObject({ orderId: 'exp-old', legacy: true, shop: 'ร้านเก่า', netSatang: 100_000, billDiscountSatang: 0, consistent: true });
    expect(o.items).toHaveLength(1);
  });

  it('a null orderId is legacy too', () => {
    expect(groupOrders([expense('x', { orderId: null })])[0]).toMatchObject({ legacy: true, orderId: 'x' });
  });

  it('deleted items drop out; an order with none left is gone', () => {
    const xs = asExpenses(draft({ lines: [fertLine('a'), fertLine('b')] }));
    xs[0] = { ...xs[0], deleted: true };
    expect(groupOrders(xs)[0].items.map((x) => x.id)).toEqual(['ord-1-b']);
    expect(groupOrders(xs.map((x) => ({ ...x, deleted: true })))).toEqual([]);
  });

  it('null amounts count as 0', () => {
    expect(groupOrders([expense('x', { amountSatang: null, stage: 'planned' })])[0].netSatang).toBe(0);
  });

  it('newest date first, then id; two orders stay apart', () => {
    const a = asExpenses(draft({ orderId: 'o-a', date: '2026-10-01' }));
    const b = asExpenses(draft({ orderId: 'o-b', date: '2026-10-20' }));
    const c = asExpenses(draft({ orderId: 'o-c', date: '2026-10-20' }));
    expect(groupOrders([...a, ...b, ...c]).map((o) => o.orderId)).toEqual(['o-b', 'o-c', 'o-a']);
  });

  it('items that disagree on stage → inconsistent, the item whose id sorts last decides', () => {
    const xs = asExpenses(draft({ lines: [fertLine('a'), fertLine('b')] }));
    xs[0] = { ...xs[0], stage: 'committed' };
    const [o] = groupOrders(xs);
    expect(o.consistent).toBe(false);
    expect(o.stage).toBe('actual');
  });

  it('items that disagree on date or payer are inconsistent', () => {
    const base = asExpenses(draft({ lines: [fertLine('a'), fertLine('b')] }));
    expect(groupOrders([{ ...base[0], date: '2026-10-01' }, base[1]])[0].consistent).toBe(false);
    expect(groupOrders([{ ...base[0], payer: FARM }, base[1]])[0].consistent).toBe(false);
    expect(groupOrders([{ ...base[0], payer: null }, base[1]])[0].consistent).toBe(false);
    // the same payer by id, even with a different name snapshot, is not a disagreement
    expect(groupOrders([{ ...base[0], payer: { id: NAT.id, name: 'นัดดา' } }, base[1]])[0].consistent).toBe(true);
  });

  it('shop comes from a fertilizer item even when the newest item is not fertilizer', () => {
    const [o] = groupOrders(asExpenses(draft({ lines: [fertLine('a'), oilLine('z')] })));
    expect(o.shop).toBe('ร้านสหกิจ');
    expect(groupOrders(asExpenses(draft({ lines: [oilLine('z')] })))[0].shop).toBe('');
  });
});

describe('missingDetails / orderProgress', () => {
  const told = (over: Partial<NonNullable<Expense['fertilizer']>> = {}, x: Partial<ExpenseFields> = {}) =>
    expense('t', {
      fertilizer: { type: 'chemical', formula: '15-15-15', brand: '', sackKg: null, reasons: ['r1'], zones: [{ zoneId: 'z', zoneName: 'ล่าง', sacks: 10, reasons: [], note: '' }], shop: '', orderedBy: '', sacks: 10, ...over },
      share: null,
      ...x,
    });

  it('a fresh order item is missing all three', () => {
    const [x] = asExpenses(draft());
    expect(missingDetails(x)).toEqual(['reasons', 'zones', 'tappers']);
  });

  it('reasons told, zones short, tappers absent', () => {
    const e = told({ reasons: ['r1'], zones: [{ zoneId: 'z', zoneName: 'ล่าง', sacks: 4, reasons: [], note: '' }] }, {});
    const { share: _drop, ...noShare } = e as Expense & { share?: unknown };
    void _drop;
    expect(missingDetails(noShare as Expense)).toEqual(['zones', 'tappers']);
  });

  it('every sack placed counts as told; placing more than bought also counts as told', () => {
    expect(missingDetails(told())).toEqual([]);
    expect(missingDetails(told({ zones: [{ zoneId: 'z', zoneName: 'ล่าง', sacks: 12, reasons: [], note: '' }] }))).toEqual([]);
  });

  it('`share: null` means decided "not shared" → tappers told; a share with lines too', () => {
    expect(missingDetails(told())).not.toContain('tappers');
    const withShare = told({}, { share: { billSatang: 1, discountSatang: 0, totalSacks: 10, lines: [] } });
    expect(missingDetails(withShare)).not.toContain('tappers');
  });

  it('sacks come from share.totalSacks when fertilizer.sacks is absent (legacy)', () => {
    const legacy = told({ sacks: undefined, zones: [{ zoneId: 'z', zoneName: 'ล่าง', sacks: 5, reasons: [], note: '' }] }, { share: { billSatang: 1, discountSatang: 0, totalSacks: 8, lines: [] } });
    expect(missingDetails(legacy)).toEqual(['zones']);
  });

  it('no known sacks at all: zones are missing only while none is recorded', () => {
    const none = told({ sacks: undefined, zones: [] }, { share: null });
    expect(missingDetails(none)).toEqual(['zones']);
    const some = told({ sacks: undefined }, { share: null });
    expect(missingDetails(some)).toEqual([]);
  });

  it('other items have nothing to tell', () => {
    const [x] = asExpenses(draft({ lines: [oilLine('b')] }));
    expect(missingDetails(x)).toEqual([]);
  });

  it('progress counts fertilizer items only: told / all', () => {
    const items = asExpenses(draft({ lines: [fertLine('a'), fertLine('b'), oilLine('c')] }));
    const first = { ...items[0], fertilizer: { ...items[0].fertilizer!, reasons: ['r'], zones: [{ zoneId: 'z', zoneName: 'ล่าง', sacks: 10, reasons: [], note: '' }] }, share: null } as Expense;
    expect(orderProgress(groupOrders([first, items[1], items[2]])[0])).toEqual({ done: 1, total: 2 });
  });

  it('an order with no fertilizer has 0 / 0', () => {
    expect(orderProgress(groupOrders(asExpenses(draft({ lines: [oilLine('c')] })))[0])).toEqual({ done: 0, total: 0 });
  });
});

describe('patchOrderFields / deliverOrder', () => {
  const order = (stage: 'committed' | 'actual' = 'committed') =>
    groupOrders(asExpenses(draft({ stage, lines: [fertLine('a'), oilLine('b'), fertLine('c')] })))[0];

  it('one write per item, on its head, only the keys that differ', () => {
    const w = patchOrderFields(order(), { date: '2026-10-30', stage: 'committed' });
    expect(w.map((x) => x.id)).toEqual(['ord-1-a', 'ord-1-b', 'ord-1-c']);
    expect(w[0]).toEqual({ id: 'ord-1-a', baseEventId: 'head-ord-1-a', patch: { date: '2026-10-30' } });
  });

  it('nothing differs → no writes', () => {
    expect(patchOrderFields(order(), { date: '2026-10-27', stage: 'committed', payer: NAT, shop: 'ร้านสหกิจ', orderedBy: 'พี่หมู', propertyId: null })).toEqual([]);
    expect(patchOrderFields(order(), {})).toEqual([]);
  });

  it('payer compares by id and null is a real value', () => {
    expect(patchOrderFields(order(), { payer: { id: NAT.id, name: 'ชื่ออื่น' } })).toEqual([]);
    expect(patchOrderFields(order(), { payer: FARM })[0].patch).toEqual({ payer: FARM });
    expect(patchOrderFields(order(), { payer: null })[0].patch).toEqual({ payer: null });
  });

  it('shop/orderedBy rewrite the whole `fertilizer` object, on fertilizer items only', () => {
    const o = order();
    const w = patchOrderFields(o, { shop: 'ร้านใหม่' });
    expect(w.map((x) => x.id)).toEqual(['ord-1-a', 'ord-1-c']);
    expect(w[0].patch).toEqual({ fertilizer: { ...o.items[0].fertilizer, shop: 'ร้านใหม่' } });
    expect(patchOrderFields(o, { orderedBy: 'ลุงแดง' })[0].patch).toEqual({ fertilizer: { ...o.items[0].fertilizer, orderedBy: 'ลุงแดง' } });
  });

  it('changes everything at once in one patch per item', () => {
    const w = patchOrderFields(order(), { date: '2026-11-01', stage: 'actual', payer: FARM, propertyId: 'farm-2', shop: 'x' });
    expect(Object.keys(w[0].patch).sort()).toEqual(['date', 'fertilizer', 'payer', 'propertyId', 'stage']);
    expect(Object.keys(w[1].patch).sort()).toEqual(['date', 'payer', 'propertyId', 'stage']);
  });

  it('rewrites only the items that disagree (an inconsistent order healed)', () => {
    const xs = asExpenses(draft({ lines: [fertLine('a'), fertLine('b')] }));
    xs[0] = { ...xs[0], stage: 'committed' };
    const w = patchOrderFields(groupOrders(xs)[0], { stage: 'actual' });
    expect(w.map((x) => x.id)).toEqual(['ord-1-a']);
  });

  it('deliverOrder moves every not-yet-actual item to actual, skipping those already there', () => {
    const w = deliverOrder(order('committed'));
    expect(w).toHaveLength(3);
    w.forEach((x) => expect(x.patch).toEqual({ stage: 'actual' }));
    expect(deliverOrder(order('actual'))).toEqual([]);
    const xs = asExpenses(draft({ stage: 'committed', lines: [fertLine('a'), fertLine('b')] }));
    xs[1] = { ...xs[1], stage: 'actual' };
    expect(deliverOrder(groupOrders(xs)[0]).map((x) => x.id)).toEqual(['ord-1-a']);
  });

  it('a legacy single expense is patched like a one-item order', () => {
    const [o] = groupOrders([expense('exp-old')]);
    expect(patchOrderFields(o, { stage: 'actual', date: '2026-01-01' })).toEqual([{ id: 'exp-old', baseEventId: 'head-exp-old', patch: { date: '2026-01-01' } }]);
  });
});

// ── the ledger sees items, not orders (FO-11, FO-12) ────────────────────────

describe('ledger totals of an order built by buildOrderExpenses (no double count)', () => {
  let seq = 0;
  const events = (d: OrderDraft): FinanceEvent[] =>
    buildOrderExpenses(d).map((x) => {
      seq += 1;
      return {
        id: `ev${String(seq).padStart(4, '0')}`,
        groupId: 'g',
        deviceSeq: seq,
        ts: seq,
        actor: { userId: 'u', deviceId: 'dev-a' },
        source: 'app',
        targetId: x.id,
        baseEventId: null,
        payload: { t: 'expense_created', fields: x.fields },
      } as FinanceEvent;
    });

  const d = draft({ billDiscountSatang: 12_345, lines: [fertLine('a', { itemDiscountSatang: 50_000 }), fertLine('b', { qty: 3, grossSatang: 333_333 }), oilLine('c')] });

  it('actual order paid by a person: stage totals = net, owed = net, one reimbursement per item', () => {
    const state = projectFinance(events(d));
    const net = orderTotals(d).netSatang;
    expect(stageTotals(state.expenses)).toEqual({ actual: net, committed: 0, planned: { knownSatang: 0, unknownCount: 0 } });
    expect(state.reimbursements).toHaveLength(3);
    const owed = owedByPerson(state);
    expect(owed).toHaveLength(1);
    expect(owed[0].remainingSatang).toBe(net);
  });

  it('farm funds creates nothing owed back; a committed order is committed, not owed', () => {
    const farm = projectFinance(events(draft({ ...d, orderId: 'ord-2', payer: FARM })));
    expect(owedByPerson(farm)).toEqual([]);
    const committed = projectFinance(events(draft({ ...d, orderId: 'ord-3', stage: 'committed' })));
    expect(owedByPerson(committed)).toEqual([]);
    expect(stageTotals(committed.expenses).committed).toBe(orderTotals(d).netSatang);
    expect(stageTotals(committed.expenses).actual).toBe(0);
  });

  it('delivering (stage → actual on every item) turns the committed total into actual, once', () => {
    const evs = events(draft({ ...d, orderId: 'ord-4', stage: 'committed' }));
    const before = projectFinance(evs);
    const writes = deliverOrder(groupOrders(before.expenses)[0]);
    const changes: FinanceEvent[] = writes.map((w, i) => ({
      id: `chg${i}`,
      groupId: 'g',
      deviceSeq: 100 + i,
      ts: 100 + i,
      actor: { userId: 'u', deviceId: 'dev-a' },
      source: 'app',
      targetId: w.id,
      baseEventId: w.baseEventId,
      payload: { t: 'expense_changed', patch: w.patch },
    }));
    const after = projectFinance([...evs, ...changes]);
    const net = orderTotals(d).netSatang;
    expect(stageTotals(after.expenses)).toMatchObject({ actual: net, committed: 0 });
    expect(owedByPerson(after)[0].remainingSatang).toBe(net);
    expect(deliverOrder(groupOrders(after.expenses)[0])).toEqual([]);
  });
});
