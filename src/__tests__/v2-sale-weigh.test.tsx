import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';

import type { SaleEvent, SysPayload } from '../core/types';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { LogBuilder } from '../core/fixtures';
import { wrap } from '../test/render';
import { writeCountMode } from '../store/hold-preference';
import { readWeighBasis, writeWeighBasis, writeWeighMode } from '../store/weigh-mode-preference';
import { BackfillScreen } from '../v2/sale/backfill-screen';
import { countModel } from '../v2/sale/count';
import { CounterScreen } from '../v2/sale/counter-screen';
import { figSize, useSaleView } from '../v2/sale/pieces';
import { HistoryScreen } from '../v2/sale/history-screen';
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
const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
/** Press and hold a tool button: down, wait, up — the undo button counts like the count stage (E04-S15). */
const holdTool = async (id: string, ms: number) => {
  fireEvent(screen.getByTestId(id), 'pressIn', { nativeEvent: {} });
  await wait(ms);
  fireEvent(screen.getByTestId(id), 'pressOut', { nativeEvent: {} });
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

// The device preference stores use localStorage, as on web; React Native's test env has none.
const mockStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => void mockStorage.set(k, v),
    removeItem: (k: string) => void mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  },
});
/** The short-basket sheet starts in typing mode (E04-S16); the dial tests ask for the dial. */
const useDial = (basis: 'scale' | 'net' = 'scale') => {
  writeWeighMode('dial');
  writeWeighBasis(basis);
};

beforeAll(async () => {
  farm = await seedMockFarm(master());
});
beforeEach(() => {
  mockStorage.clear();
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
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 1$/);
    expect(screen.getByTestId('should-read')).toHaveTextContent('52 กก.');
    await hold();
    await hold();
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('fig-kg')).toHaveTextContent(/^100/);
    await holdTool('tool-undo', 900);
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 2$/);
  });

  it('a short basket: reading − basket = net; it stays open and waits, or closes as is', async () => {
    useDial();
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
    // One line: a bar of the rubber held against a full basket, the scale reading small (owner 2026-10-18).
    expect(screen.getByTestId('open-card')).toHaveTextContent(/เข่ง 2.*35 \/ 50 กก\..*ตาชั่ง 37/);
    expect(screen.getByTestId('open-bar').props.accessibilityValue).toMatchObject({ now: 70, min: 0, max: 100 });
    expect(screen.getByTestId('current-short')).toHaveTextContent('+35 กก.');
    expect(screen.queryByTestId('current-no')).toBeNull();
    expect(screen.getByTestId('fig-missing')).toHaveTextContent(/^15/);
    // The point is finished (owner 2026-10-17): no finish button, no hold, no hint. The switch-point button is the one at the top (owner 2026-10-18: no second button here).
    expect(screen.queryByText(/รอเติม/)).toBeNull();
    expect(screen.queryByTestId('next-point')).toBeNull();
    expect(screen.queryByTestId('close-open')).toBeNull();
    expect(screen.queryByTestId('hold')).toBeNull();
    // The only way on is undo: the short basket goes, the number comes back.
    await holdTool('tool-undo', 900);
    expect(screen.queryByTestId('open-card')).toBeNull();
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 2$/);
    await hold();
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^2/);
  });

  it('another point left: no summary button and no next-point button, the switch-point button does the job (E04-S18)', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('tool-short');
    await press('short-save');
    expect(screen.queryByTestId('to-summary')).toBeNull();
    expect(screen.queryByTestId('next-point')).toBeNull();
    await press('switch-point');
    expect(router.push).toHaveBeenLastCalledWith(expect.stringContaining('/point?mode=switch'));
  });

  it('at the last point one full-width summary button goes to the review; there is no next-point button (E04-S18)', async () => {
    await started();
    for (const id of [...farm.a.slice(1), farm.b1]) {
      await readyAt(id);
      const c = await counterAt(id);
      await hold();
      c.unmount();
    }
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('tool-short');
    await press('short-save');
    expect(screen.queryByTestId('next-point')).toBeNull();
    expect(screen.getByTestId('to-summary')).toHaveTextContent('ชั่งครบแล้ว → ตรวจยอด');
    await press('to-summary');
    expect(router.push).toHaveBeenLastCalledWith(`/v2/sale/${saleId}/check`);
  });

  it('option 3 closes nothing until a full basket is counted, and can be re-chosen (E04-S17)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    await press('fill-next');
    expect(sys(await store().load(saleId), 'basket_closed')).toHaveLength(0);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining('fill=next'));
    // Back to the picker before counting: the sheet asks again and option 1 still works.
    await press(`pick-point-${farm.a[1]}`);
    expect(screen.getByTestId('fill-sheet')).toBeTruthy();
    expect(screen.getByTestId('fill-full')).toBeTruthy();
    expect(screen.getByTestId('fill-part')).toBeTruthy();
    expect(screen.getByTestId('fill-next')).toBeTruthy();
    await press('fill-next');
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'next' });
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
    await hold();
    const ev = await store().load(saleId);
    expect(screen.queryByTestId('fig-missing')).toBeNull();
    expect(ev.filter((e) => e.kind === 'accept').pop()).toMatchObject({ pointId: farm.a[1], basketNo: 3, netG: 50_000 });
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 4$/);
  });

  it('in tap mode the undo button still needs a hold (E04-S17)', async () => {
    writeCountMode('tap');
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('hold');
    await press('tool-undo');
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^1/);
    await holdTool('tool-undo', 900);
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^0/);
  });

  it('the card leads with the counted figure; the next basket is the small line (E04-S17)', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    expect(screen.getByTestId('current-done')).toHaveTextContent('1');
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 2$/);
    expect(screen.getByTestId('hold')).toHaveTextContent(/กดค้างเพื่อนับเข่งเต็ม 2/);
  });

  it('in tap mode one tap counts and the label says tap (E04-S17)', async () => {
    writeCountMode('tap');
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(screen.getByTestId('hold')).toHaveTextContent(/แตะเพื่อนับเข่งเต็ม 1/);
    await press('hold');
    expect(screen.getByTestId('fig-done')).toHaveTextContent(/^1/);
  });

  it('a reading at or below the basket is refused', async () => {
    useDial();
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
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
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
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 2$/);
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

  it('back to a point already weighed goes straight to its counter; the count goes on (owner 2026-10-10)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await hold();
    await hold();
    c.unmount();
    // To จุด 2: new to the sale, so its empty scale is checked.
    const p = await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining(`/zero-tare?point=${farm.a[1]}`));
    p.unmount();
    await readyAt(farm.a[1]);
    // Back to จุด 1: no check, its counter at once.
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[0]}`);
    expect(router.replace).toHaveBeenLastCalledWith(`/v2/sale/${saleId}/counter?point=${farm.a[0]}`);
    await counterAt(farm.a[0]);
    expect(screen.getAllByTestId('current-no').pop()).toHaveTextContent(/เข่งถัดไป 4$/);
    await hold();
    const nos = (await store().load(saleId)).filter((e) => e.kind === 'accept').map((e) => (e as { basketNo: number }).basketNo);
    expect(nos).toEqual([1, 2, 3, 4]);
  });
});

describe('v2 counter toolbar, hold-to-undo, history (E04-S15)', () => {
  it('the tools are ย้อนกลับ · ประวัติ · เข่งไม่เต็ม (short basket at the right edge); public mode is in the menu', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(screen.getAllByTestId(/^tool-(undo|history|short|public)$/).map((x) => x.props.testID)).toEqual(['tool-undo', 'tool-history', 'tool-short']);
    expect(screen.queryByTestId('tool-public')).toBeNull();
    await press('counter-menu');
    await press('menu-public');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/public?point=${farm.a[0]}`);
  });

  it('the history tool opens the basket list of this sale at this point', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('tool-history');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/history?point=${farm.a[0]}`);
  });

  it('undo needs the hold: a tap or a release before the time does nothing; a full hold undoes, and the number is used again', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    await hold();
    await hold();
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 4$/);
    await press('tool-undo');
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 4$/);
    await holdTool('tool-undo', 150);
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 4$/);
    await holdTool('tool-undo', 900);
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
    expect(screen.getByTestId('undo-notice')).toHaveTextContent('ย้อนกลับเข่ง 3 แล้ว — เข่งถัดไปคือ 3');
    await hold();
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 4$/);
    expect(screen.queryByTestId('undo-notice')).toBeNull();
    const ev = await store().load(saleId);
    expect(ev.filter((e) => e.kind === 'correction')).toHaveLength(1);
  });

  it('the undo button names the basket it would take back; a count says what it recorded', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(screen.getByTestId('tool-undo')).not.toHaveTextContent(/เข่ง \d/);
    await hold();
    expect(screen.getByTestId('count-notice')).toHaveTextContent('บันทึกเข่ง 1 · 50 กก.');
    expect(screen.getByTestId('tool-undo')).toHaveTextContent(/กดค้าง · เข่ง 1$/);
    await hold();
    expect(screen.getByTestId('count-notice')).toHaveTextContent('บันทึกเข่ง 2 · 50 กก.');
    expect(screen.getByTestId('tool-undo')).toHaveTextContent(/กดค้าง · เข่ง 2$/);
  });

  it('a keyboard or screen-reader activate on undo asks first; yes takes the basket back, no leaves it', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    await hold();
    await act(async () => fireEvent(screen.getByTestId('tool-undo'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
    await flush();
    expect(screen.getByTestId('undo-confirm')).toHaveTextContent(/ย้อนกลับเข่ง 2 ไหม/);
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
    await press('undo-confirm-no');
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 3$/);
    await act(async () => fireEvent(screen.getByTestId('tool-undo'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
    await flush();
    await press('undo-confirm-yes');
    expect(screen.getByTestId('current-no')).toHaveTextContent(/เข่งถัดไป 2$/);
    expect(screen.getByTestId('undo-notice')).toHaveTextContent(/ย้อนกลับเข่ง 2 แล้ว/);
  });

  it('filling a short basket: the notice says the part recorded; undoing that part is asked about as a part, with its own weight', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    await press('fill-full');
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'full' });
    await hold();
    expect(screen.getByTestId('count-notice')).toHaveTextContent('บันทึกเข่ง 2 · 15 กก.');
    await act(async () => fireEvent(screen.getByTestId('tool-undo'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
    await flush();
    expect(screen.getByTestId('undo-confirm')).toHaveTextContent(/ยกเลิกส่วนที่เติมของเข่ง 2 ไหม/);
    expect(screen.getByTestId('undo-confirm')).toHaveTextContent(/ส่วนที่เติม 15 กก\./);
    await press('undo-confirm-yes');
    expect(screen.getByTestId('undo-notice')).toHaveTextContent(/ยกเลิกส่วนที่เติมของเข่ง 2 แล้ว/);
  });

  it('a count that is refused records nothing and says nothing; one that records says what it wrote', async () => {
    await started();
    await readyAt(farm.a[0]);
    const probeRef: { current: ReturnType<typeof countModel> } = { current: null };
    const Probe = () => {
      const model = countModel(useSaleView(), farm.a[0]);
      // Written in an effect: render must not mutate a value from outside.
      useEffect(() => {
        probeRef.current = model;
      });
      return null;
    };
    const c = await inSale(<Probe />);
    expect(probeRef.current!.count('hold')).toEqual({ basketNo: 1, netG: 50_000 });
    c.unmount();
    const d = await inSale(<CounterScreen />, { point: farm.a[0] });
    await press('tool-short');
    await press('short-save');
    d.unmount();
    const before = (await store().load(saleId)).length;
    await inSale(<Probe />);
    // The short basket waits at its own point: the point is finished, a hold has nothing to write.
    expect(probeRef.current!.waiting).toBe(true);
    expect(probeRef.current!.count('hold')).toBeNull();
    await flush();
    expect((await store().load(saleId)).length).toBe(before);
  });

  it('a notice from one point does not follow you to the next', async () => {
    await started();
    await readyAt(farm.a[0]);
    await readyAt(farm.a[1]);
    const c = await counterAt(farm.a[0]);
    await hold();
    expect(screen.getByTestId('count-notice')).toBeTruthy();
    c.unmount();
    await counterAt(farm.a[1]);
    expect(screen.queryByTestId('count-notice')).toBeNull();
  });

  it('a progress bar runs while the undo button is held, like the count stage', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    fireEvent(screen.getByTestId('tool-undo'), 'pressIn', { nativeEvent: {} });
    expect(screen.getByTestId('tool-undo-progress')).toBeTruthy();
    fireEvent(screen.getByTestId('tool-undo'), 'pressOut', { nativeEvent: {} });
    await flush();
  });

  it('with nothing to undo the button is disabled', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(screen.getByTestId('tool-undo').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('v2 basket history (page 8d, E04-S15)', () => {
  const rowsOf = () => screen.queryAllByTestId(/^hist-row-/).map((r) => r.props.testID as string);

  it('newest first; each row has the number, the kind, the kg, the place, the tapper and the time to the second', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    await hold();
    await press('tool-short');
    await press('short-save');
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    const ids = rowsOf();
    expect(ids).toHaveLength(3);
    const first = screen.getByTestId(ids[0]);
    expect(first).toHaveTextContent(/^3/);
    expect(first).toHaveTextContent(/ไม่เต็ม/);
    expect(first).toHaveTextContent(/ตาชั่งอ่าน 37 − เข่ง 2 = 35 กก\./);
    expect(first).toHaveTextContent(/จันทเขลม · จุด 1/);
    expect(first).toHaveTextContent(/แดง/);
    expect(first).toHaveTextContent(/\d\d:\d\d:\d\d/);
    expect(screen.getByTestId(ids[2])).toHaveTextContent(/เต็ม/);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/เต็ม 2 เข่ง/);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/ไม่เต็ม 1 เข่ง/);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/รวม 135 กก\./);
    expect(screen.getByTestId('hist-equation')).toHaveTextContent('2 × 50 + 35 = 135 กก.');
    expect(screen.getByTestId('hist-numbers-ok')).toBeTruthy();
    expect(screen.getByTestId(`hist-cum-${ids[0].replace('hist-row-', '')}`)).toHaveTextContent('สะสม 135 กก.');
    expect(screen.getByTestId(`hist-cum-${ids[2].replace('hist-row-', '')}`)).toHaveTextContent('สะสม 50 กก.');
  });

  it('an undone basket stays in the list, marked with when it was taken back; it is not in the totals and its number is used again', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await hold();
    await hold();
    await holdTool('tool-undo', 900);
    await hold();
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    const ids = rowsOf();
    expect(ids).toHaveLength(3);
    expect(screen.getAllByText(/ถูกย้อนกลับ \d\d:\d\d:\d\d/)).toHaveLength(1);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/เต็ม 2 เข่ง/);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/รวม 100 กก\./);
    expect(screen.getByTestId('hist-numbers-ok')).toBeTruthy();
  });

  it('a joined basket keeps its full/short word and adds the joined tag with the parts (20 + 30 style)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    await press('fill-full');
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'full' });
    await hold();
    await inSale(<HistoryScreen />, { point: farm.a[1] });
    const row = screen.getByTestId(rowsOf()[0]);
    expect(row).toHaveTextContent(/เต็ม/);
    expect(row).toHaveTextContent(/เข่งเชื่อม/);
    expect(row).toHaveTextContent(/\(35 \+ 15\) กก\./);
    await press('hist-kind-short');
    expect(screen.getByTestId('hist-filter-empty')).toBeTruthy();
  });

  it('baskets at a point with no tapper are reachable under everyone', async () => {
    await started();
    await readyAt(farm.a[0]);
    await readyAt(farm.a[4]);
    await counterAt(farm.a[0]);
    await hold();
    await counterAt(farm.a[4]);
    await hold();
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(rowsOf()).toHaveLength(2);
    await press(`hist-tapper-${farm.red}`);
    expect(rowsOf()).toHaveLength(1);
    await press('hist-tapper-all');
    expect(rowsOf()).toHaveLength(2);
  });

  it('the list starts with everyone; a tapper chip narrows it; the kind filter narrows further; clear resets', async () => {
    await started();
    await readyAt(farm.a[0]);
    await readyAt(farm.a[3]);
    await counterAt(farm.a[0]);
    await hold();
    await counterAt(farm.a[3]);
    await hold();
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(rowsOf()).toHaveLength(2);
    await press(`hist-tapper-${farm.red}`);
    expect(rowsOf()).toHaveLength(1);
    await press('hist-kind-short');
    expect(rowsOf()).toHaveLength(0);
    expect(screen.getByTestId('hist-filter-empty')).toBeTruthy();
    await press('hist-filter-clear');
    expect(rowsOf()).toHaveLength(2);
  });

  /** Baskets written straight into this sale's log (as if pulled): for cases the counter itself cannot make. */
  const seeded = async (build: (b: LogBuilder) => void) => {
    const b = new LogBuilder(saleId);
    for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
    build(b);
    await seedSale(store(), b.build());
  };

  it('numbers that repeat or skip raise a warning that names the tapper and the numbers; the check ignores the filters', async () => {
    await started();
    await seeded((b) => b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 3));
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(screen.getByTestId('hist-numbers-bad')).toHaveTextContent(/แดง: ขาด 2 · ซ้ำ 1/);
    expect(screen.queryByTestId('hist-numbers-ok')).toBeNull();
    await press('hist-kind-short');
    expect(screen.getByTestId('hist-numbers-bad')).toBeTruthy();
  });

  it('a voided basket stays in the list struck through, is not in the totals, and leaves its gap in the number check', async () => {
    await started();
    await seeded((b) => {
      b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
      b.void(farm.a[0], b.build().find((e) => e.kind === 'accept' && e.basketNo === 2)!.id);
    });
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(rowsOf()).toHaveLength(3);
    expect(screen.getAllByText('ยกเลิกแล้ว')).toHaveLength(1);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/เต็ม 2 เข่ง/);
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/รวม 100 กก\./);
    expect(screen.getByTestId('hist-equation')).toHaveTextContent('2 × 50 = 100 กก.');
    expect(screen.getByTestId('hist-numbers-bad')).toHaveTextContent(/ขาด 2/);
  });

  it('the summary, the sum and the running totals follow the filters; the rows add up to them', async () => {
    await started();
    await seeded((b) => b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).shortAt(farm.a[3], 1, 22_000, 2_000));
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(screen.getByTestId('hist-equation')).toHaveTextContent('2 × 50 + 20 = 120 กก.');
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/รวม 120 กก\./);
    await press('hist-kind-full');
    expect(screen.getByTestId('hist-equation')).toHaveTextContent('2 × 50 = 100 กก.');
    expect(screen.getByTestId('hist-summary')).toHaveTextContent(/ไม่เต็ม 0 เข่ง/);
    await press('hist-kind-all');
    await press(`hist-tapper-${farm.nat}`);
    expect(screen.getByTestId('hist-equation')).toHaveTextContent('20 = 20 กก.');
    expect(rowsOf()).toHaveLength(1);
    expect(screen.getByTestId(rowsOf()[0])).toHaveTextContent(/สะสม 20 กก\./);
    expect(screen.getByTestId('hist-numbers-ok')).toBeTruthy();
  });

  it('a sale with no baskets says so', async () => {
    await started();
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(screen.getByTestId('hist-empty')).toHaveTextContent('ยังไม่มีเข่ง');
  });

  it('a backfilled basket is labelled', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[0] });
    await act(async () => fireEvent.changeText(screen.getByTestId('backfill-full'), '2'));
    await press('backfill-save');
    await inSale(<HistoryScreen />, { point: farm.a[0] });
    expect(screen.getAllByText('บันทึกย้อนหลัง').length).toBeGreaterThan(0);
  });
});

describe('short basket: how it is recorded (E04-S16)', () => {
  const openSheet = async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('tool-short');
  };
  const typeIn = (id: string, text: string) => act(async () => fireEvent.changeText(screen.getByTestId(id), text));
  const lastShort = async () => (await store().load(saleId)).filter((e) => e.kind === 'short').pop();

  it('starts in typing mode with both weights shown: scale 37, net 35', async () => {
    await openSheet();
    expect(screen.getByTestId('reading-scale-input').props.value).toBe('37');
    expect(screen.getByTestId('reading-net-input').props.value).toBe('35');
    expect(screen.getByTestId('reading-scale-tag')).toHaveTextContent('กำลังกรอก');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('คำนวณให้');
    expect(screen.queryByTestId('reading')).toBeNull();
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 37_000, tareG: 2_000 });
  });

  it('typing the scale reading works the net out, and records that reading', async () => {
    await openSheet();
    await typeIn('reading-scale-input', '40');
    expect(screen.getByTestId('reading-net-input').props.value).toBe('38');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('คำนวณให้');
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 40_000, tareG: 2_000 });
  });

  it('typing the net rubber works the scale out, and the tags swap', async () => {
    await openSheet();
    await typeIn('reading-net-input', '30');
    expect(screen.getByTestId('reading-scale-input').props.value).toBe('32');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('กำลังกรอก');
    expect(screen.getByTestId('reading-scale-tag')).toHaveTextContent('คำนวณให้');
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 32_000, tareG: 2_000 });
  });

  it('keeps one decimal and drops letters', async () => {
    await openSheet();
    await typeIn('reading-net-input', '30.5');
    expect(screen.getByTestId('reading-scale-input').props.value).toBe('32.5');
    await typeIn('reading-net-input', '3x');
    expect(screen.getByTestId('reading-net-input').props.value).toBe('3');
  });

  it('nothing typed, or a net of zero or less, cannot be saved and says why', async () => {
    await openSheet();
    await typeIn('reading-scale-input', '');
    expect(screen.getByTestId('short-save').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('reading-net-input').props.value).toBe('');
    await typeIn('reading-scale-input', '2');
    expect(screen.getByTestId('short-too-low')).toBeTruthy();
    expect(screen.getByTestId('short-save').props.accessibilityState).toMatchObject({ disabled: true });
    await typeIn('reading-scale-input', '3');
    expect(screen.queryByTestId('short-too-low')).toBeNull();
  });

  it('over a full basket warns but still saves', async () => {
    await openSheet();
    await typeIn('reading-scale-input', '55');
    expect(screen.getByTestId('short-over')).toBeTruthy();
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 55_000 });
  });

  it('shows how much is still lacking in typing mode', async () => {
    await openSheet();
    expect(screen.getByTestId('card-lack')).toHaveTextContent(/ยังขาด\s*15/);
  });

  it('dial on the net rubber: the big number is the net, ± moves the net, the record is the reading', async () => {
    useDial('net');
    await openSheet();
    expect(screen.getByTestId('reading')).toHaveTextContent(/^35/);
    expect(screen.getByTestId('reading-other')).toHaveTextContent(/37/);
    await press('reading-more');
    expect(screen.getByTestId('reading')).toHaveTextContent(/^36/);
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 38_000, tareG: 2_000 });
  });

  it('switching the dial between scale and net keeps the same weight, and remembers the choice', async () => {
    useDial('scale');
    await openSheet();
    expect(screen.getByTestId('reading')).toHaveTextContent(/^37/);
    await press('basis-net');
    expect(screen.getByTestId('reading')).toHaveTextContent(/^35/);
    expect(readWeighBasis()).toBe('net');
    await press('basis-scale');
    expect(screen.getByTestId('reading')).toHaveTextContent(/^37/);
    expect(readWeighBasis()).toBe('scale');
  });
});

describe('v2 counter cards, grouped menu, home and debts shortcuts (E04-S18)', () => {
  const heightOf = (id: string) => {
    const style = ([] as unknown[])
      .concat(screen.getByTestId(id).props.style)
      .flat(3)
      .reduce<Record<string, unknown>>(
        (a, s) => ({ ...a, ...(s as object) }),
        {},
      );
    return style.height;
  };

  it('the three small cards keep one fixed height; units sit in the label line, the figure is the number alone', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    const h = heightOf('card-kg');
    expect(typeof h).toBe('number');
    expect(heightOf('card-first')).toBe(h);
    expect(heightOf('card-short')).toBe(h);
    expect(screen.getByTestId('card-kg')).toHaveTextContent(/น้ำหนัก \(กก\.\)/);
    expect(screen.getByTestId('fig-kg')).toHaveTextContent(/^[\d,.]+$/);
    expect(screen.getByTestId('fig-kg').props.numberOfLines).toBe(1);
  });

  it('the short card (an open short basket) has the same height, its unit in the label too', async () => {
    useDial();
    await started();
    await readyAt(farm.a[3]);
    await counterAt(farm.a[3]);
    await hold();
    await press('tool-short');
    await press('short-save');
    const h = heightOf('card-kg');
    expect(heightOf('card-first')).toBe(h);
    expect(heightOf('card-short')).toBe(h);
    expect(screen.getByTestId('card-short')).toHaveTextContent(/เหลือเติม \(กก\.\)/);
    expect(screen.getByTestId('fig-missing')).toHaveTextContent(/^15$/);
  });

  it('a long figure is stepped down in size, never cut with an ellipsis', () => {
    expect(figSize('1,234', 24)).toBe(24);
    expect(figSize('12,345.5', 24)).toBeLessThan(24);
    expect(figSize('1,234,567.5', 24)).toBeLessThan(figSize('12,345.5', 24));
    expect(figSize('1,234,567.5', 24)).toBeGreaterThanOrEqual(12);
    expect(figSize('123,456,789.5', 24)).toBeLessThan(figSize('1,234,567.5', 24));
  });

  it('the menu is grouped: finish · record · price and info · go to · delete last', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('counter-menu');
    expect(
      screen
        .getAllByTestId(/^menu-(?!sheet)[a-z]+$/)
        .map((x) => x.props.testID),
    ).toEqual([
      'menu-finish',
      'menu-backfill',
      'menu-public',
      'menu-price',
      'menu-info',
      'menu-home',
      'menu-debts',
      'menu-sales',
      'menu-delete',
    ]);
  });

  it('home and debts are two separate rows in the menu', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('counter-menu');
    await press('menu-home');
    expect(router.push).toHaveBeenLastCalledWith('/v2');
    await press('counter-menu');
    await press('menu-debts');
    expect(router.push).toHaveBeenLastCalledWith('/v2/debts');
  });

  it('the app bar has a home button', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('counter-home');
    expect(router.push).toHaveBeenLastCalledWith('/v2');
  });

  it('the point picker menu has the same go-to rows, without the finish and record groups', async () => {
    await started();
    await readyAt(farm.a[0]);
    await inSale(<PointScreen />, {
      mode: 'switch',
      farm: farm.farmA,
      tapper: farm.red,
    });
    await press('pick-menu');
    expect(
      screen
        .getAllByTestId(/^menu-(?!sheet)[a-z]+$/)
        .map((x) => x.props.testID),
    ).toEqual([
      'menu-price',
      'menu-info',
      'menu-home',
      'menu-debts',
      'menu-sales',
      'menu-delete',
    ]);
  });
});
