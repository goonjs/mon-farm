import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { homeSales } from '../core/home';
import { LogBuilder } from '../core/fixtures';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
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

const started = (id: string) => {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: 'อ.สมหวัง', workerLead: '', where: 'farm' });
  b.sys({ t: 'pair_set', netG: 50_000, basketG: 2_000 });
  return b;
};
const seed = (id: string, b: LogBuilder) => seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
const log = async (id: string) => store().load(id);

beforeAll(async () => {
  farm = await seedMockFarm(master());
});

describe('sale options in the ⋯ menu (agreed price, info, delete)', () => {
  const SALE = 'sale-opts';
  beforeAll(async () => {
    const b = started(SALE);
    b.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: 'จุด 1', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2);
    await seed(SALE, b);
  });
  const inSale = () => mount(<SaleProvider saleId={SALE}><PointScreen /></SaleProvider>);

  it('adds the agreed price, then shows it in the menu and in the info', async () => {
    await inSale();
    await press('pick-menu');
    expect(screen.getByTestId('menu-price')).toHaveTextContent(/ใส่ราคาที่ตกลง/);
    await press('menu-price');
    await act(async () => fireEvent.changeText(screen.getByTestId('option-price'), '52.50'));
    await press('option-price-save');
    const prices = (await log(SALE)).filter((e) => e.kind === 'sys' && e.payload.t === 'price_set');
    expect(prices).toHaveLength(1);
    expect(prices[0].kind === 'sys' && prices[0].payload.t === 'price_set' && prices[0].payload.satangPerKg).toBe(5250);
    await press('pick-menu');
    expect(screen.getByTestId('menu-price')).toHaveTextContent(/52\.50/);
  });

  it('a bad price is not saved', async () => {
    await inSale();
    await press('pick-menu');
    await press('menu-price');
    await act(async () => fireEvent.changeText(screen.getByTestId('option-price'), '12abc'));
    await press('option-price-save');
    expect((await log(SALE)).filter((e) => e.kind === 'sys' && e.payload.t === 'price_set')).toHaveLength(1);
  });

  it('shows the sale info: buyer, manager, price, basket pair, weighed so far', async () => {
    await inSale();
    await press('pick-menu');
    await press('menu-info');
    expect(screen.getByTestId('info-buyer')).toHaveTextContent(/คนรับซื้อยาง ก/);
    expect(screen.getByTestId('info-manager')).toHaveTextContent(/อ\.สมหวัง/);
    expect(screen.getByTestId('info-price')).toHaveTextContent(/52\.50/);
    expect(screen.getByTestId('info-pair')).toHaveTextContent(/50.*2/);
    expect(screen.getByTestId('info-weighed')).toHaveTextContent(/2 เข่ง/);
  });

  it('deletes a stray open sale after a confirm, and the home no longer finds it open', async () => {
    router.replace.mockClear();
    await inSale();
    await press('pick-menu');
    await press('menu-delete');
    expect(screen.getByTestId('delete-sheet')).toBeTruthy();
    await press('delete-confirm');
    expect((await log(SALE)).some((e) => e.kind === 'delete' && e.targetId === SALE)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/v2');
    const open = homeSales(await Promise.all((await store().listSales()).map(async (id) => ({ id, events: await log(id) })))).open;
    expect(open?.id).not.toBe(SALE);
  });
});
