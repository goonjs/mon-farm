import type { Expense, FertOption } from '../../../core/finance/ledger';
import { checkShare, shareDebts, splitShare } from '../../../core/finance/share';
import { editItemPatch, editItemProblems, optionRenames, itemGross, itemSacks, unifyOrder } from './tell';

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

describe('order-detail tell helpers', () => {
  it('sacks and gross come from the order item, else the legacy share', () => {
    expect(itemSacks(item())).toBe(20);
    expect(itemGross(item())).toBe(2_300_000);
    const legacy = item({ line: undefined, fertilizer: { ...item().fertilizer!, sacks: undefined }, share: { billSatang: 500, discountSatang: 0, totalSacks: 7, lines: [] } });
    expect(itemSacks(legacy)).toBe(7);
    expect(itemGross(legacy)).toBe(500);
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

  it('rebuilds an existing share of a non-fertilizer item in the same patch, lines kept (RM-5)', () => {
    const lines = [{ worker: A, sacks: 6, workerPct: 50, settle: 'debt' as const }];
    const e = item({ categoryId: 'cat-other', fertilizer: null, share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines } });
    const p = editItemPatch(e, money({ discount: 0 }), 'กระสอบ');
    expect(p.share).toEqual({ billSatang: 3_000_000, discountSatang: 0, totalSacks: 30, lines });
    expect(p.share!.billSatang - p.share!.discountSatang).toBe(p.amountSatang);
    expect(checkShare(p.share!)).toEqual([]);
    expect(splitShare(p.share!).lines).toHaveLength(1);
  });

  it('a share decided "not shared" (null) stays null (not touched)', () => {
    expect(editItemPatch(item({ share: null }), money(), 'กระสอบ').share).toBeUndefined();
  });

  it('blocks a quantity below the sacks given to tappers on a non-fertilizer item', () => {
    const e = item({ categoryId: 'cat-other', fertilizer: null, share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines: [{ worker: A, sacks: 12, workerPct: 50, settle: 'debt' }] } });
    expect(editItemProblems(e, money({ qty: 11 }))).toMatchObject({ tappers: 12 });
    expect(editItemProblems(e, money({ qty: 12 }))).toEqual({});
  });

  it('E11-S17 RM-3: a fertilizer item\'s old split and zones are not read — no block, no share rebuilt', () => {
    const lines = [{ worker: A, sacks: 12, workerPct: 50, settle: 'debt' as const }];
    // item() also has 3 sacks placed in zone z1
    const e = item({ share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines } });
    expect(editItemProblems(e, money({ qty: 2 }))).toEqual({});
    expect(editItemPatch(e, money(), 'กระสอบ').share).toBeUndefined();
  });

  it('a fixed name goes in the same patch: fertilizer = formula + brand, zones and reasons kept', () => {
    const lines = [{ worker: A, sacks: 6, workerPct: 50, settle: 'debt' as const }];
    const e = item({ item: 'ดีกลือ', fertilizer: { ...item().fertilizer!, formula: 'ดีกลือ', brand: 'ม้า' }, share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines } });
    const p = editItemPatch(e, money(), 'กระสอบ', { name: '  ดีเกลือ ', brand: ' ' });
    expect(p.item).toBe('ดีเกลือ');
    expect(p.fertilizer).toMatchObject({ formula: 'ดีเกลือ', brand: '', type: 'chemical', sackKg: 50, reasons: ['r1', 'r2'], zones: e.fertilizer!.zones });
    expect(p.share).toBeUndefined();
    expect(editItemPatch(e, money(), 'กระสอบ', { name: 'ดีเกลือ', brand: 'ม้า' }).item).toBe('ดีเกลือ ม้า');
  });

  it('a non-fertilizer item takes the typed name as is; an unchanged name writes no name keys', () => {
    const other = item({ categoryId: 'cat-fuel', item: 'ดีเซว', fertilizer: null, line: { qty: 2, unit: 'ลิตร', grossSatang: 6_000, itemDiscountSatang: 0 } });
    const p = editItemPatch(other, money(), 'ลิตร', { name: ' ดีเซล ', brand: '' });
    expect(p.item).toBe('ดีเซล');
    expect(p.fertilizer).toBeUndefined();
    const same = editItemPatch(item(), money(), 'กระสอบ', { name: '15-15-15', brand: '' });
    expect(same.item).toBeUndefined();
    expect(same.fertilizer?.formula).toBe('15-15-15');
  });

  it('after a rename the tapper debt of a shared non-fertilizer item reads the new name and keeps its amount', () => {
    const lines = [{ worker: A, sacks: 6, workerPct: 50, settle: 'debt' as const }];
    const e = item({ categoryId: 'cat-other', item: 'ดีกลือ', fertilizer: null, share: { billSatang: 2_300_000, discountSatang: 100_000, totalSacks: 20, lines } });
    const before = shareDebts([e])[0];
    const p = editItemPatch(e, money({ qty: 20, gross: 2_300_000, discount: 100_000 }), 'กระสอบ', { name: 'ดีเกลือ', brand: '' });
    const after = shareDebts([{ ...e, ...p } as Expense])[0];
    expect(before.note).toBe('ดีกลือ');
    expect(after.note).toBe('ดีเกลือ');
    expect(after.amountSatang).toBe(before.amountSatang);
  });

  it('a money-only edit never renames: a legacy item named by its formula alone keeps item, formula and brand as stored (review #3)', () => {
    const legacy = item({ item: 'ยูเรีย', fertilizer: { ...item().fertilizer!, formula: 'ยูเรีย ', brand: 'ตราม้า' } });
    const p = editItemPatch(legacy, money(), 'กระสอบ');
    expect(p.item).toBeUndefined();
    expect(p.fertilizer).toMatchObject({ formula: 'ยูเรีย ', brand: 'ตราม้า' });
    // also when the sheet hands back the name it opened with
    expect(editItemPatch(legacy, money(), 'กระสอบ', { name: 'ยูเรีย ', brand: 'ตราม้า' }).item).toBeUndefined();
  });

  it('an old item with no name can still be saved when the name is left alone (review #4)', () => {
    const nameless = item({ item: '', fertilizer: null, categoryId: 'cat-fertilizer' });
    expect(editItemProblems(nameless, money()).name).toBeUndefined();
    expect(editItemProblems(nameless, money(), { name: '', brand: '' }).name).toBeUndefined();
  });

  it('an empty name is a problem', () => {
    expect(editItemProblems(item(), money(), { name: '  ', brand: '' })).toMatchObject({ name: true });
    expect(editItemProblems(item(), money(), { name: 'ก', brand: '' }).name).toBeUndefined();
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

describe('optionRenames (E11-S13 Q4: fix the saved list too)', () => {
  const opt = (kind: FertOption['kind'], name: string, over: Partial<FertOption> = {}): FertOption => ({ id: `fopt-${kind}-${name}`, kind, name, description: 'd', hidden: false, ...over });

  it('renames the saved formula in place (same id, description and shown state kept)', () => {
    const w = optionRenames([opt('formula', 'ดีกลือ')], { name: 'ดีกลือ', brand: '' }, { name: ' ดีเกลือ ', brand: '' });
    expect(w).toEqual([{ id: 'fopt-formula-ดีกลือ', kind: 'formula', name: 'ดีเกลือ', description: 'd', hidden: false }]);
  });

  it('a saved brand that changed is renamed too', () => {
    const w = optionRenames([opt('formula', 'ก'), opt('brand', 'ตรามา')], { name: 'ก', brand: 'ตรามา' }, { name: 'ก', brand: 'ตราม้า' });
    expect(w).toEqual([{ id: 'fopt-brand-ตรามา', kind: 'brand', name: 'ตราม้า', description: 'd', hidden: false }]);
  });

  it('nothing when the name is unchanged, the old name is not saved or hidden, or the new name is empty', () => {
    const before = { name: 'ดีกลือ', brand: '' };
    expect(optionRenames([opt('formula', 'ดีกลือ')], before, before)).toEqual([]);
    expect(optionRenames([], before, { name: 'ดีเกลือ', brand: '' })).toEqual([]);
    expect(optionRenames([opt('formula', 'ดีกลือ', { hidden: true })], before, { name: 'ดีเกลือ', brand: '' })).toEqual([]);
    expect(optionRenames([opt('brand', 'x')], { name: 'a', brand: 'x' }, { name: 'a', brand: ' ' })).toEqual([]);
  });

  it('when the new name is already another saved option: hide the misspelt one and show that one, no duplicate', () => {
    const w = optionRenames([opt('formula', 'ดีกลือ'), opt('formula', 'ดีเกลือ', { hidden: true })], { name: 'ดีกลือ', brand: '' }, { name: 'ดีเกลือ', brand: '' });
    expect(w).toEqual([
      { id: 'fopt-formula-ดีเกลือ', kind: 'formula', name: 'ดีเกลือ', description: 'd', hidden: false },
      { id: 'fopt-formula-ดีกลือ', kind: 'formula', name: 'ดีกลือ', description: 'd', hidden: true },
    ]);
  });

  it('an option another live purchase still uses is not renamed: the new name is added (or shown) beside it (review #1)', () => {
    const other15 = item({ id: 'o2-a', fertilizer: { ...item().fertilizer!, formula: '15-15-15', brand: 'ตราม้า' } });
    const w = optionRenames([opt('formula', '15-15-15'), opt('brand', 'ตราม้า')], { name: '15-15-15', brand: 'ตราม้า' }, { name: '16-16-8', brand: 'ตราวัว' }, [other15]);
    expect(w).toEqual([
      { kind: 'formula', name: '16-16-8', description: '', hidden: false },
      { kind: 'brand', name: 'ตราวัว', description: '', hidden: false },
    ]);
    // already saved and shown: nothing to write
    expect(optionRenames([opt('formula', '15-15-15'), opt('formula', '16-16-8')], { name: '15-15-15', brand: '' }, { name: '16-16-8', brand: '' }, [other15])).toEqual([]);
    // a deleted purchase does not count
    expect(optionRenames([opt('formula', '15-15-15')], { name: '15-15-15', brand: '' }, { name: '16-16-8', brand: '' }, [{ ...other15, deleted: true }])[0]).toMatchObject({ id: 'fopt-formula-15-15-15', name: '16-16-8' });
  });

  it('show the existing name before hiding the misspelt one, so a write failing in between leaves both, never neither (review #2)', () => {
    const w = optionRenames([opt('formula', 'ดีกลือ'), opt('formula', 'ดีเกลือ', { hidden: true })], { name: 'ดีกลือ', brand: '' }, { name: 'ดีเกลือ', brand: '' });
    expect(w.map((x) => [x.id, x.hidden])).toEqual([['fopt-formula-ดีเกลือ', false], ['fopt-formula-ดีกลือ', true]]);
  });
});
