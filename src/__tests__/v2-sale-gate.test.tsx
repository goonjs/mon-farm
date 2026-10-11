import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import type { MasterStore } from '../store/master-store';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { StartSaleGate } from '../v2/sale/start-screen';

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
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace', jest.Mock> };

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
const mount = async (ui: ReactElement) => {
  const r = wrap(ui);
  await flush();
  return r;
};

let farm: MockFarm;

const T = 1_780_000_000_000;
/** A sale that starts at T + `at`; `more` adds its events. */
const seedAt = async (id: string, at: number, more: (b: LogBuilder) => void = () => undefined) => {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: '', workerLead: '', where: 'farm' });
  more(b);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: T + at })));
};
const weighing = (b: LogBuilder) => {
  b.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: 'จุด 1', tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1);
};

beforeAll(async () => {
  farm = await seedMockFarm(master());
});
beforeEach(() => router.replace.mockClear());

describe('one open sale at a time: เริ่มการขาย', () => {
  it('no sale yet: the start form', async () => {
    await mount(<StartSaleGate />);
    expect(screen.getByTestId('sale-start')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a closed sale is not open: the start form', async () => {
    await seedAt('sale-closed', 100, (b) => {
      weighing(b);
      b.sys({ t: 'price_set', satangPerKg: 5000, indexRef: '' });
      b.sys({ t: 'sale_status_set', status: 'completed' });
    });
    await mount(<StartSaleGate />);
    expect(screen.getByTestId('sale-start')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a deleted sale is not open: the start form', async () => {
    await seedAt('sale-deleted', 200, (b) => b.remove('sale-deleted'));
    await mount(<StartSaleGate />);
    expect(screen.getByTestId('sale-start')).toBeTruthy();
  });

  it('a cancelled sale is not open: the start form', async () => {
    await seedAt('sale-cancelled', 300, (b) => b.sys({ t: 'sale_status_set', status: 'cancelled' }));
    await mount(<StartSaleGate />);
    expect(screen.getByTestId('sale-start')).toBeTruthy();
  });

  it('an open sale with no point yet opens at the point picker', async () => {
    await seedAt('sale-old', 1_000);
    await mount(<StartSaleGate />);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/v2/sale/sale-old/point');
    expect(screen.queryByTestId('sale-start')).toBeNull();
  });

  it('two open sales (two phones both started one): the newest wins, at the counter of its point', async () => {
    await seedAt('sale-new', 2_000, weighing);
    await mount(<StartSaleGate />);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/sale-new/counter?point=${farm.a[0]}`);
    expect(await store().listSales()).toEqual(expect.arrayContaining(['sale-old', 'sale-new']));
  });

  it('when the sales cannot be read it starts nothing: an error and a retry, then it opens the open sale', async () => {
    const spy = jest.spyOn(store(), 'listSales').mockRejectedValueOnce(new Error('disk'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await mount(<StartSaleGate />);
    expect(screen.getByTestId('sale-start-failed')).toBeTruthy();
    expect(screen.queryByTestId('sale-start')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    await press('sale-start-retry');
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/sale-new/counter?point=${farm.a[0]}`);
    spy.mockRestore();
    err.mockRestore();
  });
});
