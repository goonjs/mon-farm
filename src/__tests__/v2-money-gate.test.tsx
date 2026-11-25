/**
 * E01-S28 round 1 · the minimum-version gate on the money screens (S28-AC12 ก): a build below the group's
 * minimum (`app_min` in the finance scope) shows "อัปเดตแอปก่อนใช้หน้าเงิน" and no money, and round 1
 * sends no finance: a money write stays in the local finance log, never the outbox (round 2 moves it).
 */
import { act, screen } from '@testing-library/react-native';
import type { ComponentType, ReactNode } from 'react';

import DebtAddRoute from '../app/v2/debt-add';
import DebtPayRoute from '../app/v2/debt-pay';
import DebtAccountRoute from '../app/v2/debt/[workerId]';
import DebtsRoute from '../app/v2/debts';
import ExpenseRoute from '../app/v2/expense/[id]';
import ExpensesRoute from '../app/v2/expenses';
import FertilizerSettingsRoute from '../app/v2/fertilizer-settings';
import OrderRoute from '../app/v2/order';
import OrderDetailRoute from '../app/v2/order/[orderId]';
import OwedRoute from '../app/v2/owed';
import RepayRoute from '../app/v2/repay';
import { APP_RELEASE } from '../core/finance-scope';
import { scopeEvent } from '../core/fixtures';
import { financeStore as mockFinance } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import { store as mockStore } from '../store/store';
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
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false, dismissTo: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({ id: 'new' }),
    useRouter: () => router,
    router,
  };
});

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const ROUTES: [string, ComponentType][] = [
  ['expenses', ExpensesRoute],
  ['expense/[id]', ExpenseRoute],
  ['debts', DebtsRoute],
  ['debt/[workerId]', DebtAccountRoute],
  ['debt-add', DebtAddRoute],
  ['debt-pay', DebtPayRoute],
  ['owed', OwedRoute],
  ['repay', RepayRoute],
  ['order', OrderRoute],
  ['order/[orderId]', OrderDetailRoute],
  ['fertilizer-settings', FertilizerSettingsRoute],
];

beforeAll(async () => {
  // One expense of ฿4,321 in the local finance log: its amount must not show behind the gate.
  await mockFinance.append({
    id: 'exp-1',
    groupId: 'group-1',
    deviceSeq: 1,
    ts: 1,
    actor: { userId: 'test-user', deviceId: 'dev-other' },
    source: 'app',
    targetId: 'x1',
    baseEventId: null,
    payload: {
      t: 'expense_created',
      fields: { amountSatang: 432_100, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item: 'ทดสอบด่าน', note: '', payer: null },
    },
  });
});

describe('no group minimum (round 1 as deployed): the money screens open as before', () => {
  it('ค่าใช้จ่ายทั้งหมด shows the expense, and no update message', async () => {
    wrap(<ExpensesRoute />);
    await flush();
    expect(screen.queryByTestId('money-update-app')).toBeNull();
    expect(screen.getByText(/ทดสอบด่าน/)).toBeTruthy();
  });

  it('a minimum equal to this build does not gate', async () => {
    await mockStore.insertPulled(scopeEvent('min-same', 'app_min', { minApp: APP_RELEASE }));
    wrap(<ExpensesRoute />);
    await flush();
    expect(screen.queryByTestId('money-update-app')).toBeNull();
    expect(screen.getByText(/ทดสอบด่าน/)).toBeTruthy();
  });
});

describe('the group minimum is above this build: every money screen says update first (S28-AC12 ก)', () => {
  beforeAll(async () => {
    await mockStore.insertPulled(scopeEvent('fin-1', 'finance', { t: 'category_added', name: 'ค่าไฟ' }));
    await mockStore.insertPulled(scopeEvent('min-up', 'app_min', { minApp: APP_RELEASE + 1 }));
  });

  it.each(ROUTES)('/v2/%s shows "อัปเดตแอปก่อนใช้หน้าเงิน" and no money', async (_path, Route) => {
    wrap(<Route />);
    await flush();
    expect(screen.getByTestId('money-update-app')).toBeTruthy();
    expect(screen.getByText('อัปเดตแอปก่อนใช้หน้าเงิน')).toBeTruthy();
    expect(screen.queryByText(/ทดสอบด่าน/)).toBeNull();
    expect(screen.queryByText(/4,321/)).toBeNull();
  });

  it('the finance scope is still not a sale', async () => {
    expect(await mockStore.listSales()).not.toContain('farm-finance');
  });
});

describe('round 1 sends no finance (S28 รอบแรก "ยังไม่ส่งเงิน")', () => {
  it('a money write lands in the local finance log only: nothing enters the outbox', async () => {
    const before = (await mockFinance.load()).length;
    await writeFinance('cat-1', null, { t: 'category_added', name: 'ค่าน้ำ' });
    expect(await mockFinance.load()).toHaveLength(before + 1);
    expect(await mockStore.pending()).toEqual([]);
    const all = await Promise.all((await mockStore.listSales()).map((id) => mockStore.load(id)));
    expect(all.flat()).toEqual([]);
  });
});
