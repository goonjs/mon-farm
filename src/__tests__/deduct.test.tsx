import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { DebtDeductionCard } from '../components/finance/DebtDeductionCard';
import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
import type { FinanceEvent, FinancePayload } from '../core/finance/types';
import { financeStore as mockFinance } from '../store/finance';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

// Built inside the factory: jest.mock is hoisted above any outer const.
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    __params: params,
  };
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}


let n = 0;
async function seed(targetId: string, payload: FinancePayload) {
  n += 1;
  const e: FinanceEvent = { id: `s${n}`, deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId, baseEventId: null, payload };
  await mockFinance.append(e);
}

const FARM = { id: 'farm', name: 'เงินสวน' };
const NAT = { id: 'p-nat', name: 'นัด' };
const DAENG = { id: 'p-daeng', name: 'แดง' };

describe('deduct at settlement (E06-S04)', () => {
  beforeAll(async () => {
    await seed('d-daeng', { t: 'debt_added', fields: { worker: DAENG, kind: 'loan', amountSatang: 500000, date: '2026-09-10', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
    await seed('plan-p-daeng', { t: 'debt_plan_set', worker: DAENG, perSaleSatang: 200000 });
    await seed('d-nat', { t: 'debt_added', fields: { worker: NAT, kind: 'fertilizer', amountSatang: 150000, date: '2026-09-20', note: '', lender: FARM, fertilizer: { totalSatang: 300000, workerPct: 50 }, carriedForward: false } });
    await seed('x-nat', { t: 'expense_created', fields: { amountSatang: 64000, date: '2026-09-28', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: NAT } });
  });

  it('proposes the instalment, refuses above the cap, records the deduction against this sale', async () => {
    wrap(<DebtDeductionCard saleId="sale-1" worker={DAENG} shareSatang={286000} />);
    await flush();
    fireEvent.press(screen.getByTestId('deduct-open-p-daeng'));
    expect(screen.getByTestId('deduct-amount-p-daeng').props.value).toBe('2000.00');
    fireEvent.changeText(screen.getByTestId('deduct-amount-p-daeng'), '3000');
    expect(screen.getByTestId('deduct-over-p-daeng')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('deduct-amount-p-daeng'), '500');
    await act(async () => fireEvent.press(screen.getByTestId('deduct-save-p-daeng')));
    await flush();

    const a = projectDebts(await mockFinance.load()).get('p-daeng')!;
    expect(a.balanceSatang).toBe(450000);
    expect(a.payments.at(-1)).toMatchObject({ saleId: 'sale-1', method: 'cash-from-share', amountSatang: 50000 });
    expect(screen.getByTestId('deduct-cash-p-daeng').props.children).toBe('2,360.00');
  });

  it('netting is offered, not applied; when used it writes a repayment and a debt payment', async () => {
    wrap(<DebtDeductionCard saleId="sale-1" worker={NAT} shareSatang={86000} />);
    await flush();
    fireEvent.press(screen.getByTestId('deduct-open-p-nat'));
    fireEvent.press(screen.getByTestId('deduct-net-p-nat'));
    fireEvent.changeText(screen.getByTestId('deduct-amount-p-nat'), '1500');
    fireEvent.press(screen.getByTestId('deduct-route-transfer-with-owner-p-nat'));
    await act(async () => fireEvent.press(screen.getByTestId('deduct-save-p-nat')));
    await flush();

    const events = await mockFinance.load();
    const a = projectDebts(events).get('p-nat')!;
    expect(a.balanceSatang).toBe(0);
    expect(a.summary.deducted).toMatchObject({ netting: 64000, 'transfer-with-owner': 86000 });
    const s = projectFinance(events);
    expect(s.reimbursements.find((r) => r.expenseId === 'x-nat')).toMatchObject({ remainingSatang: 0, status: 'repaid' });
    expect(s.repayments.find((r) => r.saleId === 'sale-1')).toMatchObject({ amountSatang: 64000, to: NAT });
    expect(screen.getByTestId('deduct-transfer-p-nat')).toBeTruthy();
    expect(screen.getByTestId('deduct-cash-p-nat').props.children).toBe('0.00');
  });

  it('review #4: voiding a netting line voids its linked repayment by id', async () => {
    wrap(<DebtDeductionCard saleId="sale-1" worker={NAT} shareSatang={86000} />);
    await flush();
    const before = projectDebts(await mockFinance.load()).get('p-nat')!;
    const netting = before.payments.find((p) => p.method === 'netting' && !p.deleted)!;
    expect(netting.repaymentId).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId(`deduct-void-${netting.id}`)));
    await flush();
    const s = projectFinance(await mockFinance.load());
    expect(s.repayments.find((r) => r.id === netting.repaymentId)?.deleted).toBe(true);
    expect(s.reimbursements.find((r) => r.expenseId === 'x-nat')?.remainingSatang).toBe(64000);
  });

  it('review #3: a double tap records one deduction, not two', async () => {
    wrap(<DebtDeductionCard saleId="sale-2" worker={DAENG} shareSatang={286000} />);
    await flush();
    fireEvent.press(screen.getByTestId('deduct-open-p-daeng'));
    fireEvent.changeText(screen.getByTestId('deduct-amount-p-daeng'), '100');
    await act(async () => {
      fireEvent.press(screen.getByTestId('deduct-save-p-daeng'));
      fireEvent.press(screen.getByTestId('deduct-save-p-daeng'));
    });
    await flush();
    const a = projectDebts(await mockFinance.load()).get('p-daeng')!;
    expect(a.payments.filter((p) => p.saleId === 'sale-2')).toHaveLength(1);
  });

  it('after the share shrinks below what was deducted → flagged (D-61)', async () => {
    wrap(<DebtDeductionCard saleId="sale-1" worker={DAENG} shareSatang={30000} />);
    await flush();
    expect(screen.getByTestId('deduct-flag-p-daeng')).toBeTruthy();
  });
});
