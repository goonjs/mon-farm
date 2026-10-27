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
  router: { push: jest.Mock; replace: jest.Mock };
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

  it('kind fertilizer opens the shop order (E11-S11)', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-fertilizer'));
    // Replaced: after saving the purchase the user lands on the tapper's debts, not this form again.
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2/order');
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

describe('a debt made from an expense share (E11-S10)', () => {
  it('cannot be voided here: it opens its expense (the flow for fertilizer)', async () => {
    mockParams.current = { workerId: 'p-som', name: 'สม' };
    await mockFinance.append({
      id: 'share-exp-1',
      groupId: 'group-1',
      deviceSeq: 9,
      ts: 9,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'exp-share-1',
      baseEventId: null,
      payload: {
        t: 'expense_created',
        fields: {
          amountSatang: 100000, date: '2026-10-01', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: '', note: '', payer: null,
          share: { billSatang: 100000, discountSatang: 0, totalSacks: 2, lines: [{ worker: { id: 'p-som', name: 'สม' }, sacks: 2, workerPct: 50, settle: 'debt' }] },
          fertilizer: { type: 'chemical', formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: '', orderedBy: '' },
        },
      },
    });
    wrap(<DebtAccountScreen />);
    await flush();
    const id = 'exp-share-1:share:p-som';
    expect(screen.getByTestId(`debt-line-${id}`)).toBeTruthy();
    expect(screen.queryByTestId(`debt-void-${id}`)).toBeNull();
    fireEvent.press(screen.getByTestId(`debt-open-${id}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: 'exp-share-1' } });
  });

  it('once its purchase is deleted, the line opens the expense form, where it can be restored', async () => {
    mockParams.current = { workerId: 'p-som', name: 'สม' };
    await mockFinance.append({
      id: 'share-exp-1-del',
      groupId: 'group-1',
      deviceSeq: 10,
      ts: 10,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'exp-share-1',
      baseEventId: 'share-exp-1',
      payload: { t: 'expense_changed', patch: { deleted: true } },
    });
    wrap(<DebtAccountScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-open-exp-share-1:share:p-som'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/expense/[id]', params: { id: 'exp-share-1' } });
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
