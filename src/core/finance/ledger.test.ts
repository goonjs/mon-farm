import { describe, expect, it } from 'vitest';

import {
  allocateOldestFirst,
  checkExpense,
  defaultPayer,
  DEFAULT_CATEGORIES,
  filterExpenses,
  owedByPerson,
  payableSatang,
  projectFinance,
  stageTotals,
} from './ledger';
import { FARM_FUNDS, type ExpenseFields, type FinanceEvent, type FinancePayload, type Payer } from './types';

// ── fixtures ────────────────────────────────────────────────────────────────

let n = 0;
function ev(
  targetId: string,
  payload: FinancePayload,
  opts: { base?: string | null; device?: string; id?: string } = {},
): FinanceEvent {
  n += 1;
  return {
    id: opts.id ?? `e${String(n).padStart(4, '0')}`,
    deviceSeq: n,
    ts: 1_000 + n,
    actor: { userId: 'u', deviceId: opts.device ?? 'dev-a' },
    source: 'app',
    targetId,
    baseEventId: opts.base ?? null,
    payload,
  };
}

const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const SOMWANG: Payer = { id: 'p-somwang', name: 'อาจารย์สมหวัง' };
const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };

function fields(over: Partial<ExpenseFields> = {}): ExpenseFields {
  return {
    amountSatang: 64000,
    date: '2026-09-28',
    stage: 'actual',
    categoryId: 'cat-fuel',
    propertyId: null,
    item: '',
    note: '',
    payer: null,
    ...over,
  };
}

function created(id: string, over: Partial<ExpenseFields> = {}, opts: { device?: string } = {}) {
  return ev(id, { t: 'expense_created', fields: fields(over) }, opts);
}

// ── E11-S01 ─────────────────────────────────────────────────────────────────

describe('E11-S01 expenses and lifecycle', () => {
  it('form needs only amount + date; stage defaults to actual', () => {
    expect(checkExpense({ amountSatang: 64000, date: '2026-09-28', stage: 'actual' })).toEqual([]);
    expect(checkExpense({ amountSatang: null, date: '2026-09-28', stage: 'actual' })).toEqual(['amount-required']);
    expect(checkExpense({ amountSatang: 100, date: '', stage: 'actual' })).toEqual(['date-required']);
  });

  it('planned may have an unknown amount; committed/actual may not', () => {
    expect(checkExpense({ amountSatang: null, date: '2026-11-15', stage: 'planned' })).toEqual([]);
    expect(checkExpense({ amountSatang: null, date: '2026-11-15', stage: 'committed' })).toEqual(['amount-required']);
  });

  it('money must be whole satang, never a float or negative', () => {
    expect(checkExpense({ amountSatang: 10.5, date: '2026-09-28', stage: 'actual' })).toEqual(['amount-invalid']);
    expect(checkExpense({ amountSatang: -1, date: '2026-09-28', stage: 'actual' })).toEqual(['amount-invalid']);
  });

  it('default categories are the nine from D-62, renamable and extendable', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual([
      'ปุ๋ย',
      'ค่าแรง',
      'น้ำมันตัดหญ้า',
      'ยาฆ่าหญ้า',
      'เดินทาง',
      'เงินเดือนผู้จัดการ',
      'ช่วยเหลือคนงาน',
      'ซ่อมแซม/อุปกรณ์',
      'อื่น ๆ',
    ]);
    const s = projectFinance([
      ev('cat-fuel', { t: 'category_renamed', name: 'น้ำมัน' }),
      ev('cat-x', { t: 'category_added', name: 'ค่าไฟ' }),
    ]);
    expect(s.categories.find((c) => c.id === 'cat-fuel')?.name).toBe('น้ำมัน');
    expect(s.categories.map((c) => c.name)).toContain('ค่าไฟ');
    expect(s.categories).toHaveLength(10);
  });

  it('totals per stage: planned never enters actual; unknown planned is counted, not zero', () => {
    const s = projectFinance([
      created('x1', { amountSatang: 64000 }),
      created('x2', { amountSatang: 40000 }),
      created('x3', { amountSatang: 1500000, stage: 'committed' }),
      created('x4', { amountSatang: null, stage: 'planned' }),
      created('x5', { amountSatang: 250050, stage: 'planned' }),
    ]);
    expect(stageTotals(s.expenses)).toEqual({
      actual: 104000,
      committed: 1500000,
      planned: { knownSatang: 250050, unknownCount: 1 },
    });
  });

  it('moving stage keeps history; planned→actual with unknown amount is refused', () => {
    const c = created('x1', { amountSatang: null, stage: 'planned' });
    expect(checkExpense({ amountSatang: null, date: '2026-11-15', stage: 'actual' })).toEqual(['amount-required']);
    const ch = ev('x1', { t: 'expense_changed', patch: { amountSatang: 300000, stage: 'committed' } }, { base: c.id });
    const ch2 = ev('x1', { t: 'expense_changed', patch: { stage: 'actual' } }, { base: ch.id });
    const s = projectFinance([c, ch, ch2]);
    const x = s.expenses[0];
    expect(x.stage).toBe('actual');
    expect(x.amountSatang).toBe(300000);
    expect(x.history.map((h) => h.stage)).toEqual(['planned', 'committed', 'actual']);
  });

  it('soft delete hides from totals and restore brings it back', () => {
    const c = created('x1');
    const d = ev('x1', { t: 'expense_changed', patch: { deleted: true } }, { base: c.id });
    expect(stageTotals(projectFinance([c, d]).expenses).actual).toBe(0);
    expect(projectFinance([c, d]).expenses[0].deleted).toBe(true);
    const r = ev('x1', { t: 'expense_changed', patch: { deleted: false } }, { base: d.id });
    expect(stageTotals(projectFinance([c, d, r]).expenses).actual).toBe(64000);
  });

  it('two devices editing the amount from the same base → conflict, totals use the base value', () => {
    const c = created('x1', { amountSatang: 64000 });
    const a = ev('x1', { t: 'expense_changed', patch: { amountSatang: 70000 } }, { base: c.id, device: 'dev-a' });
    const b = ev('x1', { t: 'expense_changed', patch: { amountSatang: 65000 } }, { base: c.id, device: 'dev-b' });
    for (const order of [
      [c, a, b],
      [b, c, a],
    ]) {
      const x = projectFinance(order).expenses[0];
      expect(x.amountSatang).toBe(64000);
      expect(x.conflicts).toEqual([{ field: 'amountSatang', values: [65000, 70000] }]);
    }
  });

  it('concurrent edits to different non-money fields merge without conflict', () => {
    const c = created('x1');
    const a = ev('x1', { t: 'expense_changed', patch: { note: 'ร้านเดิม' } }, { base: c.id, device: 'dev-a' });
    const b = ev('x1', { t: 'expense_changed', patch: { item: 'น้ำมัน 10 ลิตร' } }, { base: c.id, device: 'dev-b' });
    const x = projectFinance([c, b, a]).expenses[0];
    expect(x.conflicts).toEqual([]);
    expect(x.note).toBe('ร้านเดิม');
    expect(x.item).toBe('น้ำมัน 10 ลิตร');
  });

  it('a later edit that names both heads resolves the conflict', () => {
    const c = created('x1', { amountSatang: 64000 });
    const a = ev('x1', { t: 'expense_changed', patch: { amountSatang: 70000 } }, { base: c.id, device: 'dev-a' });
    const b = ev('x1', { t: 'expense_changed', patch: { amountSatang: 65000 } }, { base: c.id, device: 'dev-b' });
    const fix = ev('x1', { t: 'expense_changed', patch: { amountSatang: 70000 }, alsoBasedOn: [b.id] }, { base: a.id });
    const x = projectFinance([c, a, b, fix]).expenses[0];
    expect(x.conflicts).toEqual([]);
    expect(x.amountSatang).toBe(70000);
  });

  it('a change that arrives before its base is held, not applied', () => {
    const c = created('x1', { amountSatang: 64000 });
    const late = ev('x1', { t: 'expense_changed', patch: { amountSatang: 1 } }, { base: 'never-seen' });
    const x = projectFinance([c, late]).expenses[0];
    expect(x.amountSatang).toBe(64000);
    expect(x.waiting).toBe(true);
  });

  it('re-receiving the same event is harmless', () => {
    const c = created('x1');
    expect(projectFinance([c, c]).expenses).toHaveLength(1);
  });

  describe('filters (F4, F7)', () => {
    const events = [
      created('x1', { stage: 'actual', categoryId: 'cat-fuel', date: '2026-09-28', payer: NAT }),
      created('x2', { stage: 'committed', categoryId: 'cat-salary', date: '2026-10-31', payer: null }),
      created('x3', { stage: 'actual', categoryId: 'cat-herbicide', date: '2026-09-15', payer: SOMWANG, propertyId: 'prop-1' }),
      created('x4', { stage: 'actual', categoryId: 'cat-fertilizer', date: '2026-09-20', payer: null }),
      created('x5', { stage: 'actual', categoryId: 'cat-repair', date: '2026-09-22', payer: FARM }),
    ];
    const s = projectFinance(events);
    const ids = (f: Parameters<typeof filterExpenses>[1]) => filterExpenses(s, f).map((x) => x.id);

    it('by stage, category, property, month', () => {
      expect(ids({ stage: 'committed' })).toEqual(['x2']);
      expect(ids({ categoryId: 'cat-fuel' })).toEqual(['x1']);
      expect(ids({ propertyId: 'prop-1' })).toEqual(['x3']);
      expect(ids({ month: '2026-09' })).toEqual(['x1', 'x5', 'x4', 'x3']);
    });

    it('newest date first', () => {
      expect(ids({})).toEqual(['x2', 'x1', 'x5', 'x4', 'x3']);
    });

    it('"no payer recorded"', () => {
      expect(ids({ payerMissing: true })).toEqual(['x2', 'x4']);
    });

    it('"not yet repaid to payer", narrowed by payer', () => {
      expect(ids({ unrepaid: true })).toEqual(['x1', 'x3']);
      expect(ids({ unrepaid: true, payerId: SOMWANG.id })).toEqual(['x3']);
    });
  });
});

// ── E11-S02 ─────────────────────────────────────────────────────────────────

describe('E11-S02 payer and money owed back', () => {
  it('farm funds creates nothing owed', () => {
    const s = projectFinance([created('x1', { payer: FARM })]);
    expect(s.reimbursements).toEqual([]);
  });

  it('a person paying an actual expense is owed it back', () => {
    const s = projectFinance([created('x1', { payer: NAT, amountSatang: 64000, date: '2026-09-28' })]);
    expect(s.reimbursements).toEqual([
      expect.objectContaining({
        expenseId: 'x1',
        to: NAT,
        originalSatang: 64000,
        repaidSatang: 0,
        remainingSatang: 64000,
        date: '2026-09-28',
        status: 'owed',
      }),
    ]);
  });

  it('committed/planned with a payer: nothing yet; moving to actual creates it', () => {
    const c = created('x1', { payer: NAT, stage: 'committed' });
    expect(projectFinance([c]).reimbursements).toEqual([]);
    const ch = ev('x1', { t: 'expense_changed', patch: { stage: 'actual' } }, { base: c.id });
    expect(projectFinance([c, ch]).reimbursements).toHaveLength(1);
  });

  it('changing payer, amount, or switching to farm funds follows the expense', () => {
    const c = created('x1', { payer: NAT, amountSatang: 64000 });
    const amt = ev('x1', { t: 'expense_changed', patch: { amountSatang: 70000 } }, { base: c.id });
    expect(projectFinance([c, amt]).reimbursements[0].originalSatang).toBe(70000);
    const who = ev('x1', { t: 'expense_changed', patch: { payer: SOMWANG } }, { base: amt.id });
    expect(projectFinance([c, amt, who]).reimbursements[0].to).toEqual(SOMWANG);
    const farm = ev('x1', { t: 'expense_changed', patch: { payer: FARM } }, { base: who.id });
    expect(projectFinance([c, amt, who, farm]).reimbursements).toEqual([]);
  });

  it('deleting the expense cancels what was owed', () => {
    const c = created('x1', { payer: NAT });
    const d = ev('x1', { t: 'expense_changed', patch: { deleted: true } }, { base: c.id });
    expect(projectFinance([c, d]).reimbursements).toEqual([]);
  });

  it('default payer = the payer of this device’s previous expense', () => {
    const events = [
      created('x1', { payer: NAT }, { device: 'dev-a' }),
      created('x2', { payer: SOMWANG }, { device: 'dev-b' }),
      created('x3', { payer: null }, { device: 'dev-a' }),
    ];
    expect(defaultPayer(events, 'dev-a')).toBeNull();
    expect(defaultPayer(events.slice(0, 2), 'dev-a')).toEqual(NAT);
    expect(defaultPayer(events, 'dev-b')).toEqual(SOMWANG);
    expect(defaultPayer([], 'dev-a')).toBeNull();
  });

  it('owed-to page: remaining per person, drillable to the expenses', () => {
    const s = projectFinance([
      created('x1', { payer: SOMWANG, amountSatang: 80000, date: '2026-09-15' }),
      created('x2', { payer: SOMWANG, amountSatang: 40000, date: '2026-09-22' }),
      created('x3', { payer: NAT, amountSatang: 64000, date: '2026-09-28' }),
    ]);
    const owed = owedByPerson(s);
    expect(owed.map((o) => [o.payer.id, o.remainingSatang, o.items.map((i) => i.expenseId)])).toEqual([
      ['p-somwang', 120000, ['x1', 'x2']],
      ['p-nat', 64000, ['x3']],
    ]);
    expect(owed[0].oldestDate).toBe('2026-09-15');
  });

  it('"to pay" card = remaining owed back + committed expenses', () => {
    const s = projectFinance([
      created('x1', { payer: SOMWANG, amountSatang: 80000 }),
      created('x2', { stage: 'committed', amountSatang: 1500000 }),
      created('x3', { stage: 'planned', amountSatang: 999 }),
      created('x4', { payer: FARM, amountSatang: 5000 }),
    ]);
    expect(payableSatang(s)).toBe(1580000);
  });
});

// ── E11-S03 ─────────────────────────────────────────────────────────────────

describe('E11-S03 repayments', () => {
  const base = [
    created('x1', { payer: SOMWANG, amountSatang: 80000, date: '2026-09-15' }),
    created('x2', { payer: SOMWANG, amountSatang: 40000, date: '2026-09-22' }),
  ];

  it('allocates oldest first; a part payment leaves the newest partly owed', () => {
    const s = projectFinance(base);
    const plan = allocateOldestFirst(s.reimbursements.filter((r) => r.to.id === SOMWANG.id), 100000);
    expect(plan).toEqual({ ok: true, allocations: [{ expenseId: 'x1', satang: 80000 }, { expenseId: 'x2', satang: 20000 }] });
  });

  it('cannot repay more than what is left', () => {
    const s = projectFinance(base);
    expect(allocateOldestFirst(s.reimbursements, 120001)).toEqual({ ok: false, reason: 'over', maxSatang: 120000 });
    expect(allocateOldestFirst(s.reimbursements, 0)).toEqual({ ok: false, reason: 'amount-invalid', maxSatang: 120000 });
  });

  it('remaining and status: owed → partial → repaid, over several instalments', () => {
    const r1 = ev('rp1', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 30000, date: '2026-10-01', note: '', allocations: [{ expenseId: 'x1', satang: 30000 }], saleId: null },
    });
    let s = projectFinance([...base, r1]);
    expect(s.reimbursements[0]).toMatchObject({ repaidSatang: 30000, remainingSatang: 50000, status: 'partial' });
    const r2 = ev('rp2', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 50000, date: '2026-10-03', note: '', allocations: [{ expenseId: 'x1', satang: 50000 }], saleId: null },
    });
    s = projectFinance([...base, r1, r2]);
    expect(s.reimbursements[0]).toMatchObject({ repaidSatang: 80000, remainingSatang: 0, status: 'repaid' });
    expect(s.reimbursements[0].repayments.map((r) => r.id)).toEqual(['rp1', 'rp2']);
  });

  it('records who repaid whom (default farm → payee, changeable)', () => {
    const r = ev('rp1', {
      t: 'repayment_recorded',
      fields: { from: NAT, to: SOMWANG, amountSatang: 10000, date: '2026-10-01', note: 'นัดคืนเอง', allocations: [{ expenseId: 'x1', satang: 10000 }], saleId: null },
    });
    const s = projectFinance([...base, r]);
    expect(s.repayments[0]).toMatchObject({ from: NAT, to: SOMWANG, note: 'นัดคืนเอง' });
  });

  it('netting at settlement is one repayment that names the sale; deleting it un-repays', () => {
    const r = ev('rp1', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 80000, date: '2026-10-03', note: '', allocations: [{ expenseId: 'x1', satang: 80000 }], saleId: 'sale-3oct' },
    });
    let s = projectFinance([...base, r]);
    expect(s.repayments[0].saleId).toBe('sale-3oct');
    expect(s.reimbursements[0].status).toBe('repaid');
    const del = ev('rp1', { t: 'repayment_changed', patch: { deleted: true } }, { base: r.id });
    s = projectFinance([...base, r, del]);
    expect(s.reimbursements[0].status).toBe('owed');
    expect(s.repayments[0].deleted).toBe(true);
  });

  it('editing a repayment recomputes the balance from the log', () => {
    const r = ev('rp1', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 30000, date: '2026-10-01', note: '', allocations: [{ expenseId: 'x1', satang: 30000 }], saleId: null },
    });
    const ch = ev(
      'rp1',
      { t: 'repayment_changed', patch: { amountSatang: 20000, allocations: [{ expenseId: 'x1', satang: 20000 }] } },
      { base: r.id },
    );
    expect(projectFinance([...base, r, ch]).reimbursements[0].remainingSatang).toBe(60000);
  });

  it('two devices repaying the same debt past its total → flagged, not silently capped', () => {
    const a = ev('rp1', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 80000, date: '2026-10-01', note: '', allocations: [{ expenseId: 'x1', satang: 80000 }], saleId: null },
    }, { device: 'dev-a' });
    const b = ev('rp2', {
      t: 'repayment_recorded',
      fields: { from: FARM, to: SOMWANG, amountSatang: 50000, date: '2026-10-01', note: '', allocations: [{ expenseId: 'x1', satang: 50000 }], saleId: null },
    }, { device: 'dev-b' });
    const x1 = projectFinance([...base, a, b]).reimbursements[0];
    expect(x1).toMatchObject({ repaidSatang: 130000, remainingSatang: -50000, status: 'overpaid' });
  });
});
