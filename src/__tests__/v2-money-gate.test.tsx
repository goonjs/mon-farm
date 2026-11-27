/**
 * E01-S28 · the minimum-version gate on the money screens (S28-AC12 ก): a build below the group's
 * minimum (`app_min` in the finance scope) shows "อัปเดตแอปก่อนใช้หน้าเงิน" and no money. Round 1 gated
 * the 11 money routes; round 2 gates every surface that shows money amounts (the team's reading of
 * "ไม่แสดงยอดเงิน", see the story's Dev notes): the sale's money pages, garden care, the sale prep, and
 * the money rows on home. Round 2 also sends money: a write goes to the one event log's outbox.
 */
import { act, screen, within } from '@testing-library/react-native';
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
import CareRoute from '../app/v2/care';
import FertilizingRoute from '../app/v2/fertilizing';
import StockRoute from '../app/v2/stock';
import PrepareRoute from '../app/v2/prepare';
import PrepareBuyerRoute from '../app/v2/prepare/buyer';
import SaleBuyerViewRoute from '../app/v2/sale/[id]/buyer-view';
import SaleCashRoute from '../app/v2/sale/[id]/cash';
import SaleCheckRoute from '../app/v2/sale/[id]/check';
import SalePaymentRoute from '../app/v2/sale/[id]/payment';
import SaleSettlementRoute from '../app/v2/sale/[id]/settlement';
import SaleShowAccountRoute from '../app/v2/sale/[id]/show-account';
import { V2Home } from '../v2/home-screen';
import { APP_RELEASE } from '../core/finance-scope';
import { scopeEvent } from '../core/fixtures';
import { financeStore as mockFinance } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';

// Round 2: the real port over the (mocked) one event store, as the app binds it.
jest.mock('../store/finance', () => {
  const { EventFinanceStore } = jest.requireActual('../store/finance-log');
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  const { store } = jest.requireMock('../store/store');
  const { deviceClock } = jest.requireActual('../store/record');
  return { financeStore: new EventFinanceStore(store, deviceClock, new MemoryFinanceStore(), () => ({ userId: 'test-user', groupId: 'group-1' })) };
});
// The cover scene has its own suite; here it stands in still, so its timers stay out.
jest.mock('../v2/home-cover', () => {
  const { View } = jest.requireActual('react-native');
  return { HomeCover: () => <View testID="home-cover" /> };
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

/** Round 2: the other surfaces that show money amounts (round 1's open item). */
const MORE_ROUTES: [string, ComponentType][] = [
  ['sale/[id]/settlement', SaleSettlementRoute],
  ['sale/[id]/payment', SalePaymentRoute],
  ['sale/[id]/cash', SaleCashRoute],
  ['sale/[id]/buyer-view', SaleBuyerViewRoute],
  ['sale/[id]/check', SaleCheckRoute],
  ['sale/[id]/show-account', SaleShowAccountRoute],
  ['care', CareRoute],
  ['fertilizing', FertilizingRoute],
  ['stock', StockRoute],
  ['prepare', PrepareRoute],
  ['prepare/buyer', PrepareBuyerRoute],
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
  // Paid by a person, not yet paid back: home shows it as ค้างใคร.
  await mockFinance.append({
    id: 'exp-2',
    groupId: 'group-1',
    deviceSeq: 2,
    ts: 2,
    actor: { userId: 'test-user', deviceId: 'dev-other' },
    source: 'app',
    targetId: 'x2',
    baseEventId: null,
    payload: {
      t: 'expense_created',
      fields: { amountSatang: 98_700, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าน้ำมัน', note: '', payer: { id: 'p-nat', name: 'นัด' } },
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

  it('home shows the money rows (ค้างใคร) and no update message', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-owed')).toBeTruthy();
    expect(screen.queryByTestId('home-money-update')).toBeNull();
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

  // The screen is not mounted at all behind the gate, so the update page is the whole proof (review UI N7).
  it.each(MORE_ROUTES)('/v2/%s (round 2) shows only "อัปเดตแอปก่อนใช้หน้าเงิน"', async (_path, Route) => {
    wrap(<Route />);
    await flush();
    expect(screen.getByTestId('money-update-app')).toBeTruthy();
    expect(screen.getByText('อัปเดตแอปก่อนใช้หน้าเงิน')).toBeTruthy();
  });

  it('home hides its money rows and says update first, in their place (round 2)', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.queryByTestId('home-owed')).toBeNull();
    expect(screen.queryByText(/987/)).toBeNull();
    expect(screen.getByTestId('home-money-update')).toBeTruthy();
    expect(screen.getByText('อัปเดตแอปก่อนใช้หน้าเงิน')).toBeTruthy();
    // Review UI N4: no amount anywhere in ควรรู้ below the minimum, whichever rows money would make.
    const card = screen.getByTestId('home-to-know');
    expect(within(card).queryAllByText(/฿|\d,\d{3}|\d\.\d{2}|บาท/)).toEqual([]);
  });

  it('the finance scope is still not a sale', async () => {
    expect(await mockStore.listSales()).not.toContain('farm-finance');
  });
});

describe('round 2 sends money (S28-AC1, AC2)', () => {
  it('a money write goes into the one event log, in the outbox, under the finance scope — never a sale', async () => {
    const before = (await mockFinance.load()).length;
    await writeFinance('cat-1', null, { t: 'category_added', name: 'ค่าน้ำ' });
    expect(await mockFinance.load()).toHaveLength(before + 1);
    const outbox = await mockStore.pending();
    expect(outbox.filter((e) => e.kind === 'finance').map((e) => (e as { targetId?: string }).targetId)).toContain('cat-1');
    expect(outbox.every((e) => e.saleId === 'farm-finance')).toBe(true);
    expect(await mockStore.listSales()).toEqual([]);
  });
});
