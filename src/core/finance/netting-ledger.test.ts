import { describe, expect, it } from 'vitest';

import { projectDebts } from './debts';
import { nettingPayloads } from './deduct';
import { owedByPerson, projectFinance } from './ledger';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload, type Payer } from './types';

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const SALE = 'sale-1';

let n = 0;
const ev = (targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent => {
  n += 1;
  return { id: `n${String(n).padStart(4, '0')}`, deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'dev-a' }, source: 'app', targetId, baseEventId: base, payload };
};

/** นัด owes the farm ฿3,000 and the farm owes นัด ฿640. */
const base = () => [
  ev('debt-nat', { t: 'debt_added', fields: { worker: NAT, kind: 'loan', amountSatang: 300_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } }),
  ev('exp-nat', { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-09-28', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: NAT } }),
];

const cash = (id: string, amountSatang: number, saleId = SALE) =>
  ev(id, { t: 'debt_payment_recorded', fields: { worker: NAT, creditor: FARM, amountSatang, date: '2026-10-11', note: '', method: 'cash-from-share', saleId } });

function netting(events: readonly FinanceEvent[], amountSatang: number, id: string) {
  const owed = projectFinance(events).reimbursements;
  const plan = nettingPayloads({ worker: NAT, farm: FARM, owed, amountSatang, saleId: SALE, date: '2026-10-11', repaymentId: `rep-${id}` });
  if (!plan.ok) throw new Error('netting refused');
  return { payment: ev(`dpay-${id}`, plan.debtPayment), repayment: ev(`rep-${id}`, plan.repayment) };
}

const balance = (events: readonly FinanceEvent[], counts?: (s: string) => boolean) => projectDebts(events, counts).get(NAT.id)!.balanceSatang;
const farmOwes = (events: readonly FinanceEvent[], counts?: (s: string) => boolean) => owedByPerson(projectFinance(events, counts)).find((o) => o.payer.id === NAT.id)?.remainingSatang ?? 0;

describe('a netting payment counts only with its repayment (the two are separate events)', () => {
  it('both written: the debt falls and the farm owes less', () => {
    const b = base();
    const { payment, repayment } = netting(b, 40_000, 'a');
    const all = [...b, payment, repayment];
    expect(balance(all)).toBe(260_000);
    expect(farmOwes(all)).toBe(24_000);
  });

  it('a write that stopped after the debt payment changes nothing', () => {
    const b = base();
    const { payment } = netting(b, 40_000, 'a');
    expect(balance([...b, payment])).toBe(300_000);
    expect(farmOwes([...b, payment])).toBe(64_000);
  });

  it('an undo that stopped after voiding the repayment changes nothing either', () => {
    const b = base();
    const { payment, repayment } = netting(b, 40_000, 'a');
    const voided = ev(repayment.targetId, { t: 'repayment_changed', patch: { deleted: true } }, repayment.id);
    const all = [...b, payment, repayment, voided];
    expect(balance(all)).toBe(300_000);
    expect(farmOwes(all)).toBe(64_000);
  });

  it('two nettings at the same sale add up, oldest bill first', () => {
    const b = base();
    const one = netting(b, 40_000, 'a');
    const two = netting([...b, one.payment, one.repayment], 24_000, 'b');
    const all = [...b, one.payment, one.repayment, two.payment, two.repayment];
    expect(balance(all)).toBe(236_000);
    expect(farmOwes(all)).toBe(0);
    // more than is left is refused
    expect(() => netting(all, 1, 'c')).toThrow();
  });
});

describe('deleting the sale brings both back (D-67, opt.deleteBody)', () => {
  it('a cash deduction and a netting at the sale: debt balance and what the farm owes return', () => {
    const b = base();
    const { payment, repayment } = netting(b, 40_000, 'a');
    const all = [...b, cash('dpay-cash', 150_000), payment, repayment];
    expect(balance(all)).toBe(110_000);
    expect(farmOwes(all)).toBe(24_000);
    const gone = (s: string) => s !== SALE;
    expect(balance(all, gone)).toBe(300_000);
    expect(farmOwes(all, gone)).toBe(64_000);
    // another sale is untouched
    const other = [...all, cash('dpay-other', 10_000, 'sale-2')];
    expect(balance(other, gone)).toBe(290_000);
  });
});
