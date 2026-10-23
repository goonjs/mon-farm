import { describe, expect, it } from 'vitest';

import { projectDebts } from './debts';
import { projectFinance, stageTotals } from './ledger';
import { checkShare, fertOptionId, lastLineSacks, splitShare, SHARE_DEBT_INFIX } from './share';
import { FARM_FUNDS, type ExpenseFields, type ExpenseShare, type FinanceEvent, type FinancePayload, type Payer } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent {
  n += 1;
  return {
    id: `s${String(n).padStart(4, '0')}`,
    groupId: 'group-1',
    deviceSeq: n,
    ts: n,
    actor: { userId: 'u', deviceId: 'dev-a' },
    source: 'app',
    targetId,
    baseEventId: base,
    payload,
  };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };

/** 10 sacks, 10,000.00 less 500.00; แดง 6 on debt, นัด 4 paid — both 50%. */
const FERT: ExpenseShare = {
  billSatang: 1_000_000,
  discountSatang: 50_000,
  totalSacks: 10,
  lines: [
    { worker: DAENG, sacks: 6, workerPct: 50, settle: 'debt' },
    { worker: NAT, sacks: 4, workerPct: 50, settle: 'paid' },
  ],
};

function expense(share: ExpenseShare | null, over: Partial<ExpenseFields> = {}): ExpenseFields {
  return {
    amountSatang: share ? share.billSatang - share.discountSatang : 0,
    date: '2026-10-14',
    stage: 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: '',
    note: '',
    payer: FARM,
    share,
    ...over,
  };
}

describe('splitShare — by sacks', () => {
  it('splits the net bill by sacks, then each cost by the worker %', () => {
    const s = splitShare(FERT);
    expect(s.netSatang).toBe(950_000);
    expect(s.lines.map((l) => [l.costSatang, l.workerSatang, l.ownerSatang])).toEqual([
      [570_000, 285_000, 285_000],
      [380_000, 190_000, 190_000],
    ]);
    expect(s.leftoverSacks).toBe(0);
    expect(s.leftoverSatang).toBe(0);
    expect(s.workerTotalSatang + s.ownerTotalSatang).toBe(950_000);
  });

  it('leftover sacks are the farm’s cost', () => {
    const s = splitShare({ ...FERT, lines: [{ ...FERT.lines[0], sacks: 4 }, FERT.lines[1]] });
    expect(s.lines.map((l) => l.costSatang)).toEqual([380_000, 380_000]);
    expect(s.leftoverSacks).toBe(2);
    expect(s.leftoverSatang).toBe(190_000);
    expect(s.ownerTotalSatang).toBe(190_000 + 190_000 + 190_000);
    expect(s.workerTotalSatang + s.ownerTotalSatang).toBe(950_000);
  });

  it('odd satang: the parts always add up to the net bill', () => {
    const s = splitShare({
      billSatang: 100,
      discountSatang: 0,
      totalSacks: 3,
      lines: [
        { worker: DAENG, sacks: 1, workerPct: 33, settle: 'debt' },
        { worker: NAT, sacks: 1, workerPct: 50, settle: 'debt' },
      ],
    });
    const costs = s.lines.map((l) => l.costSatang);
    expect(costs.reduce((a, b) => a + b, 0) + s.leftoverSatang).toBe(100);
    expect(s.workerTotalSatang + s.ownerTotalSatang).toBe(100);
    for (const l of s.lines) expect(l.workerSatang + l.ownerSatang).toBe(l.costSatang);
  });

  it('0% and 100%', () => {
    const s = splitShare({ ...FERT, lines: [{ ...FERT.lines[0], workerPct: 0 }, { ...FERT.lines[1], workerPct: 100 }] });
    expect(s.lines.map((l) => l.workerSatang)).toEqual([0, 380_000]);
  });

  it('a discount equal to the bill leaves nothing to share', () => {
    const s = splitShare({ ...FERT, discountSatang: 1_000_000 });
    expect(s.lines.every((l) => l.costSatang === 0 && l.workerSatang === 0)).toBe(true);
  });
});

describe('splitShare — one tapper, no sacks (general category)', () => {
  it('the whole net bill is the cost; odd satang goes to the tapper, half-up', () => {
    const s = splitShare({ billSatang: 125_025, discountSatang: 10_000, totalSacks: null, lines: [{ worker: DAENG, sacks: null, workerPct: 50, settle: 'debt' }] });
    expect(s.lines[0]).toMatchObject({ costSatang: 115_025, workerSatang: 57_513, ownerSatang: 57_512 });
  });
});

describe('checkShare', () => {
  it('accepts the fertilizer example', () => {
    expect(checkShare(FERT)).toEqual([]);
  });
  it('refuses a discount above the bill', () => {
    expect(checkShare({ ...FERT, discountSatang: 1_000_001 })).toContain('discount-over');
  });
  it('refuses more sacks than bought, and parts of a sack', () => {
    expect(checkShare({ ...FERT, lines: [{ ...FERT.lines[0], sacks: 7 }, FERT.lines[1]] })).toContain('sacks-over');
    expect(checkShare({ ...FERT, lines: [{ ...FERT.lines[0], sacks: 5.5 }, FERT.lines[1]] })).toContain('sacks-not-whole');
    expect(checkShare({ ...FERT, totalSacks: 9.5 })).toContain('sacks-not-whole');
  });
  it('refuses a % that is not a whole 0–100', () => {
    expect(checkShare({ ...FERT, lines: [{ ...FERT.lines[0], workerPct: 101 }, FERT.lines[1]] })).toContain('pct-invalid');
  });
  it('one line per tapper', () => {
    expect(checkShare({ ...FERT, lines: [FERT.lines[0], { ...FERT.lines[1], worker: DAENG }] })).toContain('worker-twice');
  });
  it('without sacks, only one tapper', () => {
    expect(checkShare({ ...FERT, totalSacks: null, lines: FERT.lines.map((l) => ({ ...l, sacks: null })) })).toContain('one-tapper-only');
  });
});

describe('lastLineSacks', () => {
  it('fills the last tapper with what is left', () => {
    expect(lastLineSacks(10, [6])).toBe(4);
    expect(lastLineSacks(10, [6, 5])).toBe(0);
  });
});

describe('expense with a share → worker debts', () => {
  const debtId = `x1${SHARE_DEBT_INFIX}${DAENG.id}`;

  it('an actual expense makes a debt for each “ลงหนี้” line, linked to the expense', () => {
    const accounts = projectDebts([ev('x1', { t: 'expense_created', fields: expense(FERT) })]);
    expect(accounts.get(DAENG.id)?.balanceSatang).toBe(285_000);
    expect(accounts.get(DAENG.id)?.debts[0]).toMatchObject({ id: debtId, kind: 'fertilizer', expenseId: 'x1', amountSatang: 285_000 });
    expect(accounts.get(NAT.id)).toBeUndefined();
  });

  it('planned or committed makes no debt; moving to actual does', () => {
    const create = ev('x1', { t: 'expense_created', fields: expense(FERT, { stage: 'planned' }) });
    expect(projectDebts([create]).size).toBe(0);
    const actual = ev('x1', { t: 'expense_changed', patch: { stage: 'actual' } }, create.id);
    expect(projectDebts([create, actual]).get(DAENG.id)?.balanceSatang).toBe(285_000);
  });

  it('counts the expense once: actual total is the net bill, no extra owner-share expense', () => {
    const state = projectFinance([ev('x1', { t: 'expense_created', fields: expense(FERT) })]);
    expect(state.expenses).toHaveLength(1);
    expect(stageTotals(state.expenses).actual).toBe(950_000);
  });

  it('editing the share moves the debt; delete voids it; restore brings it back', () => {
    const create = ev('x1', { t: 'expense_created', fields: expense(FERT) });
    const edit = ev('x1', { t: 'expense_changed', patch: { share: { ...FERT, lines: [{ ...FERT.lines[0], workerPct: 100 }, FERT.lines[1]] } } }, create.id);
    expect(projectDebts([create, edit]).get(DAENG.id)?.balanceSatang).toBe(570_000);
    const del = ev('x1', { t: 'expense_changed', patch: { deleted: true } }, edit.id);
    const acc = projectDebts([create, edit, del]).get(DAENG.id);
    expect(acc?.balanceSatang).toBe(0);
    expect(acc?.debts[0].deleted).toBe(true);
    const back = ev('x1', { t: 'expense_changed', patch: { deleted: false } }, del.id);
    expect(projectDebts([create, edit, del, back]).get(DAENG.id)?.balanceSatang).toBe(570_000);
  });

  it('a debt already deducted that the edit lowers shows as overpaid, not silently changed', () => {
    const create = ev('x1', { t: 'expense_created', fields: expense(FERT) });
    const paid = ev('pay1', {
      t: 'debt_payment_recorded',
      fields: { worker: DAENG, creditor: FARM, amountSatang: 285_000, date: '2026-10-20', note: '', method: 'cash-from-share', saleId: 'sale-1' },
    });
    const lower = ev('x1', { t: 'expense_changed', patch: { share: { ...FERT, lines: [{ ...FERT.lines[0], workerPct: 0 }, FERT.lines[1]] } } }, create.id);
    const acc = projectDebts([create, paid, lower]).get(DAENG.id);
    expect(acc?.balanceSatang).toBe(-285_000);
    expect(acc?.overpaid).toBe(true);
  });

  it('a share edited on two devices at once is a conflict', () => {
    const create = ev('x1', { t: 'expense_created', fields: expense(FERT) });
    const a = ev('x1', { t: 'expense_changed', patch: { share: { ...FERT, lines: [{ ...FERT.lines[0], workerPct: 40 }, FERT.lines[1]] } } }, create.id);
    const b = ev('x1', { t: 'expense_changed', patch: { share: { ...FERT, lines: [{ ...FERT.lines[0], workerPct: 60 }, FERT.lines[1]] } } }, create.id);
    const x = projectFinance([create, a, b]).expenses[0];
    expect(x.conflicts.map((c) => c.field)).toContain('share');
    // Until resolved, the value from before the fork counts — and only once.
    expect(projectDebts([create, a, b]).get(DAENG.id)?.balanceSatang).toBe(285_000);
  });

  it('syncing the same events twice makes one debt', () => {
    const create = ev('x1', { t: 'expense_created', fields: expense(FERT) });
    expect(projectDebts([create, create]).get(DAENG.id)?.debts).toHaveLength(1);
  });
});

describe('who paid first', () => {
  it('a tapper who paid the whole bill is owed it back, apart from their own debt', () => {
    const evs = [ev('x1', { t: 'expense_created', fields: expense(FERT, { payer: DAENG }) })];
    expect(projectFinance(evs).reimbursements[0]).toMatchObject({ to: DAENG, originalSatang: 950_000 });
    expect(projectDebts(evs).get(DAENG.id)?.balanceSatang).toBe(285_000);
  });
});

describe('category share % and saved fertilizer options', () => {
  it('a category carries its default tapper %; null turns sharing off', () => {
    const on = ev('cat-fertilizer', { t: 'category_share_set', workerPct: 50 });
    expect(projectFinance([on]).categories.find((c) => c.id === 'cat-fertilizer')?.workerPct).toBe(50);
    const off = ev('cat-fertilizer', { t: 'category_share_set', workerPct: null }, on.id);
    expect(projectFinance([on, off]).categories.find((c) => c.id === 'cat-fertilizer')?.workerPct).toBeNull();
    expect(projectFinance([]).categories.find((c) => c.id === 'cat-repair')?.workerPct).toBeNull();
  });

  it('options are keyed by normalised name, so two devices adding one name give one option', () => {
    const a = ev(fertOptionId('reason', ' ใบเหลือง '), { t: 'fert_option_set', kind: 'reason', name: 'ใบเหลือง', description: '', hidden: false });
    const b = ev(fertOptionId('reason', 'ใบเหลือง'), { t: 'fert_option_set', kind: 'reason', name: 'ใบเหลือง', description: 'ขาดไนโตรเจน', hidden: false });
    const opts = projectFinance([a, b]).fertOptions.filter((o) => o.kind === 'reason');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ id: a.targetId, name: 'ใบเหลือง' });
  });

  it('a later change (edit, hide) wins along its chain', () => {
    const a = ev(fertOptionId('brand', 'ตราใบไม้'), { t: 'fert_option_set', kind: 'brand', name: 'ตราใบไม้', description: '', hidden: false });
    const hide = ev(a.targetId, { t: 'fert_option_set', kind: 'brand', name: 'ตราใบไม้', description: '', hidden: true }, a.id);
    expect(projectFinance([a, hide]).fertOptions[0].hidden).toBe(true);
  });
});
