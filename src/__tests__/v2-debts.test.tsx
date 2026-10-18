import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AddDebtScreen, PayDebtScreen as DebtPaymentScreen } from '../v2/money/debt-forms';
import { DebtAccountScreen } from '../v2/money/debts-screens';
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
const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: { push: jest.Mock };
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

  it('kind fertilizer opens the one fertilizer purchase flow with this tapper (E11-S10 C)', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-fertilizer'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/v2/fertilizer', params: { workerId: 'p-daeng', name: 'แดง' } });
    expect(screen.queryByTestId('debt-pct-mode')).toBeNull();
  });

  it('an old manual fertilizer debt (bill × %) still reads, with its owner-share expense', async () => {
    await mockFinance.append({
      id: 'old-fert-1',
      groupId: 'group-1',
      deviceSeq: 1,
      ts: 1,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'debt-old-fert',
      baseEventId: null,
      payload: {
        t: 'debt_added',
        fields: { worker: { id: 'p-daeng', name: 'แดง' }, kind: 'fertilizer', amountSatang: 200000, date: '2026-09-20', note: 'ปุ๋ยรอบ ก.ย.', lender: null, fertilizer: { totalSatang: 400000, workerPct: 50 }, carriedForward: false },
      },
    });
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
    expect(screen.getByTestId('debt-note-error')).toBeTruthy();
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
    expect(screen.getByTestId('debt-summary-balance').props.children).toBe('−500.00');
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

describe('Save sits in the header (keyboard never covers it)', () => {
  it('debt-save and debt-pay-save render inside screen-header', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).getByTestId('debt-save')).toBeTruthy();
    screen.unmount();
    wrap(<DebtPaymentScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).getByTestId('debt-pay-save')).toBeTruthy();
  });
});
