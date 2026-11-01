import { describe, expect, it } from 'vitest';

import { projectDebts } from './debts';
import { OWNER_PAYEE, paymentMarkPayload, paymentTarget } from './payments';
import { buyerOwes, PENDING_REPAY_SINCE, pendingRepayLines, pickFixPatches } from './pending-repays';
import { FARM_FUNDS, type DebtPaymentFields, type FinanceEvent, type FinancePayload, type Payer } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null, device = 'dev-a'): FinanceEvent {
  n += 1;
  return { id: `r${String(n).padStart(4, '0')}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: device }, source: 'app', targetId, baseEventId: base, payload };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const EK: Payer = { id: 'p-ek', name: 'เอก' };

function pay(id: string, over: Partial<DebtPaymentFields>) {
  const fields: DebtPaymentFields = { worker: DAENG, creditor: FARM, amountSatang: 0, date: '2026-11-05', note: '', method: 'buyer-split', saleId: 's1', ...over };
  return ev(id, { t: 'debt_payment_recorded', fields });
}
const tick = (saleId: string, payee: string, amount: number, received?: number, done = true) =>
  ev(paymentTarget(saleId, payee), paymentMarkPayload(saleId, payee, done, amount, received));

/** The sale from the mockup (A20): แดง 3,250 buyer-split cash, นัด 5,250 in the owner's transfer of 19,687.50. */
const sale = () => [
  pay('dp-1', { worker: DAENG, amountSatang: 325000, method: 'buyer-split' }),
  pay('dp-2', { worker: NAT, amountSatang: 525000, method: 'transfer-with-owner' }),
];
const lines = (events: FinanceEvent[], counts: (id: string) => boolean = () => true) => pendingRepayLines(events, projectDebts(events, counts));

describe('repayments not received yet, across sales (E06-S08 PR-1..PR-10)', () => {
  it('nothing ticked → one line per worker and sale, with how it should come in', () => {
    expect(lines(sale())).toEqual([
      { saleId: 's1', date: '2026-11-05', workerId: 'p-daeng', name: 'แดง', satang: 325000, how: 'cash' },
      { saleId: 's1', date: '2026-11-05', workerId: 'p-nat', name: 'นัด', satang: 525000, how: 'transfer' },
    ]);
  });

  it('the owner transfer tick clears every transfer line of that sale; the debt-cash tick clears that worker only', () => {
    const ev1 = [...sale(), tick('s1', OWNER_PAYEE, 1968750)];
    expect(lines(ev1).map((l) => l.workerId)).toEqual(['p-daeng']);
    const ev2 = [...ev1, tick('s1', 'debt-cash-p-daeng', 325000)];
    expect(lines(ev2)).toEqual([]);
  });

  it('a short or zero receipt also clears the line — the gap is the buyer owing the farm, not the worker (D-87)', () => {
    expect(lines([...sale(), tick('s1', 'debt-cash-p-daeng', 325000, 0)]).map((l) => l.workerId)).toEqual(['p-nat']);
  });

  it('cash-from-share not ticked → "picked" (the money is in the worker\'s own pile)', () => {
    expect(lines([pay('dp-3', { worker: EK, amountSatang: 100000, method: 'cash-from-share' })])).toEqual([
      { saleId: 's1', date: '2026-11-05', workerId: 'p-ek', name: 'เอก', satang: 100000, how: 'picked' },
    ]);
  });

  it('two sales pending for one worker → one line each, oldest first; same-route lines in one sale add up', () => {
    const evs = [
      pay('a', { saleId: 's2', date: '2026-11-09', amountSatang: 325000 }),
      pay('b', { saleId: 's1', date: '2026-11-02', amountSatang: 100000, method: 'transfer-with-owner' }),
      pay('c', { saleId: 's1', date: '2026-11-02', amountSatang: 80000, method: 'transfer-with-owner' }),
    ];
    expect(lines(evs).map((l) => [l.saleId, l.satang, l.how])).toEqual([
      ['s1', 180000, 'transfer'],
      ['s2', 325000, 'cash'],
    ]);
  });

  it('cancelled sale, voided deduction, outside payment and netting → no line (PR-9)', () => {
    const voided = pay('v', { amountSatang: 1000 });
    const evs = [
      pay('x', { saleId: 'gone', amountSatang: 5000 }),
      voided,
      ev('v', { t: 'debt_payment_changed', patch: { deleted: true } }, voided.id),
      pay('o', { method: 'outside', saleId: null, amountSatang: 7000 }),
      pay('nt', { method: 'netting', amountSatang: 64000 }),
    ];
    expect(lines(evs, (id) => id !== 'gone')).toEqual([]);
  });

  it(`sales dated before ${PENDING_REPAY_SINCE} never show (owner Q3: treated as received)`, () => {
    expect(lines([pay('old', { date: '2026-10-29', amountSatang: 325000 })])).toEqual([]);
  });

  it('the deduction is not undone: the balance is the same with or without the pending line (PR-2)', () => {
    const debt = ev('d1', { t: 'debt_added', fields: { worker: DAENG, kind: 'loan', amountSatang: 1579000, date: '2026-10-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
    const evs = [debt, ...sale()];
    expect(projectDebts(evs).get('p-daeng')?.balanceSatang).toBe(1254000);
    expect(projectDebts([...evs, tick('s1', 'debt-cash-p-daeng', 325000)]).get('p-daeng')?.balanceSatang).toBe(1254000);
  });
});

describe('the buyer owes the farm (E06-S08 PR-16 · D-87)', () => {
  it('per sale: the short transfer and short repayment cash, total to the satang', () => {
    const evs = [...sale(), tick('s1', OWNER_PAYEE, 1968750, 1700000), tick('s1', 'debt-cash-p-daeng', 325000, 0)];
    expect(buyerOwes(evs)).toEqual([{ saleId: 's1', transferSatang: 268750, cash: [{ workerId: 'p-daeng', satang: 325000 }], totalSatang: 593750 }]);
  });

  it('received in full, unticked, unticked again later, or a cancelled sale → nothing owed', () => {
    const t1 = tick('s1', OWNER_PAYEE, 1968750, 1700000);
    const back = ev(paymentTarget('s1', OWNER_PAYEE), paymentMarkPayload('s1', OWNER_PAYEE, false, 1968750), t1.id);
    expect(buyerOwes([...sale(), tick('s1', OWNER_PAYEE, 1968750)])).toEqual([]);
    expect(buyerOwes([...sale(), t1, back])).toEqual([]);
    expect(buyerOwes([...sale(), t1], (id) => id !== 's1')).toEqual([]);
  });

  it('conflicting ticks owe nothing until someone picks (D-30)', () => {
    const a = ev(paymentTarget('s1', OWNER_PAYEE), paymentMarkPayload('s1', OWNER_PAYEE, true, 1968750), null, 'dev-a');
    const b = ev(paymentTarget('s1', OWNER_PAYEE), paymentMarkPayload('s1', OWNER_PAYEE, true, 1968750, 1700000), null, 'dev-b');
    expect(buyerOwes([...sale(), a, b])).toEqual([]);
  });
});

describe('a pick that did not happen (E06-S08 PR-17 · D-87)', () => {
  const line = (id: string, amountSatang: number, head = `h-${id}`) => ({ id, headEventId: head, amountSatang });

  it('nothing picked → every pick line is voided (the debt comes back in full)', () => {
    expect(pickFixPatches([line('a', 100000)], 0)).toEqual([{ id: 'a', head: 'h-a', patch: { deleted: true } }]);
  });

  it('part picked → the lines are cut from the newest down to what was picked', () => {
    expect(pickFixPatches([line('a', 60000), line('b', 40000)], 70000)).toEqual([{ id: 'b', head: 'h-b', patch: { amountSatang: 10000 } }]);
    expect(pickFixPatches([line('a', 60000), line('b', 40000)], 50000)).toEqual([
      { id: 'b', head: 'h-b', patch: { deleted: true } },
      { id: 'a', head: 'h-a', patch: { amountSatang: 50000 } },
    ]);
  });

  it('picked in full → nothing to write; more than was deducted or not an integer → refused', () => {
    expect(pickFixPatches([line('a', 100000)], 100000)).toEqual([]);
    expect(() => pickFixPatches([line('a', 100000)], 100001)).toThrow();
    expect(() => pickFixPatches([line('a', 100000)], -1)).toThrow();
  });
});
