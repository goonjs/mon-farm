import { describe, expect, it } from 'vitest';

import { legacySplitReport } from './legacy-split-report';
import { FARM_FUNDS, type ExpenseFields, type ExpenseShare, type FinanceEvent, type FinancePayload, type Payer } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent {
  n += 1;
  return { id: `r${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'dev-a' }, source: 'app', targetId, baseEventId: base, payload };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };

const share = (lines: ExpenseShare['lines']): ExpenseShare => ({ billSatang: 1_000_000, discountSatang: 0, totalSacks: 10, lines });
const fields = (s: ExpenseShare | null, over: Partial<ExpenseFields> = {}): ExpenseFields => ({
  amountSatang: 1_000_000,
  date: '2026-10-14',
  stage: 'actual',
  categoryId: 'cat-fertilizer',
  propertyId: null,
  item: 'ดีเกลือ',
  note: '',
  payer: FARM,
  share: s,
  ...over,
});

describe('legacySplitReport (E11-S17 RM-4b, RM-7)', () => {
  it('counts fertilizer items with an old split and the tapper debt that disappears, per worker', () => {
    const events = [
      ev('a', { t: 'expense_created', fields: fields(share([{ worker: DAENG, sacks: 6, workerPct: 50, settle: 'debt' }])) }),
      ev('b', { t: 'expense_created', fields: fields(share([{ worker: NAT, sacks: 4, workerPct: 50, settle: 'paid' }])) }),
      ev('c', { t: 'expense_created', fields: fields(null) }),
      ev('d', { t: 'expense_created', fields: fields(share([{ worker: NAT, sacks: 2, workerPct: 50, settle: 'debt' }]), { categoryId: 'cat-other' }) }),
      ev('pay', {
        t: 'debt_payment_recorded',
        fields: { worker: DAENG, creditor: FARM, amountSatang: 400_000, date: '2026-10-20', note: '', method: 'cash-from-share', saleId: 'sale-1' },
      }),
    ];
    const r = legacySplitReport(events);
    expect(r.itemsWithSplit).toBe(2);
    expect(r.workers).toEqual([
      { worker: DAENG, goneSatang: 300_000, balanceBeforeSatang: -100_000, balanceAfterSatang: -400_000, hasPlan: false },
    ]);
    expect(r.totalGoneSatang).toBe(300_000);
  });

  it('flags a worker with an instalment plan', () => {
    const events = [
      ev('a', { t: 'expense_created', fields: fields(share([{ worker: DAENG, sacks: 6, workerPct: 50, settle: 'debt' }])) }),
      ev('plan-p-daeng', {
        t: 'debt_plan_set',
        worker: DAENG,
        perSaleSatang: 100_000,
        installments: { count: 3, fromSaleId: null, seen: { 'dev-a': n }, owedSatang: 300_000 },
      }),
    ];
    expect(legacySplitReport(events).workers[0].hasPlan).toBe(true);
  });
});
