import { describe, expect, it } from 'vitest';

import { balanceAfterSale, checkDebt, fertilizerSplit, projectDebts } from './debts';
import { projectFinance } from './ledger';
import { FARM_FUNDS, type DebtFields, type DebtPaymentFields, type FinanceEvent, type FinancePayload, type Payer } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, opts: { base?: string | null; device?: string } = {}): FinanceEvent {
  n += 1;
  return {
    id: `d${String(n).padStart(4, '0')}`,
    groupId: 'group-1',
    deviceSeq: n,
    ts: n,
    actor: { userId: 'u', deviceId: opts.device ?? 'dev-a' },
    source: 'app',
    targetId,
    baseEventId: opts.base ?? null,
    payload,
  };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const SOMWANG: Payer = { id: 'p-somwang', name: 'อาจารย์สมหวัง' };

function debt(id: string, over: Partial<DebtFields>) {
  const fields: DebtFields = {
    worker: DAENG,
    kind: 'loan',
    amountSatang: 300000,
    date: '2026-09-10',
    note: '',
    lender: FARM,
    fertilizer: null,
    carriedForward: false,
    ...over,
  };
  return ev(id, { t: 'debt_added', fields });
}

function pay(id: string, over: Partial<DebtPaymentFields>) {
  const fields: DebtPaymentFields = {
    worker: DAENG,
    creditor: FARM,
    amountSatang: 0,
    date: '2026-10-03',
    note: '',
    method: 'outside',
    saleId: null,
    ...over,
  };
  return ev(id, { t: 'debt_payment_recorded', fields });
}

describe('fertilizer split (D-59, F8)', () => {
  it('50% by default, whole percent only, rounded half-up to the satang', () => {
    expect(fertilizerSplit(400000, 50)).toEqual({ workerSatang: 200000, ownerSatang: 200000 });
    expect(fertilizerSplit(100001, 50)).toEqual({ workerSatang: 50001, ownerSatang: 50000 });
    expect(fertilizerSplit(100000, 33)).toEqual({ workerSatang: 33000, ownerSatang: 67000 });
    expect(fertilizerSplit(1, 50)).toEqual({ workerSatang: 1, ownerSatang: 0 });
    expect(() => fertilizerSplit(100, 33.5)).toThrow();
  });
});

describe('checkDebt', () => {
  it('review #9: a 0% fertilizer debt (owner pays the whole bill) is allowed', () => {
    expect(checkDebt({ kind: 'fertilizer', amountSatang: 0, date: '2026-09-01', note: '', fertilizerTotalSatang: 400000 })).toEqual([]);
    expect(checkDebt({ kind: 'fertilizer', amountSatang: 0, date: '2026-09-01', note: '', fertilizerTotalSatang: 0 })).toEqual(['amount-required']);
  });

  it('"other" needs a note; amount and date required', () => {
    expect(checkDebt({ kind: 'other', amountSatang: 100, date: '2026-09-01', note: '' })).toEqual(['note-required']);
    expect(checkDebt({ kind: 'loan', amountSatang: 0, date: '', note: '' })).toEqual(['amount-required', 'date-required']);
    expect(checkDebt({ kind: 'loan', amountSatang: 100, date: '2026-09-01', note: '' })).toEqual([]);
  });
});

describe('E06-S03 tapper ledger', () => {
  it('one balance per person: carried forward + 3 kinds − deductions (3 methods) − outside payment', () => {
    const events = [
      debt('b0', { kind: 'other', amountSatang: 50000, carriedForward: true, note: 'ยอดยกมา', date: '2026-08-01' }),
      debt('b1', { kind: 'loan', amountSatang: 300000 }),
      debt('b2', { kind: 'fertilizer', amountSatang: 200000, fertilizer: { totalSatang: 400000, workerPct: 50 }, date: '2026-09-20' }),
      debt('b3', { kind: 'other', amountSatang: 10000, note: 'ค่ามีด' }),
      pay('q1', { amountSatang: 100000, method: 'cash-from-share', saleId: 's1' }),
      pay('q2', { amountSatang: 50000, method: 'buyer-split', saleId: 's2' }),
      pay('q3', { amountSatang: 20000, method: 'transfer-with-owner', saleId: 's3' }),
      pay('q4', { amountSatang: 30000, method: 'outside' }),
    ];
    const a = projectDebts(events).get(DAENG.id)!;
    expect(a.balanceSatang).toBe(560000 - 200000);
    expect(a.summary).toEqual({
      owed: { loan: 300000, fertilizer: 200000, other: 60000 },
      deducted: { 'cash-from-share': 100000, 'buyer-split': 50000, 'transfer-with-owner': 20000, netting: 0 },
      outside: 30000,
      balanceSatang: 360000,
    });
  });

  it('voiding a debt recomputes the balance and keeps it in history', () => {
    const b = debt('b1', { amountSatang: 300000 });
    const v = ev('b1', { t: 'debt_changed', patch: { deleted: true } }, { base: b.id });
    const a = projectDebts([b, v]).get(DAENG.id)!;
    expect(a.balanceSatang).toBe(0);
    expect(a.history.find((h) => h.id === 'b1')?.deleted).toBe(true);
  });

  it('deductions of a cancelled or deleted sale do not count; restoring counts again', () => {
    const events = [debt('b1', { amountSatang: 300000 }), pay('q1', { amountSatang: 100000, method: 'cash-from-share', saleId: 's1' })];
    expect(projectDebts(events, () => false).get(DAENG.id)!.balanceSatang).toBe(300000);
    expect(projectDebts(events, () => true).get(DAENG.id)!.balanceSatang).toBe(200000);
  });

  it('a loan from someone else is shown but never deductible, and creates nothing the farm owes (D-69)', () => {
    const events = [
      debt('b1', { worker: NAT, kind: 'loan', amountSatang: 100000, lender: SOMWANG }),
      pay('q1', { worker: NAT, creditor: SOMWANG, amountSatang: 50000 }),
    ];
    const a = projectDebts(events).get(NAT.id)!;
    expect(a.balanceSatang).toBe(0);
    expect(a.others).toEqual([{ lender: SOMWANG, owedSatang: 100000, paidSatang: 50000, balanceSatang: 50000 }]);
    expect(projectFinance(events).reimbursements).toEqual([]);
  });

  it('paying back more than owed goes negative and is flagged (F10)', () => {
    const events = [debt('b1', { amountSatang: 10000 }), pay('q1', { amountSatang: 15000 })];
    const a = projectDebts(events).get(DAENG.id)!;
    expect(a.balanceSatang).toBe(-5000);
    expect(a.overpaid).toBe(true);
  });

  it('two devices paying past the balance are flagged, not capped', () => {
    const events = [
      debt('b1', { amountSatang: 10000 }),
      pay('q1', { amountSatang: 10000 }),
      { ...pay('q2', { amountSatang: 10000 }), actor: { userId: 'u', deviceId: 'dev-b' } },
    ];
    expect(projectDebts(events).get(DAENG.id)).toMatchObject({ balanceSatang: -10000, overpaid: true });
  });

  it('one instalment plan per person, per sale; edit and cancel (D-59)', () => {
    const p = ev('plan-p-daeng', { t: 'debt_plan_set', worker: DAENG, perSaleSatang: 200000 });
    expect(projectDebts([debt('b1', {}), p]).get(DAENG.id)!.planPerSaleSatang).toBe(200000);
    const c = ev('plan-p-daeng', { t: 'debt_plan_set', worker: DAENG, perSaleSatang: null }, { base: p.id });
    expect(projectDebts([debt('b1', {}), p, c]).get(DAENG.id)!.planPerSaleSatang).toBeNull();
  });

  it('history: date order, filterable by kind, each line points at its source', () => {
    const events = [
      debt('b1', { kind: 'loan', date: '2026-09-10' }),
      debt('b2', { kind: 'fertilizer', amountSatang: 200000, fertilizer: { totalSatang: 400000, workerPct: 50 }, date: '2026-09-20' }),
      pay('q1', { amountSatang: 200000, method: 'cash-from-share', saleId: 's1', date: '2026-10-03' }),
    ];
    const h = projectDebts(events).get(DAENG.id)!.history;
    expect(h.map((x) => [x.id, x.type, x.signedSatang, x.saleId])).toEqual([
      ['q1', 'deduction', -200000, 's1'],
      ['b2', 'fertilizer', 200000, null],
      ['b1', 'loan', 300000, null],
    ]);
  });

  it('manual fertilizer debt creates the owner-share expense, which follows edits and voids (D-67)', () => {
    const b = debt('b2', { kind: 'fertilizer', amountSatang: 200000, fertilizer: { totalSatang: 400000, workerPct: 50 }, date: '2026-09-20', note: 'ปุ๋ยรอบ ก.ย.' });
    let s = projectFinance([b]);
    const x = s.expenses.find((e) => e.id === 'b2:owner')!;
    expect(x).toMatchObject({ amountSatang: 200000, stage: 'actual', categoryId: 'cat-fertilizer', date: '2026-09-20', payer: null });
    expect(s.reimbursements).toEqual([]);

    // Payer set later (F7) → the farm owes them the owner share.
    const setPayer = ev('b2:owner', { t: 'expense_changed', patch: { payer: { id: 'p-owner', name: 'เจ้าของสวน' } } }, { base: x.headEventId });
    s = projectFinance([b, setPayer]);
    expect(s.reimbursements[0]).toMatchObject({ expenseId: 'b2:owner', originalSatang: 200000 });

    // Debt edited to 60% of 5,000 → owner share 2,000; payer survives.
    const edit = ev('b2', { t: 'debt_changed', patch: { amountSatang: 300000, fertilizer: { totalSatang: 500000, workerPct: 60 } } }, { base: b.id });
    s = projectFinance([b, setPayer, edit]);
    expect(s.expenses.find((e) => e.id === 'b2:owner')).toMatchObject({ amountSatang: 200000, payer: { id: 'p-owner' } });
    const edit2 = ev('b2', { t: 'debt_changed', patch: { fertilizer: { totalSatang: 500000, workerPct: 40 }, amountSatang: 200000 } }, { base: edit.id });
    s = projectFinance([b, setPayer, edit, edit2]);
    expect(s.expenses.find((e) => e.id === 'b2:owner')!.amountSatang).toBe(300000);

    const voided = ev('b2', { t: 'debt_changed', patch: { deleted: true } }, { base: edit2.id });
    s = projectFinance([b, setPayer, edit, edit2, voided]);
    expect(s.expenses.find((e) => e.id === 'b2:owner')!.deleted).toBe(true);
    expect(s.reimbursements).toEqual([]);
  });

  it('review #6: a debt changed away from fertilizer deletes its owner-share expense', () => {
    const b = debt('b7', { kind: 'fertilizer', amountSatang: 200000, fertilizer: { totalSatang: 400000, workerPct: 50 } });
    const e = ev('b7', { t: 'debt_changed', patch: { kind: 'loan', fertilizer: null } }, { base: b.id });
    expect(projectFinance([b, e]).expenses.find((x) => x.id === 'b7:owner')?.deleted).toBe(true);
  });

  it('review #5: an owner-share edit then a debt edit do not conflict when the expense edit is payer-only', () => {
    const b = debt('b8', { kind: 'fertilizer', amountSatang: 200000, fertilizer: { totalSatang: 400000, workerPct: 50 } });
    const pay = ev('b8:owner', { t: 'expense_changed', patch: { payer: FARM } }, { base: b.id + ':owner' });
    const e = ev('b8', { t: 'debt_changed', patch: { amountSatang: 300000, fertilizer: { totalSatang: 500000, workerPct: 60 } } }, { base: b.id });
    const x = projectFinance([b, pay, e]).expenses.find((y) => y.id === 'b8:owner')!;
    expect(x.conflicts).toEqual([]);
    expect(x).toMatchObject({ amountSatang: 200000, payer: FARM });
  });

  it('separate accounts per worker', () => {
    const m = projectDebts([debt('b1', {}), debt('b2', { worker: NAT, amountSatang: 150000 })]);
    expect(m.get(DAENG.id)!.balanceSatang).toBe(300000);
    expect(m.get(NAT.id)!.balanceSatang).toBe(150000);
  });
});

describe('debt left after a given sale (review F9)', () => {
  it('is today\'s balance plus what later sales and payments took off, minus debts added later', () => {
    const log = [
      debt('d1', { amountSatang: 500000, date: '2026-09-01' }),
      pay('s1', { amountSatang: 200000, date: '2026-10-03', method: 'cash-from-share', saleId: 'sale-1' }),
      pay('s2', { amountSatang: 100000, date: '2026-10-10', method: 'cash-from-share', saleId: 'sale-2' }),
      debt('d2', { amountSatang: 50000, date: '2026-10-12' }),
      pay('o1', { amountSatang: 30000, date: '2026-10-13', method: 'outside' }),
    ];
    const acc = projectDebts(log).get(DAENG.id)!;
    expect(acc.balanceSatang).toBe(500000 - 200000 - 100000 + 50000 - 30000);
    expect(balanceAfterSale(acc, 'sale-1', '2026-10-03')).toBe(300000);
    expect(balanceAfterSale(acc, 'sale-2', '2026-10-10')).toBe(200000);
    // the latest sale: today's balance
    expect(balanceAfterSale(acc, 'sale-3', '2026-10-14')).toBe(acc.balanceSatang);
  });

  // E05-S10: a sale entered for an earlier day deducts from a debt dated after it: what it did not
  // take of that debt is still owed, not dropped (owner 2026-10-27).
  it('gives back a later-dated debt the sale took from, less what it took', () => {
    const log = [
      debt('d1', { worker: NAT, kind: 'fertilizer', amountSatang: 735000, date: '2026-10-27', lender: null, fertilizer: { totalSatang: 1470000, workerPct: 50 } }),
      pay('s1', { worker: NAT, amountSatang: 332500, date: '2026-10-13', method: 'buyer-split', saleId: 'sale-13' }),
    ];
    const acc = projectDebts(log).get(NAT.id)!;
    expect(balanceAfterSale(acc, 'sale-13', '2026-10-13')).toBe(402500);
  });

  it('counts an expense-share debt the same way', () => {
    const share = { billSatang: 1470000, discountSatang: 0, totalSacks: null, lines: [{ worker: NAT, sacks: null, workerPct: 50, settle: 'debt' as const }] };
    const log = [
      ev('x1', { t: 'expense_created', fields: { amountSatang: 1470000, date: '2026-10-27', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: '', note: '', payer: FARM, share } }),
      pay('s1', { worker: NAT, amountSatang: 332500, date: '2026-10-13', method: 'buyer-split', saleId: 'sale-13' }),
    ];
    const acc = projectDebts(log).get(NAT.id)!;
    expect(acc.balanceSatang).toBe(402500);
    expect(balanceAfterSale(acc, 'sale-13', '2026-10-13')).toBe(402500);
  });

  it('gives back later-dated debts oldest first, only as far as the sale took from them', () => {
    const log = [
      debt('d2', { worker: NAT, amountSatang: 200000, date: '2026-10-30' }),
      debt('d1', { worker: NAT, amountSatang: 100000, date: '2026-10-20' }),
      pay('s1', { worker: NAT, amountSatang: 150000, date: '2026-10-13', method: 'cash-from-share', saleId: 'sale-13' }),
    ];
    const acc = projectDebts(log).get(NAT.id)!;
    // took all 1,000 of d1 (20 Oct) and 500 of d2 (30 Oct): 1,500 of d2 is left
    expect(balanceAfterSale(acc, 'sale-13', '2026-10-13')).toBe(150000);
  });

  it('does not depend on the order things were recorded in (ts is untrusted)', () => {
    const log = [
      pay('s1', { worker: NAT, amountSatang: 332500, date: '2026-10-13', method: 'buyer-split', saleId: 'sale-13' }),
      debt('d1', { worker: NAT, kind: 'fertilizer', amountSatang: 735000, date: '2026-10-27', lender: null, fertilizer: { totalSatang: 1470000, workerPct: 50 } }),
    ];
    expect(balanceAfterSale(projectDebts(log).get(NAT.id)!, 'sale-13', '2026-10-13')).toBe(402500);
  });

  it('still leaves out a debt dated after the sale when the sale did not need it (F9)', () => {
    const log = [
      debt('d1', { worker: NAT, amountSatang: 500000, date: '2026-09-01' }),
      pay('s1', { worker: NAT, amountSatang: 100000, date: '2026-10-13', method: 'cash-from-share', saleId: 'sale-13' }),
      debt('d2', { worker: NAT, amountSatang: 70000, date: '2026-10-20' }),
    ];
    const acc = projectDebts(log).get(NAT.id)!;
    expect(balanceAfterSale(acc, 'sale-13', '2026-10-13')).toBe(400000);
  });
});
