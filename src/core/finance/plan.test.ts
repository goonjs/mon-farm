import { describe, expect, it } from 'vitest';

import { isDerivedExpense, payableSatang, projectFinance, stageTotals } from './ledger';
import {
  aidByWorker,
  cashflow,
  checkTrip,
  leaseIncome,
  projectPlan,
  rubberIncome,
} from './plan';
import { isIsoDate, isMonth } from './money';
import { FARM_FUNDS, type ExpenseFields, type FinanceEvent, type FinancePayload, type Payer } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null, device = 'dev-a'): FinanceEvent {
  n += 1;
  return { id: `p${String(n).padStart(4, '0')}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: device }, source: 'app', targetId, baseEventId: base, payload };
}

const OWNER: Payer = { id: 'p-owner', name: 'เจ้าของสวน' };
const SOMWANG: Payer = { id: 'p-somwang', name: 'อาจารย์สมหวัง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };

const salary = () => ev('salary-1', { t: 'salary_set', rule: { recipient: SOMWANG, payer: OWNER, amountSatang: 1_500_000, startMonth: '2026-09', dueDay: 28 } });

function expense(id: string, over: Partial<ExpenseFields>) {
  return ev(id, {
    t: 'expense_created',
    fields: { amountSatang: 1000, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: FARM, ...over },
  });
}

describe('E11-S04 manager salary', () => {
  it('each month up to next month is a committed salary expense; paid → actual', () => {
    const s = salary();
    let st = projectFinance([s], undefined, '2026-10');
    const months = st.expenses.filter((x) => x.id.startsWith('salary-1:'));
    expect(months.map((x) => [x.id, x.stage, x.amountSatang, x.date])).toEqual([
      ['salary-1:2026-09', 'committed', 1_500_000, '2026-09-28'],
      ['salary-1:2026-10', 'committed', 1_500_000, '2026-10-28'],
      ['salary-1:2026-11', 'committed', 1_500_000, '2026-11-28'],
    ]);
    const paid = ev('salary-1:2026-09', { t: 'salary_paid', month: '2026-09', amountSatang: 1_500_000, date: '2026-09-28' });
    st = projectFinance([s, paid], undefined, '2026-10');
    expect(st.expenses.find((x) => x.id === 'salary-1:2026-09')?.stage).toBe('actual');
    expect(isDerivedExpense('salary-1:2026-09')).toBe(true);
  });

  it('paid by the owner: the farm owes the owner, shown apart from what it owes the manager', () => {
    const s = salary();
    const paid = ev('salary-1:2026-09', { t: 'salary_paid', month: '2026-09', amountSatang: 1_500_000, date: '2026-09-28' });
    const repair = expense('x1', { payer: SOMWANG, amountSatang: 40000 });
    const st = projectFinance([s, paid, repair], undefined, '2026-09');
    // Two separate debts, to two different people — never one blended figure (FIN-5).
    expect(st.reimbursements.map((r) => [r.to.id, r.expenseId])).toEqual([
      ['p-somwang', 'x1'],
      ['p-owner', 'salary-1:2026-09'],
    ]);
  });

  it('tapping paid on two devices counts once', () => {
    const s = salary();
    const a = ev('salary-1:2026-09', { t: 'salary_paid', month: '2026-09', amountSatang: 1_500_000, date: '2026-09-28' }, null, 'dev-a');
    const b = ev('salary-1:2026-09', { t: 'salary_paid', month: '2026-09', amountSatang: 1_500_000, date: '2026-09-28' }, null, 'dev-b');
    const st = projectFinance([s, a, b], undefined, '2026-09');
    expect(stageTotals(st.expenses).actual).toBe(1_500_000);
  });

  it('a new amount applies from the chosen month and never rewrites a paid month', () => {
    const s = salary();
    const paid = ev('salary-1:2026-09', { t: 'salary_paid', month: '2026-09', amountSatang: 1_500_000, date: '2026-09-28' });
    const raise = ev('salary-1', { t: 'salary_amount_set', fromMonth: '2026-09', amountSatang: 1_800_000 });
    const st = projectFinance([s, paid, raise], undefined, '2026-10');
    expect(st.expenses.find((x) => x.id === 'salary-1:2026-09')?.amountSatang).toBe(1_500_000);
    expect(st.expenses.find((x) => x.id === 'salary-1:2026-10')?.amountSatang).toBe(1_800_000);
  });

  it('without an as-of month no salary months are made', () => {
    expect(projectFinance([salary()]).expenses).toEqual([]);
  });

  it('upcoming salary is part of "to pay"', () => {
    expect(payableSatang(projectFinance([salary()], undefined, '2026-09'))).toBe(3_000_000);
  });
});

describe('review fixes', () => {
  it('#1 an invalid start month never hangs; the rule is ignored', () => {
    const bad = ev('salary-9', { t: 'salary_set', rule: { recipient: SOMWANG, payer: OWNER, amountSatang: 100, startMonth: '2025-13', dueDay: 1 } });
    expect(projectFinance([bad], undefined, '2027-01').expenses).toEqual([]);
    expect(isMonth('2025-13')).toBe(false);
    expect(isMonth('2025-12')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });

  it('#2 rubber income is dated by the local calendar day', () => {
    const ts = new Date(2026, 9, 1, 0, 30).getTime(); // 1 Oct 00:30 local
    expect(rubberIncome([{ saleId: 's', startedTs: ts, status: 'closed', ownerSatang: 1, deleted: false }])[0].date).toBe('2026-10-01');
  });

  it('#3 rent received against a lease replaces that month’s expected rent', () => {
    const lease = ev('lease-9', { t: 'lease_added', fields: { farmName: 'A', tenant: 'T', rentSatang: 100_000_000, period: 'year', start: '2026-01-15', end: null, sharePct: 0, note: '' } });
    const got = ev('inc-9', { t: 'income_recorded', fields: { amountSatang: 100_000_000, date: '2026-01-20', stage: 'actual', leaseId: 'lease-9', note: '', tag: null } });
    const rows = cashflow({ state: projectFinance([lease, got]), plan: projectPlan([lease, got]), rubber: [], fromMonth: '2026-01', toMonth: '2026-01' });
    expect(rows[0]).toMatchObject({ inActual: 100_000_000, inPlanned: 0, netAll: 100_000_000 });
  });

  it('#4 salary months reach as far as asked (the cashflow horizon)', () => {
    const st = projectFinance([salary()], undefined, '2026-12');
    expect(st.expenses.map((x) => x.id).at(-1)).toBe('salary-1:2027-01');
  });

  it('#5 an expense moved out of worker aid no longer counts for the worker', () => {
    const a = expense('a9', { categoryId: 'cat-worker-aid', worker: NAT, aidKind: 'food', amountSatang: 100, date: '2026-09-05' });
    const moved = ev('a9', { t: 'expense_changed', patch: { categoryId: 'cat-other', worker: null, aidKind: null } }, a.id);
    expect(aidByWorker(projectFinance([a, moved]), '2026-01-01', '2026-12-31')).toEqual([]);
    const stillTagged = ev('a9', { t: 'expense_changed', patch: { categoryId: 'cat-other' } }, a.id);
    expect(aidByWorker(projectFinance([a, stillTagged]), '2026-01-01', '2026-12-31')).toEqual([]);
  });

  it('#6 unknown start or unknown share flags months; closed sales without an amount flag theirs', () => {
    const noStart = ev('lease-a', { t: 'lease_added', fields: { farmName: 'A', tenant: '', rentSatang: 1, period: 'year', start: null, end: null, sharePct: 0, note: '' } });
    expect(leaseIncome(projectPlan([noStart]).leases, '2026-01', '2026-02').incompleteMonths).toEqual(['2026-01', '2026-02']);
    const noShare = ev('lease-b', { t: 'lease_added', fields: { farmName: 'B', tenant: '', rentSatang: 1, period: 'year', start: '2026-02-01', end: null, sharePct: null, note: '' } });
    expect(leaseIncome(projectPlan([noShare]).leases, '2026-01', '2026-02').incompleteMonths).toEqual(['2026-02']);
    const rows = cashflow({ state: projectFinance([]), plan: projectPlan([]), rubber: [], rubberUnknown: ['2026-03-05'], fromMonth: '2026-03', toMonth: '2026-03' });
    expect(rows[0].incomplete).toBe(true);
  });
});

describe('E11-S05 worker special payments', () => {
  it('per worker and per period; a non-farm payer is owed it back', () => {
    const a = expense('a1', { categoryId: 'cat-worker-aid', worker: NAT, aidKind: 'accident', amountSatang: 200000, date: '2026-09-05', payer: OWNER });
    const b = expense('a2', { categoryId: 'cat-worker-aid', worker: NAT, aidKind: 'food', amountSatang: 30000, date: '2026-10-05' });
    const st = projectFinance([a, b]);
    expect(aidByWorker(st, '2026-09-01', '2026-09-30')).toEqual([{ worker: NAT, totalSatang: 200000, ids: ['a1'] }]);
    expect(aidByWorker(st, '2026-09-01', '2026-10-31')[0].totalSatang).toBe(230000);
    expect(st.reimbursements.map((r) => r.expenseId)).toEqual(['a1']);
  });
});

describe('E11-S06 trips', () => {
  const trip = (split: { farmId: string; satang: number }[] | null) => ({
    from: 'บ้าน',
    to: 'สวน',
    purposes: ['ตรวจสวน', 'ซื้อปุ๋ย'],
    farms: [
      { id: 'f1', name: 'สวน 1' },
      { id: 'f2', name: 'สวน 2' },
    ],
    lines: [
      { kind: 'fuel' as const, satang: 80000 },
      { kind: 'toll' as const, satang: 12000 },
    ],
    split,
  });

  it('the amount is the sum of its lines; unsplit is fine; a split must add up', () => {
    expect(checkTrip(trip(null), 92000)).toEqual([]);
    expect(checkTrip(trip(null), 90000)).toEqual(['lines-total']);
    expect(checkTrip(trip([{ farmId: 'f1', satang: 46000 }, { farmId: 'f2', satang: 46000 }]), 92000)).toEqual([]);
    expect(checkTrip(trip([{ farmId: 'f1', satang: 46000 }]), 92000)).toEqual(['split-total']);
  });
});

describe('E11-S07 income and leases', () => {
  it('rubber income is the owner share of closed sales, linked to the sale', () => {
    const rows = [
      { saleId: 's1', startedTs: Date.UTC(2026, 9, 3), status: 'closed' as const, ownerSatang: 14936725, deleted: false },
      { saleId: 's2', startedTs: Date.UTC(2026, 9, 5), status: 'open' as const, ownerSatang: 100, deleted: false },
      { saleId: 's3', startedTs: Date.UTC(2026, 9, 6), status: 'closed' as const, ownerSatang: 100, deleted: true },
    ];
    expect(rubberIncome(rows)).toEqual([{ saleId: 's1', date: '2026-10-03', satang: 14936725 }]);
  });

  it('a yearly lease expects its rent each year from the start; unknown rent is flagged, never zero', () => {
    const known = ev('lease-1', {
      t: 'lease_added',
      fields: { farmName: 'สวน A', tenant: 'ผู้เช่า', rentSatang: 100_000_000, period: 'year', start: '2026-01-15', end: null, sharePct: null, note: '' },
    });
    const unknown = ev('lease-2', {
      t: 'lease_added',
      fields: { farmName: 'สวน B', tenant: '', rentSatang: null, period: null, start: '2029-01-01', end: null, sharePct: null, note: 'คาดว่าเริ่ม 2029' },
    });
    const plan = projectPlan([known, unknown]);
    expect(plan.leases.map((l) => l.id)).toEqual(['lease-1', 'lease-2']);
    const inc = leaseIncome(plan.leases, '2026-01', '2027-12');
    expect(inc.expected.map((e) => [e.month, e.satang])).toEqual([
      ['2026-01', 100_000_000],
      ['2027-01', 100_000_000],
    ]);
    expect(leaseIncome(plan.leases, '2029-01', '2029-03').incompleteMonths).toEqual(['2029-01', '2029-02', '2029-03']);
  });

  it('received income is separate from expected, tagged for its intended use', () => {
    const r = ev('inc-1', { t: 'income_recorded', fields: { amountSatang: 100_000_000, date: '2026-01-20', stage: 'actual', leaseId: 'lease-1', note: '', tag: 'reserve' } });
    const plan = projectPlan([r]);
    expect(plan.incomes[0]).toMatchObject({ stage: 'actual', tag: 'reserve', leaseId: 'lease-1' });
  });
});

describe('E11-S08 cashflow and reserve', () => {
  it('monthly in/out/net by stage, every figure traceable, incomplete months flagged', () => {
    const events = [
      expense('x1', { amountSatang: 64000, date: '2026-09-28' }),
      expense('x2', { amountSatang: 1_500_000, date: '2026-10-31', stage: 'committed' }),
      expense('x3', { amountSatang: null, date: '2026-11-15', stage: 'planned' }),
      ev('inc-1', { t: 'income_recorded', fields: { amountSatang: 500000, date: '2026-09-10', stage: 'actual', leaseId: null, note: '', tag: null } }),
    ];
    const st = projectFinance(events);
    const plan = projectPlan(events);
    const rows = cashflow({
      state: st,
      plan,
      rubber: [{ saleId: 's1', date: '2026-10-03', satang: 14936725 }],
      fromMonth: '2026-09',
      toMonth: '2026-11',
    });
    expect(rows.map((r) => [r.month, r.inActual, r.outActual, r.outCommitted, r.outPlanned, r.netActual, r.incomplete])).toEqual([
      ['2026-09', 500000, 64000, 0, 0, 436000, false],
      ['2026-10', 14936725, 0, 1_500_000, 0, 14936725, false],
      ['2026-11', 0, 0, 0, 0, 0, true],
    ]);
    expect([...rows[0].sources].sort()).toEqual(['inc-1', 'x1']);
    expect([...rows[1].sources].sort()).toEqual(['s1', 'x2']);
  });

  it('the reserve is the owner’s figure with its assumption and source', () => {
    const r1 = ev('reserve', { t: 'reserve_set', amountSatang: 50_000_000, assumption: '6 เดือนของค่าใช้จ่าย', source: 'บัญชีออม' });
    const r2 = ev('reserve', { t: 'reserve_set', amountSatang: 60_000_000, assumption: 'ปรับ', source: 'บัญชีออม' }, r1.id);
    expect(projectPlan([r1, r2]).reserve).toMatchObject({ amountSatang: 60_000_000, assumption: 'ปรับ', source: 'บัญชีออม' });
    expect(projectPlan([]).reserve).toBeNull();
  });
});
