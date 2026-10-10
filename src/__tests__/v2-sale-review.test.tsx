/**
 * Review fixes on the v2 sale flow (PR #81): public mode respects an open
 * short basket, a closed sale is read-only, a switch leaves no old counter
 * behind, the counter needs a passed check, the hold works by timer, early
 * release and an AT/keyboard click, a top-up uses its own basket, the start
 * pair is in the log, and a negative skew keeps its sign.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { SaleEvent, SysPayload } from '../core/types';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CounterScreen } from '../v2/sale/counter-screen';
import { HoldStage } from '../v2/sale/hold';
import { PointScreen } from '../v2/sale/point-screen';
import { PublicScreen } from '../v2/sale/public-screen';
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
  return { peopleStore: new MasterStore(store, createDeviceClock(store)) };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismiss: jest.fn(), dismissAll: jest.fn() };
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
  router: Record<'push' | 'replace' | 'dismiss', jest.Mock>;
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
const activate = async (id = 'hold') => {
  await act(async () => fireEvent(screen.getByTestId(id), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
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
async function started() {
  const { unmount } = await inSale(<StartSaleScreen />);
  await press('start-next');
  unmount();
}
async function readyAt(pointId: string) {
  const { unmount } = await inSale(<ZeroTareScreen />, { point: pointId, net: '50000', basket: '2000' });
  await press('start-weigh');
  unmount();
}
/** A short basket of 35 kg open at `pointId`. */
async function openShortAt(pointId: string) {
  const c = await inSale(<CounterScreen />, { point: pointId });
  await press('tool-short');
  await press('short-save');
  c.unmount();
}
const events = () => store().load(saleId);

beforeAll(async () => {
  farm = await seedMockFarm(master());
});
beforeEach(() => {
  n += 1;
  saleId = `sale-r${n}`;
  jest.clearAllMocks();
});

describe('#1 public mode shares the counter\'s count', () => {
  it('waits, not counts, while the short basket is open at this point', async () => {
    await started();
    await readyAt(farm.a[0]);
    await openShortAt(farm.a[0]);
    await inSale(<PublicScreen />, { point: farm.a[0] });
    expect(screen.queryByTestId('public-hold')).toBeNull();
    expect(screen.getByTestId('public-wait')).toHaveTextContent(/เข่ง 1 รอเติม/);
  });

  it('at the next point it tops the open basket up, as the counter does', async () => {
    await started();
    await readyAt(farm.a[0]);
    await openShortAt(farm.a[0]);
    await readyAt(farm.a[1]);
    await inSale(<PublicScreen />, { point: farm.a[1], fill: 'full' });
    expect(screen.getByTestId('public-no')).toHaveTextContent('1');
    await activate('public-hold');
    const part = (await events()).filter((e) => e.kind === 'accept').pop();
    expect(part).toMatchObject({ basketNo: 1, netG: 15_000, partOf: expect.any(String) });
  });
});

describe('#2 a closed sale is read-only', () => {
  it('the counter sends a completed sale to its payment and offers no hold', async () => {
    await started();
    await readyAt(farm.a[0]);
    const { append } = { append: null };
    void append;
    await inSale(<CounterScreen />, { point: farm.a[0] });
    await activate();
    // Complete it: price + status, as the payment screen does.
    const all = await events();
    const last = all[all.length - 1];
    for (const [i, payload] of ([{ t: 'price_set', satangPerKg: 5000, indexRef: '' }, { t: 'sale_status_set', status: 'completed' }] as SysPayload[]).entries()) {
      await store().insertPulled({ ...last, id: `${saleId}-close-${i}`, seq: last.seq + 1 + i, deviceSeq: 9_000 + n * 10 + i, kind: 'sys', payload } as SaleEvent);
    }
    await inSale(<CounterScreen />, { point: farm.a[0] });
    expect(screen.queryByTestId('hold')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/payment`);
  });
});

describe('#3 เปลี่ยนจุด leaves no old counter on the stack', () => {
  it('drops the picker and the old counter before opening the new point', async () => {
    await started();
    await readyAt(farm.a[0]);
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    expect(router.dismiss).toHaveBeenCalledWith(1);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining(`point=${farm.a[1]}`));
  });
});

describe('#11 the counter needs a passed check (canCount)', () => {
  it('a point whose check failed cannot be counted from a deep link', async () => {
    await started();
    const z = await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    await press('zero-not0');
    await press('choose-wait');
    z.unmount();
    await inSale(<CounterScreen />, { point: farm.a[0] });
    expect(screen.queryByTestId('hold')).toBeNull();
    expect(screen.getByTestId('not-ready')).toBeTruthy();
  });
});

describe('#9 a top-up that falls short weighs its own basket', () => {
  it('uses the open basket\'s tare, not the new point\'s', async () => {
    await started();
    await readyAt(farm.a[0]);
    await openShortAt(farm.a[0]);
    // The next point weighs with a 60 + 3 pair.
    const z = await inSale(<ZeroTareScreen />, { point: farm.a[1], net: '60000', basket: '3000' });
    await press('start-weigh');
    z.unmount();
    await inSale(<CounterScreen />, { point: farm.a[1], fill: 'full' });
    await press('tool-short');
    // Whole basket: 2 kg basket + 35 already + 10 more = 47.
    for (let i = 0; i < 60; i++) await act(async () => fireEvent.press(screen.getByTestId('reading-less')));
    for (let i = 0; i < 44; i++) await act(async () => fireEvent.press(screen.getByTestId('reading-more')));
    expect(screen.getByTestId('reading')).toHaveTextContent(/^47/);
    expect(screen.getByTestId('short-net')).toHaveTextContent(/10 กก\./);
    await press('short-save');
    const part = (await events()).filter((e) => e.kind === 'short').pop();
    expect(part).toMatchObject({ readingG: 47_000, tareG: 37_000 });
  });
});

describe('#10 the start pair is in the log', () => {
  it('a new point weighs with the pair picked at the start, URL or not', async () => {
    const s = await inSale(<StartSaleScreen />);
    await press('start-pair');
    await press('start-pair-builtin-60');
    await press('start-next');
    s.unmount();
    expect(sys(await events(), 'pair_set')[0]).toMatchObject({ netG: 60_000, basketG: 3_000 });
    await inSale(<PointScreen />, {});
    await press('pick-farm-' + farm.farmA);
    await press(`pick-point-${farm.a[0]}`);
    expect(router.push).toHaveBeenLastCalledWith(expect.stringContaining('net=60000&basket=3000'));
  });
});

describe('#12 a negative skew keeps its sign', () => {
  it('shows −1 on the check and the counter, and 51 to read', async () => {
    await started();
    const z = await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    await press('zero-not0');
    await press('empty-reading-less');
    await press('choose-skew');
    expect(screen.getByTestId('expect-skew')).toHaveTextContent(/−1 กก\./);
    expect(screen.getByTestId('expect-kg')).toHaveTextContent(/^51/);
    await press('start-weigh');
    z.unmount();
    await inSale(<CounterScreen />, { point: farm.a[0] });
    expect(screen.getByTestId('hold')).toHaveTextContent(/ค่าเบี้ยว −1/);
    expect(screen.getByTestId('should-read')).toHaveTextContent('51 กก.');
  });
});

describe('#8 hold-to-count: timer, early release, AT and keyboard', () => {
  const setup = () => {
    const onHold = jest.fn();
    const onEarly = jest.fn();
    wrap(
      <HoldStage label="กดค้าง" onHold={onHold} onEarly={onEarly}>
        {null}
      </HoldStage>,
    );
    return { onHold, onEarly };
  };
  const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));

  it('held for the hold time counts once', async () => {
    const { onHold, onEarly } = setup();
    fireEvent(screen.getByTestId('hold'), 'pressIn', { nativeEvent: {} });
    await wait(800);
    fireEvent(screen.getByTestId('hold'), 'pressOut', { nativeEvent: {} });
    expect(onHold).toHaveBeenCalledWith('hold');
    expect(onEarly).not.toHaveBeenCalled();
  });

  it('let go early counts nothing and reports the attempt', async () => {
    const { onHold, onEarly } = setup();
    fireEvent(screen.getByTestId('hold'), 'pressIn', { nativeEvent: {} });
    await wait(100);
    fireEvent(screen.getByTestId('hold'), 'pressOut', { nativeEvent: {} });
    await wait(800);
    expect(onHold).not.toHaveBeenCalled();
    expect(onEarly).toHaveBeenCalledTimes(1);
  });

  it('a screen-reader click (web, detail 0) counts as hold-kbd', async () => {
    const { onHold } = setup();
    fireEvent(screen.getByTestId('hold'), 'press', { nativeEvent: { detail: 0 } });
    expect(onHold).toHaveBeenCalledWith('hold-kbd');
  });

  it('Enter or Space counts once, with no early-release record', async () => {
    const { onHold, onEarly } = setup();
    fireEvent(screen.getByTestId('hold'), 'pressIn', { nativeEvent: { key: 'Enter' } });
    fireEvent(screen.getByTestId('hold'), 'pressOut', { nativeEvent: { key: 'Enter' } });
    fireEvent(screen.getByTestId('hold'), 'press', { nativeEvent: { key: 'Enter', detail: 0 } });
    await wait(800);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledWith('hold-kbd');
    expect(onEarly).not.toHaveBeenCalled();
  });

  it('a mouse click after a full hold does not count twice', async () => {
    const { onHold } = setup();
    fireEvent(screen.getByTestId('hold'), 'pressIn', { nativeEvent: {} });
    await wait(800);
    fireEvent(screen.getByTestId('hold'), 'pressOut', { nativeEvent: {} });
    fireEvent(screen.getByTestId('hold'), 'press', { nativeEvent: { detail: 1 } });
    expect(onHold).toHaveBeenCalledTimes(1);
  });
});
