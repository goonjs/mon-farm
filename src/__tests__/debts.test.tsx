import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import DebtAccountScreen from '../app/finance/debts/[workerId]';
import AddDebtScreen from '../app/finance/debts/add';
import DebtPaymentScreen from '../app/finance/debts/pay';
import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
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
const { __params: mockParams } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const DAENG = { workerId: 'p-daeng', name: 'แดง' };

describe('debt ledger (E06-S03)', () => {
  beforeEach(() => {
    mockParams.current = DAENG;
  });

  it('manual fertilizer debt: bill × % (default 50) and the owner share becomes an expense', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-fertilizer'));
    fireEvent.changeText(screen.getByTestId('debt-amount'), '4000');
    expect(screen.getByTestId('debt-worker-share').props.children).toContain('2,000.00');
    fireEvent.changeText(screen.getByTestId('debt-pct'), '33.5');
    expect(screen.getByTestId('debt-pct-bad')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('debt-pct'), '50');
    fireEvent.changeText(screen.getByTestId('debt-date'), '2026-09-20');
    fireEvent.changeText(screen.getByTestId('debt-note'), 'ปุ๋ยรอบ ก.ย.');
    await act(async () => fireEvent.press(screen.getByTestId('debt-save')));
    await flush();

    const events = await mockFinance.load();
    expect(projectDebts(events).get('p-daeng')?.summary.owed.fertilizer).toBe(200000);
    const owner = projectFinance(events).expenses.find((x) => x.id.endsWith(':owner'));
    expect(owner).toMatchObject({ amountSatang: 200000, categoryId: 'cat-fertilizer', payer: null });
  });

  it('"other" needs a note', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-other'));
    fireEvent.changeText(screen.getByTestId('debt-amount'), '100');
    await act(async () => fireEvent.press(screen.getByTestId('debt-save')));
    expect(screen.getByTestId('debt-note-required')).toBeTruthy();
  });

  it('paying more than owed warns, then "save anyway" records it and flags the account', async () => {
    wrap(<DebtPaymentScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('debt-pay-amount'), '2500');
    await act(async () => fireEvent.press(screen.getByTestId('debt-pay-save')));
    expect(screen.getByTestId('debt-pay-over')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('debt-pay-anyway')));
    await flush();
    const a = projectDebts(await mockFinance.load()).get('p-daeng');
    expect(a).toMatchObject({ balanceSatang: -50000, overpaid: true });
  });

  it('account: reconciliation bottom line equals the balance; history filters by kind; void recomputes', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    expect(screen.getByTestId('debt-balance').props.children).toBe('500.00');
    expect(screen.getByTestId('debt-summary-balance').props.children).toContain('−500.00 ✓');
    expect(screen.getByTestId('debt-flag')).toBeTruthy();

    fireEvent.press(screen.getByTestId('debt-filter-payment'));
    const payment = screen.getAllByTestId(/^debt-line-/);
    expect(payment).toHaveLength(1);
    const id = payment[0].props.testID.replace('debt-line-', '');
    await act(async () => fireEvent.press(screen.getByTestId(`debt-void-${id}`)));
    await flush();
    expect(projectDebts(await mockFinance.load()).get('p-daeng')?.balanceSatang).toBe(200000);
  });
});
