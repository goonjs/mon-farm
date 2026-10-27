import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS } from '../core/finance/types';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { PaymentScreen, SettlementScreen } from '../v2/sale/money-screens';

/**
 * E05-S10 (owner 2026-10-27): a sale entered for an earlier day deducts part
 * of a debt dated later — what it leaves is still owed, not 0; the cash
 * repayment reads plainly; and the farm ticks that it got the cash.
 */

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
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn(), dismissTo: jest.fn() };
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
const type = async (id: string, text: string) => {
  await act(async () => fireEvent.changeText(screen.getByTestId(id), text));
  await flush();
};
const last = (id: string) => screen.getAllByTestId(id).pop()!;
const SALE = 'sale-13';
const DAY = '2026-10-13';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };

let farm: MockFarm;

const saleOf = (id: string) => {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  return b.build().map((e) => ({ ...e, ts: Date.parse(`${DAY}T08:00:00`) }));
};

/**
 * A sale entered for 13 Oct. นัด's share is ฿2,061.25; his fertilizer debt
 * of ฿1,500 is dated 27 Oct — recorded before the sale deducts. แดง owes ฿5,000.
 */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  await seedSale(store(), saleOf(SALE));
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance('debt-red', null, { t: 'debt_added', fields: { worker: RED, kind: 'loan', amountSatang: 500_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: NAT, kind: 'fertilizer', amountSatang: 150_000, date: '2026-10-27', note: '', lender: null, fertilizer: { totalSatang: 300_000, workerPct: 50 }, carriedForward: false } });
});

describe('E05-S10 · a sale for an earlier day, part of a later-dated debt taken as separate cash', () => {
  it('AC1: the debt left after this sale is what the sale did not take, not 0', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('deduct-amount', '1000');
    await press('method-buyer-split');
    await press('deduct-save');
    expect(screen.getByTestId(`debt-left-${farm.nat}`)).toHaveTextContent(/500\.00/);
    expect(screen.getByTestId(`say-${farm.nat}`)).toHaveTextContent(/500\.00/);
  });

  it('AC2: the separate cash pile reads plainly', async () => {
    await inSale(<SettlementScreen />);
    expect(screen.getByTestId(`deducted-${farm.nat}`)).toHaveTextContent(/รับคืน: คนรับซื้อยางแยกเป็นเงินสดอีกก้อนให้สวน/);
    expect(screen.getByTestId('cash-today')).toHaveTextContent(/สวนได้รับเงินสดคืนหนี้วันนี้/);
    expect(screen.getByTestId('cash-today')).toHaveTextContent(/เป็นเงินของคนกรีดยางที่หักคืนหนี้ ไม่ใช่ส่วนของสวนจากยอดขาย/);
    expect(screen.getByTestId('cash-today')).toHaveTextContent(/นัด \(คนรับซื้อยางแยกให้อีกก้อน\)\s*1,000\.00/);
  });

  it('AC3: the payment page has a tick for the cash repayment, and it can be ticked and unticked', async () => {
    await inSale(<PaymentScreen />);
    const id = `tick-debt-cash-${farm.nat}`;
    expect(last(id)).toHaveTextContent(/สวนได้รับเงินสดคืนหนี้จากนัดแล้ว/);
    expect(last(id)).toHaveTextContent(/คนรับซื้อยางแยกให้อีกก้อน/);
    expect(last(`tick-amt-debt-cash-${farm.nat}`)).toHaveTextContent('1,000');
    expect(last(id).props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    await press(id);
    expect(last(id).props.accessibilityState).toMatchObject({ checked: true });
    await press(id);
    expect(last(id).props.accessibilityState).toMatchObject({ checked: false });
  });

  it('AC3: no cash tick for a repayment that comes with the owner\'s transfer', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.red}`);
    await press('method-transfer-with-owner');
    await press('deduct-save');
    await inSale(<PaymentScreen />);
    expect(screen.queryByTestId(`tick-debt-cash-${farm.red}`)).toBeNull();
    expect(screen.getAllByTestId(`tick-debt-cash-${farm.nat}`).length).toBeGreaterThan(0);
  });
});
