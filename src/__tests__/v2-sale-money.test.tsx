import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CheckScreen, PaymentScreen, SettlementScreen, TallyScreen } from '../v2/sale/money-screens';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/people', () => {
  const { MasterStore } = jest.requireActual('../store/master-store');
  const { createDeviceClock } = jest.requireActual('../store/device-clock');
  const { store } = jest.requireMock('../store/store');
  return { peopleStore: new MasterStore(store, createDeviceClock(store)) };
});
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;
const store = () => (jest.requireMock('../store/store') as { store: EventStore }).store;
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace' | 'dismissAll', jest.Mock> };
/** Two taps in the same tick: a write must land once (review #4). */
const doubleTap = async (id: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(id));
    fireEvent.press(screen.getByTestId(id));
  });
  await flush();
};

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const SALE = 'sale-money';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};

let farm: MockFarm;

/** แดง 3 full at จุด 1 (150 kg); นัด 1 full + 35 kg short at จุด 4 (85 kg); 48.50 ฿/kg. */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  await writeFinance('debt-nat', null, {
    t: 'debt_added',
    fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 150_000, date: '2026-09-01', note: '', lender: { id: FARM_FUNDS, name: 'เงินสวน' }, fertilizer: null, carriedForward: false },
  });
});

describe('v2 sale money (pages 16–19)', () => {
  it('check: our figures, one tap "ตรงกันทั้งหมด" records it', async () => {
    await inSale(<CheckScreen />);
    expect(screen.getByTestId('check-weight')).toHaveTextContent(/235 กก\./);
    expect(screen.getByTestId('check-baskets')).toHaveTextContent(/5 เข่ง/);
    expect(screen.getByTestId('check-total')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId(`check-tapper-${farm.red}`)).toHaveTextContent(/150 กก\./);
    await doubleTap('check-match');
    expect(screen.getByTestId('check-status').props.accessibilityLabel).toBe('ยอดผู้ขายและคนรับซื้อยางตรงกัน');
    const fin = await financeStore.load();
    expect(fin.filter((e) => e.payload.t === 'buyer_check_set')).toHaveLength(1);
  });

  it('settlement: shares per tapper; a debt deducted with the owner\'s transfer moves the transfer', async () => {
    await inSale(<SettlementScreen />);
    expect(screen.getByTestId(`share-amt-${farm.red}`)).toHaveTextContent(/3,637\.50/);
    expect(screen.getByTestId(`share-amt-${farm.nat}`)).toHaveTextContent(/2,061\.25/);
    expect(screen.getByTestId('owner-transfer')).toHaveTextContent(/5,698\.75/);
    expect(screen.queryByTestId(`deduct-${farm.red}`)).toBeNull();
    await press(`deduct-${farm.nat}`);
    expect(screen.getByTestId('deduct-sheet')).toBeTruthy();
    await press('method-transfer-with-owner');
    await doubleTap('deduct-save');
    expect((await financeStore.load()).filter((e) => e.payload.t === 'debt_payment_recorded')).toHaveLength(1);
    expect(screen.getByTestId(`cash-${farm.nat}`)).toHaveTextContent(/561\.25/);
    expect(screen.getByTestId('owner-transfer')).toHaveTextContent(/7,198\.75/);
    await press('to-rounding');
    expect(screen.getByTestId('rounding-sheet')).toBeTruthy();
    await press('round-worker');
    router.push.mockClear();
    await doubleTap('round-confirm');
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenLastCalledWith(`/v2/sale/${SALE}/tally`);
  });

  it('tally: every pile adds up to the sale', async () => {
    await inSale(<TallyScreen />);
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
    expect(screen.getByTestId('tally-sum')).toHaveTextContent(/11,397\.50/);
  });

  it('payment: each payee ticks on its own; close completes the sale', async () => {
    await inSale(<PaymentScreen />);
    expect(screen.getByTestId(`tick-amt-${farm.red}`)).toHaveTextContent('3,638');
    await doubleTap(`tick-${farm.red}`);
    expect(screen.getByTestId(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: true });
    expect((await financeStore.load()).filter((e) => e.payload.t === 'payment_mark_set')).toHaveLength(1);
    await press('close-sale');
    // The whole sale stack goes, so back never reaches a live write screen (review #2).
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.replace).toHaveBeenLastCalledWith('/v2/sales');
    const ev = await store().load(SALE);
    expect(ev.some((e) => e.kind === 'sys' && e.payload.t === 'sale_status_set' && e.payload.status === 'completed')).toBe(true);
  });

  it('a closed sale is read-only: no deduction, account, rounding, check or tick (review #2)', async () => {
    const s = await inSale(<SettlementScreen />);
    expect(screen.queryByTestId(`deduct-${farm.nat}`)).toBeNull();
    expect(screen.queryByTestId('account-change')).toBeNull();
    s.unmount();
    const c = await inSale(<CheckScreen />);
    expect(screen.queryByTestId('check-match')).toBeNull();
    c.unmount();
    await inSale(<PaymentScreen />);
    expect(screen.getByTestId(`tick-${farm.nat}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId('close-sale')).toBeNull();
  });
});

describe('closing waits for the piles, the rounding and any tick conflict (review #5, #6)', () => {
  const OTHER = 'sale-money-2';
  beforeAll(async () => {
    const b = new LogBuilder(OTHER);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.sys({ t: 'pile_added', pileId: farm.a[3], zoneId: farm.farmA, name: 'p', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  });
  const inOther = async (ui: ReactElement) => {
    const r = wrap(<SaleProvider saleId={OTHER}>{ui}</SaleProvider>);
    await flush();
    return r;
  };

  it('rounding not answered (a fraction to round): close is off', async () => {
    await inOther(<PaymentScreen />);
    expect(screen.getByTestId('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a tick in conflict between two phones: ticks and close are off', async () => {
    for (const done of [true, false]) {
      await writeFinance(`payment-${OTHER}-${farm.nat}`, null, { t: 'payment_mark_set', saleId: OTHER, payee: farm.nat, done, amountSatang: 1 });
    }
    await inOther(<PaymentScreen />);
    expect(screen.getByTestId(`tick-${farm.nat}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('pay-conflict')).toBeTruthy();
    expect(screen.getByTestId('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
