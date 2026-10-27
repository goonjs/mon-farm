import { describe, expect, it } from 'vitest';

import { fertProducts, reasonsByUse } from './fert-products';
import { fertOptionId, type Expense, type FertOption } from './ledger';
import type { FertilizerDetails } from './types';

const details = (over: Partial<FertilizerDetails> = {}): FertilizerDetails => ({
  type: 'chemical',
  formula: '15-15-15',
  brand: 'ตราใบไม้ทอง',
  sackKg: 50,
  reasons: [],
  zones: [],
  shop: '',
  orderedBy: '',
  ...over,
});

let n = 0;
function purchase(date: string, f: FertilizerDetails, billSatang = 1_000_000, sacks = 10, deleted = false): Expense {
  n += 1;
  return {
    id: `exp-${n}`,
    amountSatang: billSatang,
    date,
    stage: 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: f.formula,
    note: '',
    payer: null,
    share: { billSatang, discountSatang: 0, totalSacks: sacks, lines: [] },
    fertilizer: f,
    deleted,
    history: [],
    conflicts: [],
    waiting: false,
    headEventId: `e-${n}`,
    heads: [`e-${n}`],
    createdOn: 'dev',
    createdAt: 0,
  };
}

const opt = (kind: FertOption['kind'], name: string, hidden = false, description = ''): FertOption => ({ id: fertOptionId(kind, name), kind, name, description, hidden });

describe('fertProducts — "ซื้อปุ๋ยอะไร" (E11-S10 F1)', () => {
  it('past purchases whose formula is saved, one row per type+formula+brand+size, newest first, with the last price per sack', () => {
    const xs = [
      purchase('2026-09-01', details({ formula: '46-0-0', brand: 'ตรามงกุฎ' }), 900_000, 10),
      purchase('2026-10-01', details(), 1_000_000, 10),
      purchase('2026-08-01', details(), 800_000, 10),
    ];
    const list = fertProducts(xs, [opt('formula', '15-15-15'), opt('formula', '46-0-0')]);
    expect(list.map((p) => [p.formula, p.brand, p.lastPerSackSatang])).toEqual([
      ['15-15-15', 'ตราใบไม้ทอง', 100_000],
      ['46-0-0', 'ตรามงกุฎ', 90_000],
    ]);
    expect(list[0]).toMatchObject({ type: 'chemical', sackKg: 50 });
  });

  it('a formula used once (never saved), hidden in settings, or only on a deleted purchase is not offered', () => {
    const xs = [purchase('2026-10-02', details({ formula: 'ครั้งเดียว' })), purchase('2026-10-03', details({ formula: '8-24-24' })), purchase('2026-10-04', details({ formula: '0-0-60' }), 1, 1, true)];
    const list = fertProducts(xs, [opt('formula', '8-24-24', true), opt('formula', '0-0-60')]);
    expect(list.map((p) => p.formula)).toEqual(['0-0-60']);
    // 0-0-60 comes from the saved option alone: no purchase left, so no last price.
    expect(list[0]).toMatchObject({ type: null, brand: '', sackKg: null, lastPerSackSatang: null });
  });

  it('a saved formula never bought yet is offered after the bought ones', () => {
    const list = fertProducts([purchase('2026-10-01', details())], [opt('formula', '15-15-15'), opt('formula', '13-13-21')]);
    expect(list.map((p) => p.formula)).toEqual(['15-15-15', '13-13-21']);
  });

  it('names match however they were typed (spaces, case)', () => {
    const list = fertProducts([purchase('2026-10-01', details({ formula: ' Urea  46 ' }))], [opt('formula', 'urea 46')]);
    expect(list).toHaveLength(1);
  });
});

describe('reasonsByUse — "ใส่ทำไม", most used first (F3)', () => {
  it('orders shown reasons by how many live purchases chose them, then by name', () => {
    const a = opt('reason', 'บำรุงต้น');
    const b = opt('reason', 'ใบเหลือง');
    const c = opt('reason', 'เร่งน้ำยาง');
    const gone = opt('reason', 'หน้ายางแห้ง', true);
    const xs = [purchase('2026-10-01', details({ reasons: [b.id] })), purchase('2026-10-02', details({ reasons: [b.id, c.id] })), purchase('2026-10-03', details({ reasons: [a.id] }), 1, 1, true)];
    expect(reasonsByUse([a, b, c, gone], xs).map((o) => o.name)).toEqual(['ใบเหลือง', 'เร่งน้ำยาง', 'บำรุงต้น']);
  });
});
