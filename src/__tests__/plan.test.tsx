import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ExpenseScreen from '../app/finance/expense/[id]';
import SalaryScreen from '../app/finance/salary';
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

async function state() {
  return projectFinance(await mockFinance.load());
}

describe('E11-S05/S06 in the expense form', () => {
  beforeEach(() => {
    mockParams.current = { id: 'new' };
  });

  it('a trip is the sum of its cost lines; a split must add up', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-travel'));
    fireEvent.changeText(screen.getByTestId('trip-line-fuel'), '800');
    fireEvent.changeText(screen.getByTestId('trip-line-toll'), '120');
    expect(screen.getByTestId('trip-total').props.children).toContain('920.00');
    fireEvent.changeText(screen.getByTestId('trip-farms'), 'สวน 1, สวน 2');
    fireEvent.press(screen.getByTestId('trip-split'));
    fireEvent.changeText(screen.getByTestId('trip-split-สวน 1'), '500');
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    expect(screen.getByTestId('trip-err-split')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('trip-split-สวน 2'), '420');
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const x = (await state()).expenses.find((e) => e.trip);
    expect(x).toMatchObject({ amountSatang: 92000, categoryId: 'cat-travel' });
    expect(x?.trip?.split?.map((s) => s.satang)).toEqual([50000, 42000]);
  });

  it('a special payment records the worker and kind', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-worker-aid'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '2000');
    fireEvent.press(screen.getByTestId('aid-worker-add'));
    fireEvent.changeText(screen.getByTestId('aid-worker-name'), 'นัด');
    await act(async () => fireEvent.press(screen.getByTestId('aid-worker-add-save')));
    await flush();
    fireEvent.press(screen.getByTestId('aid-kind-accident'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const x = (await state()).expenses.find((e) => e.worker);
    expect(x).toMatchObject({ amountSatang: 200000, aidKind: 'accident', worker: { name: 'นัด' } });
  });
});

describe('E11-S04 salary screen', () => {
  it('sets a rule, months appear committed, "paid" makes one actual', async () => {
    wrap(<SalaryScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('salary-add'));
    fireEvent.press(screen.getByTestId('salary-recipient-add'));
    fireEvent.changeText(screen.getByTestId('salary-recipient-name'), 'ผู้จัดการ');
    await act(async () => fireEvent.press(screen.getByTestId('salary-recipient-add-save')));
    await flush();
    fireEvent.press(screen.getByTestId('salary-payer-add'));
    fireEvent.changeText(screen.getByTestId('salary-payer-name'), 'เจ้าของสวน');
    await act(async () => fireEvent.press(screen.getByTestId('salary-payer-add-save')));
    await flush();
    const month = new Date().toISOString().slice(0, 7);
    fireEvent.changeText(screen.getByTestId('salary-start'), month);
    await act(async () => fireEvent.press(screen.getByTestId('salary-save')));
    await flush();
    expect(screen.getByTestId(`salary-month-${month}`)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId(`salary-pay-${month}`)));
    await flush();
    expect(screen.getByTestId(`salary-undo-${month}`)).toBeTruthy();
  });
});
