import { describe, expect, it } from 'vitest';

import {
  cashNotes,
  deductionCap,
  needsChange,
  nettingPayloads,
  pilesCheck,
  proposeDeduction,
  roundCash,
  workerCash,
} from './deduct';
import { projectDebts } from './debts';
import { projectFinance } from './ledger';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload, type Payer } from './types';

const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };

describe('cap and proposal (D-18, D-59, D-67)', () => {
  it('debt above the share → deduct the share, cash 0, rest carried', () => {
    expect(deductionCap({ balanceSatang: 500000, shareSatang: 286000, nettingSatang: 0 })).toBe(286000);
    expect(proposeDeduction({ balanceSatang: 500000, planPerSaleSatang: null, shareSatang: 286000, nettingSatang: 0 })).toBe(286000);
    expect(workerCash({ shareSatang: 286000, deductionSatang: 286000, nettingSatang: 0, adjustSatang: 0 })).toBe(0);
  });

  it('with a plan → propose the instalment; without → the whole balance', () => {
    expect(proposeDeduction({ balanceSatang: 300000, planPerSaleSatang: 200000, shareSatang: 286000, nettingSatang: 0 })).toBe(200000);
    expect(proposeDeduction({ balanceSatang: 150000, planPerSaleSatang: null, shareSatang: 286000, nettingSatang: 0 })).toBe(150000);
    expect(proposeDeduction({ balanceSatang: 100000, planPerSaleSatang: 200000, shareSatang: 286000, nettingSatang: 0 })).toBe(100000);
  });

  it('netting raises the cap to share + what the farm repays now', () => {
    expect(deductionCap({ balanceSatang: 150000, shareSatang: 86000, nettingSatang: 64000 })).toBe(150000);
    expect(deductionCap({ balanceSatang: 500000, shareSatang: 86000, nettingSatang: 64000 })).toBe(150000);
  });

  it('nothing owed or nothing earned → cap 0', () => {
    expect(deductionCap({ balanceSatang: -5000, shareSatang: 1000, nettingSatang: 0 })).toBe(0);
    expect(deductionCap({ balanceSatang: 5000, shareSatang: 0, nettingSatang: 0 })).toBe(0);
  });
});

describe('rounding after the deduction (D-60, E05-S02)', () => {
  it.each([
    ['worker', 85050, 85100, 50],
    ['owner', 85050, 85000, -50],
    ['none', 85050, 85050, 0],
    ['worker', 85000, 85000, 0],
  ] as const)('%s: %i → %i (adjust %i)', (mode, cash, rounded, adjust) => {
    expect(roundCash(cash, mode)).toEqual({ cashSatang: rounded, adjustSatang: adjust });
  });

  it('share → deduct → round → cash, never below zero', () => {
    const share = 286050;
    const deduct = 200000;
    const r = roundCash(share - deduct, 'owner');
    expect(r).toEqual({ cashSatang: 86000, adjustSatang: -50 });
    expect(workerCash({ shareSatang: share, deductionSatang: deduct, nettingSatang: 0, adjustSatang: r.adjustSatang })).toBe(86000);
  });
});

describe('cash from the share: does it need change? (D-71 route 1)', () => {
  it('the buyer pays the largest notes first', () => {
    expect(cashNotes(286000)).toEqual([100000, 100000, 50000, 10000, 10000, 10000, 5000, 1000]);
    expect(cashNotes(105000)).toEqual([100000, 5000]);
  });

  it.each([
    [286000, 50000, false],
    [286000, 30000, false],
    [105000, 3000, true],
    [286000, 286000, false],
    [100050, 50, false],
    [100000, 50, true],
  ])('pile %i, take %i → needs change %s', (pile, take, out) => {
    expect(needsChange(pile, take)).toBe(out);
  });
});

describe('piles add up to the sale, to the satang (D-72)', () => {
  it('matching piles pass; a gap is reported', () => {
    expect(pilesCheck([{ satang: 86000 }, { satang: 200000 }, { satang: 714000 }], 1000000)).toEqual({ sumSatang: 1000000, diffSatang: 0, ok: true });
    expect(pilesCheck([{ satang: 86000 }, { satang: 714000 }], 1000000)).toEqual({ sumSatang: 800000, diffSatang: -200000, ok: false });
  });
});

describe('netting (D-60): one repayment naming the sale + one debt payment, kept apart', () => {
  let n = 0;
  const ev = (targetId: string, payload: FinancePayload): FinanceEvent => {
    n += 1;
    return { id: `n${n}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: null, payload };
  };

  it('uses part of what the farm owes, oldest first; both ledgers move by the same amount', () => {
    const base = [
      ev('x1', { t: 'expense_created', fields: { amountSatang: 64000, date: '2026-09-28', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: NAT } }),
      ev('b1', { t: 'debt_added', fields: { worker: NAT, kind: 'fertilizer', amountSatang: 150000, date: '2026-09-20', note: '', lender: FARM, fertilizer: { totalSatang: 300000, workerPct: 50 }, carriedForward: false } }),
    ];
    const s = projectFinance(base);
    const p = nettingPayloads({ worker: NAT, farm: FARM, owed: s.reimbursements, amountSatang: 40000, saleId: 's-3oct', date: '2026-10-03', repaymentId: 'rp' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const after = [...base, ev('rp', p.repayment), ev('dp', p.debtPayment)];
    const s2 = projectFinance(after);
    expect(s2.reimbursements[0]).toMatchObject({ remainingSatang: 24000, status: 'partial' });
    expect(s2.repayments[0]).toMatchObject({ saleId: 's-3oct', from: FARM, to: NAT, amountSatang: 40000 });
    expect(projectDebts(after).get(NAT.id)!.payments[0].repaymentId).toBe('rp');
    const a = projectDebts(after).get(NAT.id)!;
    expect(a.summary.deducted.netting).toBe(40000);
    expect(a.balanceSatang).toBe(110000);
  });

  it('a deleted sale voids its netting on both sides; restoring brings it back', () => {
    const base = [
      ev('x9', { t: 'expense_created', fields: { amountSatang: 64000, date: '2026-09-28', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: NAT } }),
      ev('b9', { t: 'debt_added', fields: { worker: NAT, kind: 'loan', amountSatang: 100000, date: '2026-09-20', note: '', lender: FARM, fertilizer: null, carriedForward: false } }),
    ];
    const p = nettingPayloads({ worker: NAT, farm: FARM, owed: projectFinance(base).reimbursements, amountSatang: 64000, saleId: 's-gone', date: '2026-10-03', repaymentId: 'rp9' });
    if (!p.ok) throw new Error('plan');
    const all = [...base, ev('rp9', p.repayment), ev('dp9', p.debtPayment)];
    const gone = (id: string) => id !== 's-gone';
    expect(projectFinance(all, gone).reimbursements[0].remainingSatang).toBe(64000);
    expect(projectDebts(all, gone).get(NAT.id)!.balanceSatang).toBe(100000);
    expect(projectFinance(all).reimbursements[0].remainingSatang).toBe(0);
  });

  it('refuses more than the farm owes', () => {
    const p = nettingPayloads({ worker: NAT, farm: FARM, owed: [], amountSatang: 1, saleId: 's', date: '2026-10-03', repaymentId: 'rp' });
    expect(p.ok).toBe(false);
  });
});
