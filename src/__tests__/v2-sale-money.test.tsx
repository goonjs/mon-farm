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
import { CheckScreen } from '../v2/sale/money-screens';
import { markClosing } from '../v2/sale/pieces';
import { MoneyLines, signed } from '../v2/sale/person-money';
import { PointScreen } from '../v2/sale/point-screen';

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
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace' | 'dismissAll' | 'dismissTo', jest.Mock> };
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
const SALE = 'sale-money';
/** The same sale, already closed. */
const CLOSED = 'sale-money-closed';
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
  const c = new LogBuilder(CLOSED);
  c.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  c.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  c.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: farm.a[0], tareG: 2_000, stdNetG: 50_000 });
  c.acceptAt(farm.a[0], 1);
  c.sys({ t: 'sale_status_set', status: 'completed' });
  await seedSale(store(), c.build().map((e) => ({ ...e, ts: Date.now() })));
  await writeFinance('debt-nat', null, {
    t: 'debt_added',
    fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 150_000, date: '2026-09-01', note: '', lender: { id: FARM_FUNDS, name: 'เงินสวน' }, fertilizer: null, carriedForward: false },
  });
});

describe('v2 sale money (page 16; 17–19 are the close-out, v2-closeout-*)', () => {
  it('check: our figures, one tap "ตรงกันทั้งหมด" records it', async () => {
    await inSale(<CheckScreen />);
    expect(screen.getByTestId('check-weight')).toHaveTextContent(/235 กก\./);
    expect(screen.getByTestId('check-baskets')).toHaveTextContent(/5 เข่ง/);
    expect(screen.getByTestId('check-total')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId(`check-tapper-${farm.red}`)).toHaveTextContent(/150 กก\./);
    // E05-S09: unit in the label line, dots + short count per tapper, whose short basket it is.
    expect(screen.getByTestId('check-total')).not.toHaveTextContent('บาท');
    // per tapper: how many full baskets + the short kg, at which point
    // point total, then indented "full N baskets" and "short N baskets" rows, each with its own kg
    expect(screen.getByTestId(`check-point-${farm.a[3]}`)).toHaveTextContent(/85\sกก\.เต็ม\s1\sเข่ง50\sกก\.ไม่เต็ม\s1\sเข่ง35\sกก\./);
    expect(screen.getByTestId(`check-full-${farm.a[3]}`)).toHaveTextContent(/เต็ม 1 เข่ง.*50 กก\./);
    expect(screen.getByTestId(`check-short-${farm.a[3]}`)).toHaveTextContent(/ไม่เต็ม 1 เข่ง.*35 กก\./);
    expect(screen.getByTestId(`check-point-${farm.a[0]}`)).toHaveTextContent(/150\sกก\.เต็ม\s3\sเข่ง150\sกก\./);
    expect(screen.queryByTestId(`check-short-${farm.a[0]}`)).toBeNull();
    expect(screen.getByTestId('check-card')).toHaveTextContent(/เข่ง 2 · นัด/);
    await doubleTap('check-match');
    expect(screen.getByTestId('check-status').props.accessibilityLabel).toBe('ยอดผู้ขายและคนรับซื้อยางตรงกัน');
    const fin = await financeStore.load();
    expect(fin.filter((e) => e.payload.t === 'buyer_check_set')).toHaveLength(1);
  });

  it('a closed sale is read-only: the check asks nothing (review #2)', async () => {
    const r = wrap(
      <SaleProvider saleId={CLOSED}>
        <CheckScreen />
      </SaleProvider>,
    );
    await flush();
    expect(screen.getByTestId('check-card')).toBeTruthy();
    expect(screen.queryByTestId('check-match')).toBeNull();
    r.unmount();
  });
});

describe('closed sale routes (re-review N3)', () => {
  it('a write screen still mounted under a close does not send it to /payment (N3)', async () => {
    // The picker sits at the bottom of the sale stack; while a close is under way it must stay quiet.
    router.replace.mockClear();
    markClosing(CLOSED);
    wrap(
      <SaleProvider saleId={CLOSED}>
        <PointScreen />
      </SaleProvider>,
    );
    await flush();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('MoneyLines (E05-S09 AC3): + from the farm, − paid out', () => {
  it('signs every line', () => {
    wrap(<MoneyLines personId="p" name="นัด" shareSatang={320_000} paidSatang={150_000} backSatang={64_000} adjustSatang={-50} />);
    expect(screen.getByTestId('pm-p-share')).toHaveTextContent(/\+3,200\.00$/);
    expect(screen.getByTestId('pay-route-p')).toHaveTextContent(/−1,500\.00$/);
    expect(screen.getByTestId('pay-back-p')).toHaveTextContent(/\+640\.00$/);
    expect(screen.getByTestId('pm-p-round')).toHaveTextContent(/−0\.50$/);
  });
  it('hides debt, netting and rounding when there are none', () => {
    wrap(<MoneyLines personId="p" name="นัด" shareSatang={100} paidSatang={0} backSatang={0} adjustSatang={0} />);
    expect(screen.queryByTestId('pay-route-p')).toBeNull();
    expect(screen.queryByTestId('pay-back-p')).toBeNull();
    expect(screen.queryByTestId('pm-p-round')).toBeNull();
  });
  it('writes no sign on zero', () => expect(signed(0)).toBe('0.00'));
});
