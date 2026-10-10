import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { SaleEvent, SysPayload } from '../core/types';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { BackfillScreen } from '../v2/sale/backfill-screen';
import { CounterScreen } from '../v2/sale/counter-screen';
import { PointScreen } from '../v2/sale/point-screen';
import { StartSaleScreen } from '../v2/sale/start-screen';
import { ZeroTareScreen } from '../v2/sale/zero-tare-screen';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/people', () => {
  const { MasterStore } = jest.requireActual('../store/master-store');
  const { createDeviceClock } = jest.requireActual('../store/device-clock');
  const { store } = jest.requireMock('../store/store');
  // One log for sales and farm data, as in the app (latest buyer reads sales).
  return { peopleStore: new MasterStore(store, createDeviceClock(store)) };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismiss: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});

const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;
const store = () => (jest.requireMock('../store/store') as { store: EventStore }).store;
const { router, __params: params } = jest.requireMock('expo-router') as {
  router: Record<'push' | 'replace' | 'back' | 'dismiss', jest.Mock>;
  __params: { current: Record<string, string> };
};

async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const hold = async () => {
  await act(async () => fireEvent(screen.getByTestId('hold'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
  await flush();
};
const sys = (events: readonly SaleEvent[], t: SysPayload['t']) => events.filter((e) => e.kind === 'sys' && e.payload.t === t).map((e) => (e as { payload: SysPayload }).payload);

let farm: MockFarm;
let n = 0;
let saleId = '';

async function inSale(ui: ReactElement, p: Record<string, string> = {}) {
  params.current = p;
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
}

beforeAll(async () => {
  farm = await seedMockFarm(master());
});
beforeEach(() => {
  n += 1;
  saleId = `sale-${n}`;
  jest.clearAllMocks();
});

async function started() {
  const { unmount } = await inSale(<StartSaleScreen />);
  await press('start-next');
  unmount();
}

describe('v2 start a sale (page 5)', () => {
  it('fills the header from farm data and writes it on ถัดไป', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-buyer');
    await press(`start-buyer-${farm.buyer}`);
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/คนรับซื้อยาง ก/);
    expect(screen.getByTestId('start-manager')).toHaveTextContent(/อ\.สมหวัง/);
    expect(screen.getByTestId('start-pair')).toHaveTextContent(/50 กก\./);
    expect(screen.getByTestId('start-scale-decimal1').props.accessibilityState).toMatchObject({ disabled: true });
    await press('start-numbering-per-point');
    await press('start-next');
    const ev = await store().load(saleId);
    expect(sys(ev, 'sale_started')[0]).toMatchObject({ buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: 'อ.สมหวัง' });
    expect(sys(ev, 'numbering_set')[0]).toMatchObject({ numbering: 'per-point' });
    expect(sys(ev, 'price_set')).toEqual([]);
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/point`);
  });

  it('a typed price is written with the header', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-price-row');
    await act(async () => fireEvent.changeText(screen.getByTestId('start-price'), '48.50'));
    await press('sheet-done');
    await press('start-next');
    expect(sys(await store().load(saleId), 'price_set')[0]).toMatchObject({ satangPerKg: 4850 });
  });
});

describe('v2 pick a point and check the empty scale (pages 6, 7, 7a–7c)', () => {
  it('farm → tapper → point are chosen already; a point opens the empty-scale check', async () => {
    await started();
    await inSale(<PointScreen />, { pair: 'builtin-50' });
    await press('pick-farm-' + farm.farmA);
    expect(screen.getByTestId('pick-farm-' + farm.farmA).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('pick-tapper-' + farm.red)).toHaveTextContent(/แดง3 จุด/);
    expect(screen.getByTestId('pick-unassigned')).toHaveTextContent(/จุดใหม่/);
    await press(`pick-point-${farm.a[0]}`);
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/zero-tare?point=${farm.a[0]}&net=50000&basket=2000`);
  });

  it('reads 0 → start: zero check, tare and ready are logged, then the counter', async () => {
    await started();
    await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    expect(screen.getByTestId('expect-kg')).toHaveTextContent(/^52/);
    await press('start-weigh');
    const ev = await store().load(saleId);
    expect(sys(ev, 'pile_added')[0]).toMatchObject({ pileId: farm.a[0], stdNetG: 50_000, tareG: 2_000 });
    expect(sys(ev, 'zero_check')[0]).toMatchObject({ ok: true });
    expect(sys(ev, 'ready')).toHaveLength(1);
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/counter?point=${farm.a[0]}`);
  });

  it('not 0 → accept the skew: what the scale should read includes it on its own line (D-75)', async () => {
    await started();
    await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    await press('zero-not0');
    await press('empty-reading-more');
    await press('choose-skew');
    expect(sys(await store().load(saleId), 'skew_accepted')[0]).toMatchObject({ skewG: 2_000 });
    expect(screen.getByTestId('expect-kg')).toHaveTextContent(/^54/);
    await press('start-weigh');
    expect(router.replace).toHaveBeenCalled();
  });

  it('not 0 → wait for another scale: nothing can be weighed, OK goes back to the check', async () => {
    await started();
    await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    await press('zero-not0');
    await press('choose-wait');
    expect(screen.getByTestId('scale-wait')).toBeTruthy();
    expect(sys(await store().load(saleId), 'scale_wait')).toHaveLength(1);
    await press('wait-ok');
    expect(screen.getByTestId('zero-tare')).toBeTruthy();
  });
});

async function counterAt(pointId: string, extra: Record<string, string> = {}) {
  return inSale(<CounterScreen />, { point: pointId, ...extra });
}

async function readyAt(pointId: string) {
  const { unmount } = await inSale(<ZeroTareScreen />, { point: pointId, net: '50000', basket: '2000' });
  await press('start-weigh');
  unmount();
}

describe('v2 counter (pages 8, 10, 11, 12, 13)', () => {
  it('hold counts a full basket; the figures follow; undo gives the number back', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(screen.getByTestId('current-no')).toHaveTextContent('1');
    expect(screen.getByTestId('should-read')).toHaveTextContent('52 กก.');
    await hold();
    await hold();
    expect(screen.getByTestId('current-no')).toHaveTextContent('3');
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('fig-kg')).toHaveTextContent(/^100/);
    await press('tool-undo');
    expect(screen.getByTestId('current-no')).toHaveTextContent('2');
  });

  it('a short basket: reading − basket = net; it stays open and waits, or closes as is', async () => {
    await started();
    await readyAt(farm.a[3]);
    await counterAt(farm.a[3]);
    await hold();
    await press('tool-short');
    expect(screen.getByTestId('reading')).toHaveTextContent(/^37/);
    expect(screen.getByTestId('short-net')).toHaveTextContent(/^35/);
    await press('short-save');
    const ev = await store().load(saleId);
    expect(ev.find((e) => e.kind === 'short')).toMatchObject({ readingG: 37_000, tareG: 2_000, basketNo: 2 });
    expect(screen.getByTestId('open-card')).toHaveTextContent(/เข่ง 2 เปิดอยู่ · 35 กก\./);
    expect(screen.getByTestId('fig-missing')).toHaveTextContent(/^15/);
    expect(screen.getByTestId('stage-wait')).toHaveTextContent(/เข่ง 2 รอเติม/);
    await press('close-open');
    expect(screen.queryByTestId('open-card')).toBeNull();
    expect(screen.getByTestId('current-no')).toHaveTextContent('3');
  });

  it('a reading at or below the basket is refused', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('tool-short');
    for (let i = 0; i < 40; i++) await act(async () => fireEvent.press(screen.getByTestId('reading-less')));
    expect(screen.getByTestId('reading')).toHaveTextContent(/^3/);
    expect(screen.queryByTestId('short-too-low')).toBeNull();
  });

  it('same tapper\'s next point asks; fill up there closes it as a full basket (D-57)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    expect(screen.getByTestId('fill-sheet')).toHaveTextContent(/เข่ง 2 ยังไม่เต็ม/);
    await press('fill-full');
    expect(router.replace).toHaveBeenLastCalledWith(`/v2/sale/${saleId}/zero-tare?point=${farm.a[1]}&net=50000&basket=2000&fill=full`);
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'full' });
    expect(screen.getByTestId('hold')).toHaveTextContent(/เติมเข่ง 2/);
    expect(screen.getByTestId('should-read')).toHaveTextContent('52 กก.');
    await hold();
    const part = (await store().load(saleId)).filter((e) => e.kind === 'accept').pop();
    expect(part).toMatchObject({ pointId: farm.a[1], basketNo: 2, netG: 15_000 });
    expect(screen.getByTestId('current-no')).toHaveTextContent('3');
    expect(screen.queryByTestId('fig-missing')).toBeNull();
    expect(screen.getByTestId('fig-kg')).toHaveTextContent(/^100/);
  });

  it('another tapper\'s point closes the open basket without asking (SALE-12)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.nat });
    await press(`pick-point-${farm.a[3]}`);
    expect(screen.queryByTestId('fill-sheet')).toBeNull();
    expect(sys(await store().load(saleId), 'basket_closed')[0]).toMatchObject({ reason: 'tapper-change' });
  });
});

describe('v2 backfill (page 14, E04-S10)', () => {
  it('numbers run on from the tapper last basket; the baskets count and are labelled', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await hold();
    c.unmount();
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    await act(async () => fireEvent.changeText(screen.getByTestId('backfill-full'), '3'));
    await act(async () => fireEvent.changeText(screen.getByTestId('backfill-short'), '20'));
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/จะได้ 4 เข่ง/);
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/เข่งที่ 3–5/);
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/เข่งที่ 6/);
    expect(screen.getByTestId('backfill-total')).toHaveTextContent(/170 กก\./);
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/ต่อจากเข่งล่าสุดของแดง \(2\)/);
    await press('backfill-save');
    const ev = await store().load(saleId);
    expect(ev.filter((e) => e.kind === 'accept' && e.input === 'backfill').map((e) => (e as { basketNo: number }).basketNo)).toEqual([3, 4, 5]);
    expect(ev.find((e) => e.kind === 'short')).toMatchObject({ basketNo: 6, backfill: true, readingG: 22_000 });
    expect(router.dismiss).toHaveBeenCalledWith(2);
  });

  it('a count that is not a whole number is refused', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    await act(async () => fireEvent.changeText(screen.getByTestId('backfill-full'), '2.5'));
    expect(screen.getByTestId('backfill-bad-count')).toBeTruthy();
    expect(screen.getByTestId('backfill-save').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('v2 counter edge cases (pages 8a, 12b)', () => {
  it('a point with no tapper weighs on, with a warning (D-63)', async () => {
    await started();
    await readyAt(farm.a[4]);
    await counterAt(farm.a[4]);
    expect(screen.getByTestId('no-tapper')).toHaveTextContent(/จุดนี้ยังไม่มีคนกรีดยาง/);
    await hold();
    expect(screen.getByTestId('current-no')).toHaveTextContent('2');
  });

  it('a point deleted while the sale is open must be replaced before weighing on (D-65, D-67)', async () => {
    await started();
    await readyAt(farm.a[2]);
    const c = await counterAt(farm.a[2]);
    await hold();
    c.unmount();
    await master().remove(farm.a[2]);
    await counterAt(farm.a[2]);
    expect(screen.getByTestId('point-gone')).toHaveTextContent(/จุด 3 ถูกลบแล้ว/);
    expect(screen.getByTestId('point-gone')).toHaveTextContent(/เข่ง 1 \(50 กก\.\)/);
    await press(`gone-pick-${farm.a[0]}`);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining(`point=${farm.a[0]}`));
    await master().restore(farm.a[2]);
  });
});
