/**
 * E01-S28 round 2 · money on the synced log, as the screens see it: a money screen that is open shows what
 * a pull brought without leaving the page (S28-AC3), and the sync badge counts money not sent yet (S28-AC4).
 */
import { act, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ExpensesRoute from '../app/v2/expenses';
import { FINANCE_SCOPE } from '../core/finance-scope';
import type { FinancePayload } from '../core/finance/types';
import type { SaleEvent } from '../core/types';
import { writeFinance } from '../store/finance-write';
import { store as mockStore } from '../store/store';
import { emitSyncChanged } from '../sync/changed';
import { wrap } from '../test/render';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
// The real port over the (mocked) one event store, as the app binds it.
jest.mock('../store/finance', () => {
  const { EventFinanceStore } = jest.requireActual('../store/finance-log');
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  const { store } = jest.requireMock('../store/store');
  const { deviceClock } = jest.requireActual('../store/record');
  return { financeStore: new EventFinanceStore(store, deviceClock, new MemoryFinanceStore(), () => ({ userId: 'test-user', groupId: 'group-1' })) };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false, dismissTo: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    // Focus runs once, on mount, like a real first focus; a pull is the only later trigger here.
    useFocusEffect: (cb: () => void | (() => void)) => {
      const { useEffect } = jest.requireActual('react');
      useEffect(() => cb(), [cb]);
    },
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

async function flush() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const expense = (item: string, amountSatang: number): FinancePayload => ({
  t: 'expense_created',
  fields: { amountSatang, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item, note: '', payer: null },
});

/** A finance event from another phone, as a pull stores it. */
function pulled(id: string, payload: FinancePayload): SaleEvent {
  return {
    id,
    groupId: 'group-1',
    saleId: FINANCE_SCOPE,
    seq: 1,
    deviceSeq: 1,
    ts: 1,
    mono: 1,
    actor: { userId: 'user-other', deviceId: 'dev-other' },
    source: 'app',
    kind: 'finance',
    targetId: `x-${id}`,
    baseEventId: null,
    payload,
  } as unknown as SaleEvent;
}

describe('S28-AC4 · the sync badge on a money screen counts money not sent yet', () => {
  it('a money write is in the outbox and the badge says รอส่ง, not ซิงก์แล้ว', async () => {
    await writeFinance('x-local', null, expense('ค่าน้ำมันรถ', 50_000));
    const outbox = await mockStore.pending();
    expect(outbox.some((e) => e.kind === 'finance')).toBe(true);
    wrap(<ExpensesRoute />);
    await flush();
    // One expense recorded, one counted: the group minimum goes up too, but is not the farmer's (review N8 / UI N1).
    expect(screen.getByText('รอส่ง 1')).toBeTruthy();
    expect(screen.queryByText('ซิงก์แล้ว')).toBeNull();
  });
});

describe('S28-AC3 · an open money screen shows what a pull brought, without leaving it', () => {
  it('ค่าใช้จ่ายทั้งหมด lists the pulled expense after "sync changed"', async () => {
    wrap(<ExpensesRoute />);
    await flush();
    expect(screen.queryByText(/ปุ๋ยจากเครื่องอื่น/)).toBeNull();
    await mockStore.insertPulled(pulled('from-b', expense('ปุ๋ยจากเครื่องอื่น', 120_000)));
    await act(async () => emitSyncChanged());
    await flush();
    expect(screen.getByText(/ปุ๋ยจากเครื่องอื่น/)).toBeTruthy();
  });
});
