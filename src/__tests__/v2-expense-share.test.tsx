import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
import type { FinanceEvent } from '../core/finance/types';
import { ExpenseFormScreen } from '../v2/money/expense-form-screen';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
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
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
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

let seq = 0;
async function seed(targetId: string, payload: FinanceEvent['payload']) {
  seq += 1;
  await mockFinance.append({
    id: `seed-${seq}`,
    groupId: 'group-1',
    deviceSeq: seq,
    ts: seq,
    actor: { userId: 'u', deviceId: 'dev-other' },
    source: 'app',
    targetId,
    baseEventId: null,
    payload,
  });
}

describe('share an expense with a tapper (E11-S10 B)', () => {
  let daengId = '';
  beforeAll(async () => {
    daengId = (await mockPeople.create('แดง', ['tapper'])).id;
    await seed('cat-repair', { t: 'category_share_set', workerPct: 50 });
  });
  beforeEach(() => {
    mockParams.current = { id: 'new' };
  });

  it('a category without sharing shows no share row', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-labour'));
    expect(screen.queryByTestId('share-row')).toBeNull();
  });

  it('discount first, then the tapper: the debt is half the net bill, odd satang to the tapper', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '1250.25');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    // The discount switch is off by default and sits above the tapper choice.
    expect(screen.queryByTestId('share-discount')).toBeNull();
    fireEvent.press(screen.getByTestId('share-discount-switch'));
    fireEvent.changeText(screen.getByTestId('share-discount'), '100');
    fireEvent.press(screen.getByTestId(`share-worker-${daengId}`));
    expect(screen.getByTestId('share-pct').props.value).toBe('50');
    expect(screen.getByTestId('share-preview')).toHaveTextContent(/575\.13.*575\.12/);
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();

    const events = await mockFinance.load();
    const x = projectFinance(events).expenses.find((e) => e.share);
    expect(x).toMatchObject({ amountSatang: 115_025, share: { billSatang: 125_025, discountSatang: 10_000, totalSacks: null } });
    expect(projectDebts(events).get(daengId)?.balanceSatang).toBe(57_513);
  });

  it('“จ่ายแล้ว” records the share with no debt', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '200');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.press(screen.getByTestId(`share-worker-${daengId}`));
    fireEvent.press(screen.getByTestId('share-settle-paid'));
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const events = await mockFinance.load();
    const x = projectFinance(events).expenses.find((e) => e.amountSatang === 20_000);
    expect(x?.share?.lines[0].settle).toBe('paid');
    expect(projectDebts(events).get(daengId)?.balanceSatang).toBe(57_513);
  });

  it('category settings turn sharing on with a %', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-herbicide'));
    fireEvent.press(screen.getByTestId('expense-cat-share'));
    fireEvent.press(screen.getByTestId('cat-share-switch'));
    fireEvent.changeText(screen.getByTestId('cat-share-pct'), '30');
    await act(async () => fireEvent.press(screen.getByTestId('cat-share-save')));
    await flush();
    expect(projectFinance(await mockFinance.load()).categories.find((c) => c.id === 'cat-herbicide')?.workerPct).toBe(30);
    expect(screen.getByTestId('share-row')).toBeTruthy();
  });

  it('the fertilizer category opens the fertilizer purchase flow with what was typed', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '10000');
    fireEvent.press(screen.getByTestId('expense-cat-cat-fertilizer'));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/v2/fertilizer', params: expect.objectContaining({ bill: '10000' }) }));
  });

  it('a fertilizer purchase opens in its own flow to be edited', async () => {
    await seed('exp-fert-1', {
      t: 'expense_created',
      fields: {
        amountSatang: 100_000, date: '2026-10-01', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: 'ยูเรีย', note: '', payer: null,
        share: { billSatang: 100_000, discountSatang: 0, totalSacks: 1, lines: [] },
        fertilizer: { type: 'chemical', formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: '', orderedBy: '' },
      },
    });
    mockParams.current = { id: 'exp-fert-1' };
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-open-fert'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/v2/fertilizer', params: { id: 'exp-fert-1' } });
  });
});
