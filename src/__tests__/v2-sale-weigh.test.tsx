import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';

import type { SaleEvent, SysPayload } from '../core/types';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { LogBuilder } from '../core/fixtures';
import { wrap } from '../test/render';
import { messages } from '../i18n/messages';
import { FarmMateArt } from '../ui';
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
/**
 * Press and hold a tool button: down, wait, up — the undo button counts like the count stage (E04-S15).
 * The hold runs on a fake clock so a busy machine cannot stretch a short press past the hold time.
 */
const holdTool = async (id: string, ms: number) => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    fireEvent(screen.getByTestId(id), 'pressIn', { nativeEvent: {} });
    act(() => jest.advanceTimersByTime(ms));
    fireEvent(screen.getByTestId(id), 'pressOut', { nativeEvent: {} });
  } finally {
    jest.useRealTimers();
  }
  await flush();
};
/** Keys on the app number pad of a field (E01-S20): `<field>-pad-key-<k>`. */
const padKeys = async (field: string, keys: string) => {
  for (const k of keys) await press(`${field}-pad-key-${k}`);
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
    // Review of PR 193: no "แตะสลับ พ.ศ./ค.ศ." hint; tapping a date switches the era everywhere in the app.
    expect(screen.getByTestId('start-date')).not.toHaveTextContent(/แตะสลับ/);
    // E01-S21 PK-3: rows that open a sheet show › like the buyer row.
    for (const id of ['start-pair', 'start-price-row']) expect(within(screen.getByTestId(id)).getByTestId(`${id}-chevron`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('start-scale-decimal1').props.accessibilityState).toMatchObject({ disabled: true });
    await press('start-numbering-per-point');
    await press('start-next');
    const ev = await store().load(saleId);
    expect(sys(ev, 'sale_started')[0]).toMatchObject({ buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: 'อ.สมหวัง' });
    expect(sys(ev, 'numbering_set')[0]).toMatchObject({ numbering: 'per-point' });
    expect(sys(ev, 'price_set')).toEqual([]);
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/point`);
  });

  it('E04-S19 BF-9: the sale day is today by default and can be an earlier day, never a later one', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-date');
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 31 * 3_600_000).toISOString().slice(0, 10);
    expect(screen.getByTestId('start-date-picker-today').props.accessibilityState).toMatchObject({ selected: true });
    const later = screen.queryByTestId(`start-date-picker-day-${tomorrow}`);
    if (later) expect(later.props.accessibilityState).toMatchObject({ disabled: true });
    await press('start-date-picker-yesterday');
    await press('start-date-picker-done');
    const yesterday = new Date(Date.now() - 17 * 3_600_000).toISOString().slice(0, 10);
    expect(yesterday < today).toBe(true);
    await press('start-next');
    expect(sys(await store().load(saleId), 'sale_started')[0]).toMatchObject({ day: yesterday });
  });

  it('E04-S19 BF-9: just after midnight in Bangkok (still yesterday in UTC), the picker\'s today is the sale\'s today', async () => {
    // 03:00 on 17 Nov in Bangkok is 20:00 on 16 Nov in UTC; only the clock is faked.
    jest.useFakeTimers({
      now: new Date('2026-11-16T20:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
    });
    try {
      await inSale(<StartSaleScreen />);
      await press('start-date');
      expect(screen.getByTestId('start-date-picker-today').props.accessibilityState).toMatchObject({ selected: true });
      expect(screen.getByTestId('start-date-picker-day-2026-11-17').props.accessibilityState).not.toMatchObject({ disabled: true });
      await press('start-date-picker-done');
      await press('start-next');
      expect(sys(await store().load(saleId), 'sale_started')[0]).toMatchObject({ day: '2026-11-17' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('a sale started today writes today as its day', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-next');
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    expect(sys(await store().load(saleId), 'sale_started')[0]).toMatchObject({ day: today });
  });

  it('a typed price is written with the header', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-price-row');
    await padKeys('start-price', '48.50');
    await press('start-price-done');
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
    // Many farms or tappers wrap two to a line instead of squeezing into one row (E01-S21 sel-q6 ก).
    for (const id of ['pick-farm', 'pick-tapper']) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    }
    expect(StyleSheet.flatten(screen.getByTestId('pick-farm-' + farm.farmA).props.style)).toMatchObject({ flexGrow: 1, flexBasis: '40%' });
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

/** On the fill-up sheet (E04-S21): choose a way, then confirm (owner 2026-10-11, AC agreed 2026-11-17). */
async function chooseFill(way: 'full' | 'part' | 'next') {
  await press(`fill-${way}`);
  await press('fill-go');
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

  it('E01-S20 NP-9: ยกเลิก / บันทึก sit in the sheet footer, outside the scrolling body', async () => {
    useDial();
    await started();
    await readyAt(farm.a[3]);
    await counterAt(farm.a[3]);
    await hold();
    await press('tool-short');
    const footer = screen.getByTestId('short-sheet-footer');
    for (const id of ['short-cancel', 'short-save']) {
      let inFooter = false;
      for (let n = screen.getByTestId(id).parent; n; n = n.parent) if (n === footer) inFooter = true;
      expect(inFooter).toBe(true);
    }
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
    await chooseFill('next');
    expect(sys(await store().load(saleId), 'basket_closed')).toHaveLength(0);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining('fill=next'));
    // Back to the picker before counting: the sheet asks again and option 1 still works.
    await press(`pick-point-${farm.a[1]}`);
    expect(screen.getByTestId('fill-sheet')).toBeTruthy();
    expect(screen.getByTestId('fill-full')).toBeTruthy();
    expect(screen.getByTestId('fill-part')).toBeTruthy();
    expect(screen.getByTestId('fill-next')).toBeTruthy();
    await chooseFill('next');
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
    await chooseFill('full');
    expect(router.replace).toHaveBeenLastCalledWith(`/v2/sale/${saleId}/zero-tare?point=${farm.a[1]}&net=50000&basket=2000&fill=full`);
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'full' });
    expect(screen.getByTestId('fill-title')).toHaveTextContent(/เติมให้เต็มเข่ง 2/);
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

describe('the fill-up sheet and guide (E04-S21, owner 2026-11-17 "ก · ก · โอเค ทำตามนี้")', () => {
  /** แดง's basket 2 short at จุด 1 (35 kg in), then เปลี่ยนจุด to จุด 2: the sheet asks. */
  async function toSheet() {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
  }
  const selected = (id: string) => screen.getByTestId(id).props.accessibilityState?.selected;

  it('E04-S22 FC-2: the three ways are one radio group with a name, each still a radio', async () => {
    await toSheet();
    const group = screen.getByTestId('fill-ways');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toMatch(/เลือกวิธีเติมเข่ง 2/);
    for (const id of ['fill-full', 'fill-part', 'fill-next']) {
      expect(within(group).getByTestId(id).props.accessibilityRole).toBe('radio');
    }
  });

  it('E04-S22 FC-1: the old fill-sheet strings are gone from the catalogue', () => {
    const gone = ['fillTitle', 'fillHave', 'fillFrom', 'fillFull', 'fillPart', 'fillNext', 'fillMore', 'asBasket', 'wholeBasket', 'fullSumSkew', 'weighAdded', 'countAs', 'partSum', 'partSumSkew', 'nextFull', 'basketN', 'fillNote', 'fillStagePart', 'fullLine', 'fillSum'];
    const ids = new Set([...Object.keys(messages.th), ...Object.keys(messages.en)]);
    expect(gone.filter((k) => ids.has(`v2s.${k}`))).toEqual([]);
  });

  it('FS-2: from → to, the same tapper, and the basket bar 35 in + 15 to add = 50 full', async () => {
    await toSheet();
    expect(screen.getByTestId('fill-route')).toHaveTextContent(/มาจาก.*จันทเขลม จุด 1.*ไปที่.*จันทเขลม จุด 2/);
    expect(screen.getByTestId('fill-sheet')).toHaveTextContent(/แดง/);
    const bar = screen.getByTestId('basket-bar');
    expect(bar).toHaveTextContent(/35 กก\..*มีแล้ว/);
    expect(bar).toHaveTextContent(/15 กก\..*เติม/);
    expect(bar).toHaveTextContent(/เต็ม.*50 กก\./);
  });

  it('FS-3: choose, then confirm — fill up is chosen first, a tap only chooses; each way shows the scale reading on its right', async () => {
    await toSheet();
    expect(selected('fill-full')).toBe(true);
    expect(selected('fill-part')).toBe(false);
    expect(screen.getByTestId('fill-full-scale')).toHaveTextContent('52');
    expect(screen.getByTestId('fill-part-scale')).toHaveTextContent('17');
    expect(screen.getByTestId('fill-next-scale')).toHaveTextContent('—');
    router.replace.mockClear();
    router.push.mockClear();
    await press('fill-part');
    expect(selected('fill-part')).toBe(true);
    expect(selected('fill-full')).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('fill-sheet')).toBeTruthy();
  });

  it('FS-4: the chosen way lists its steps — pour 15 into basket 2, the scale must read 52 (50 + basket 2)', async () => {
    await toSheet();
    const steps = within(screen.getByTestId('fill-full')).getByTestId('fill-steps');
    expect(steps).toHaveTextContent(/เทยางเพิ่ม.*15 กก\..*ลงเข่ง 2 ใบเดิม/);
    expect(steps).toHaveTextContent(/ตราชั่งต้องอ่าน.*52.*\(50 \+ เข่ง 2\)/);
    expect(steps).not.toHaveTextContent(/กดค้าง/);
    expect(within(screen.getByTestId('fill-part')).queryByTestId('fill-steps')).toBeNull();
  });

  it('FS-5/FS-6: way 2 is a new empty basket, way 3 leaves basket 2 short and goes to basket 3; the button says what it does', async () => {
    await toSheet();
    expect(screen.getByTestId('fill-part')).toHaveTextContent(/เข่งเปล่าใบใหม่ เติมยาง.*15 กก\./);
    expect(screen.getByTestId('fill-next')).toHaveTextContent(/เข่ง 2 ไม่เต็ม.*35 กก\..*ต่อไปเข่ง 3/);
    expect(screen.getByTestId('fill-go')).toHaveTextContent(/เติมเข่ง 2 · ตราชั่งต้องอ่าน.*52/);
    await press('fill-part');
    expect(screen.getByTestId('fill-go')).toHaveTextContent(/ชั่งส่วนที่เติม · ตราชั่งต้องอ่าน.*17/);
    await press('fill-next');
    expect(screen.getByTestId('fill-go')).toHaveTextContent(/ปล่อยไว้ · ไปเข่ง 3/);
    await press('fill-go');
    // E04-S17 stays: nothing closes until the next full basket is counted.
    expect(sys(await store().load(saleId), 'basket_closed')).toHaveLength(0);
    expect(router.replace).toHaveBeenLastCalledWith(expect.stringContaining('fill=next'));
  });

  it('FS-1/FS-4: with a scale skew the readings and the sum include it', async () => {
    await started();
    await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    await press('zero-not0');
    await press('empty-reading-more');
    await press('choose-skew');
    await press('start-weigh');
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    expect(screen.getByTestId('fill-full-scale')).toHaveTextContent('54');
    expect(within(screen.getByTestId('fill-full')).getByTestId('fill-steps')).toHaveTextContent(/\(50 \+ เข่ง 2 \+ เบี้ยว 2\)/);
  });

  it('FS-7/FS-9: after fill up, the counter is the guide — basket bar, 3 steps, the big reading with the hold, and what comes after', async () => {
    await toSheet();
    await chooseFill('full');
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'full' });
    expect(screen.getByTestId('fill-title')).toHaveTextContent('เติมให้เต็มเข่ง 2');
    expect(within(screen.getByTestId('fill-guide')).getByTestId('basket-bar')).toHaveTextContent(/35 กก\..*15 กก\..*50 กก\./);
    const steps = screen.getByTestId('fill-steps');
    expect(steps).toHaveTextContent(/เทยางเพิ่ม.*15 กก\..*ลงเข่ง 2 ใบเดิม/);
    expect(steps).toHaveTextContent(/ตราชั่งต้องอ่าน.*52/);
    expect(steps).toHaveTextContent(/กดค้างด้านล่าง/);
    expect(screen.getByTestId('should-read')).toHaveTextContent('52 กก.');
    expect(screen.getByTestId('hold')).toHaveTextContent(/\(50 \+ เข่ง 2\)/);
    expect(screen.getByTestId('fill-after')).toHaveTextContent(/เข่ง 2 เต็ม.*35 กก\..*\+.*15 กก\..*=.*50 กก\..*ต่อไปเข่ง 3/);
    // The count card gives its room to the guide, so the hold stays in view.
    expect(screen.queryByTestId('current')).toBeNull();
    await hold();
    expect((await store().load(saleId)).filter((e) => e.kind === 'accept').pop()).toMatchObject({ pointId: farm.a[1], basketNo: 2, netG: 15_000 });
  });

  it('FS-8: after weigh apart, 35 is in the basket at จุด 1 and 15 is weighed now; the scale must read 17', async () => {
    await toSheet();
    await chooseFill('part');
    await readyAt(farm.a[1]);
    await counterAt(farm.a[1], { fill: 'part' });
    expect(screen.getByTestId('fill-title')).toHaveTextContent('ชั่งแยกส่วนที่เติม · เข่ง 2');
    const bar = screen.getByTestId('basket-bar');
    expect(bar).toHaveTextContent(/35 กก\..*อยู่ในเข่งที่ จันทเขลม · จุด 1/);
    expect(bar).toHaveTextContent(/15 กก\..*ชั่งตอนนี้/);
    expect(screen.getByTestId('fill-steps')).toHaveTextContent(/ชั่งยาง.*15 กก\..*ในเข่งเปล่าใบใหม่/);
    expect(screen.getByTestId('should-read')).toHaveTextContent('17 กก.');
    expect(screen.getByTestId('fill-after')).toHaveTextContent(/เข่ง 2 เต็ม.*ต่อไปเข่ง 3/);
  });
});

describe('catch up from the paper (E04-S19, mockup v4)', () => {
  /** Types `keys` on a whole-number field's pad and closes it. */
  const typeInt = async (field: string, keys: string) => {
    await press(field);
    await padKeys(field, keys);
    await press(`${field}-pad-key-done`);
  };
  /** Types kg on a decimal field's pad and closes it. */
  const typeKg = async (field: string, keys: string) => {
    if (!screen.queryByTestId(`${field}-pad`)) await press(field);
    await padKeys(field, keys);
    await press(`${field}-done`);
  };
  const enabled = (id: string) => !screen.getByTestId(id).props.accessibilityState?.disabled;
  const kinds = async () => {
    const ev = await store().load(saleId);
    return ev.filter((e) => e.kind === 'accept' || e.kind === 'short' || (e.kind === 'sys' && e.payload.t === 'basket_closed'));
  };

  it('the paper sample, continuous: จุด 1 then จุด 3 → Σ 1,022 kg in 21 baskets; basket 21 stays open for live counting', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[0] });
    // BF-1: แดง's points, in paper order; the picked one is already first.
    expect(screen.getByTestId('cu-order')).toBeTruthy();
    expect(screen.getByTestId(`cu-order-${farm.a[0]}`)).toHaveTextContent(/1/);
    await press(`cu-order-${farm.a[2]}`);
    expect(screen.getByTestId(`cu-order-${farm.a[2]}`)).toHaveTextContent(/2/);
    await press('cu-next');
    // BF-2/3: one page per point; the start is filled in; nothing is chosen for "full?".
    expect(screen.getByTestId('cu-start')).toHaveTextContent(/1/);
    await typeInt('cu-end', '12');
    expect(screen.getByTestId('cu-count')).toHaveTextContent(/= 12 เข่ง/);
    expect(enabled('cu-next')).toBe(false);
    await press('cu-short');
    expect(enabled('cu-next')).toBe(false);
    await typeKg('cu-short-kg', '30');
    // BF-10: Σ goes up as it is entered.
    expect(screen.getByTestId('cu-sum-bar')).toHaveTextContent(/580 กก\./);
    expect(screen.getByTestId('cu-sum-bar')).toHaveTextContent(/12 เข่ง/);
    await press('cu-next');
    // BF-4: what happened to basket 12 at จุด 3; nothing chosen, the gap offered.
    expect(screen.getByTestId('cu-topup')).toHaveTextContent(/เข่ง 12 \(30 กก\.\) เติมที่จุดนี้ไหม/);
    expect(enabled('cu-next')).toBe(false);
    await press('cu-fill');
    expect(screen.getByTestId('cu-fill-kg')).toHaveTextContent(/20/);
    await press('cu-next');
    expect(screen.getByTestId('cu-start')).toHaveTextContent(/13/);
    await typeInt('cu-end', '21');
    expect(screen.getByTestId('cu-count')).toHaveTextContent(/= 9 เข่ง/);
    await press('cu-short');
    await typeKg('cu-short-kg', '22');
    await press('cu-next');
    // BF-6: the summary reads like the paper.
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 1–11 เต็ม/);
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 12 ไม่เต็ม 30 \+ เติมที่จุด 3 อีก 20/);
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 13–20 เต็ม/);
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 21 ยังเปิดอยู่/);
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/1,022 กก\./);
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/21 เข่ง/);
    // BF-7: the paper's total, checked.
    await typeKg('cu-paper', '1000');
    expect(screen.getByTestId('cu-paper-check')).toHaveTextContent(/ต่างกัน 22 กก\./);
    // Opened again, the first key replaces what was there.
    await typeKg('cu-paper', '1022');
    expect(screen.getByTestId('cu-paper-check')).toHaveTextContent(/ตรง/);
    // BF-6: one save, even pressed twice.
    fireEvent.press(screen.getByTestId('cu-save'));
    fireEvent.press(screen.getByTestId('cu-save'));
    await flush();
    const ev = await kinds();
    expect(ev.filter((e) => e.kind === 'accept' && !e.partOf).map((e) => (e as { basketNo: number }).basketNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(ev.filter((e) => e.kind === 'short').map((e) => [(e as { basketNo: number }).basketNo, (e as { readingG: number }).readingG])).toEqual([[12, 32_000], [21, 24_000]]);
    expect(ev.find((e) => e.kind === 'accept' && e.partOf)).toMatchObject({ basketNo: 12, netG: 20_000, pointId: farm.a[2] });
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/counter?point=${farm.a[2]}`);
  });

  it('review B1: each point weighs with its own pair (จุด 1 at 50 kg / 2 kg, จุด 3 at 40 kg / 3 kg)', async () => {
    await started();
    // Both points set up before anything is weighed: no basket yet, so catching up is allowed.
    await readyAt(farm.a[0]);
    const z = await inSale(<ZeroTareScreen />, { point: farm.a[2], net: '40000', basket: '3000' });
    await press('start-weigh');
    z.unmount();
    await inSale(<BackfillScreen />, { point: farm.a[0] });
    await press(`cu-order-${farm.a[2]}`);
    await press('cu-next');
    await typeInt('cu-end', '2');
    expect(screen.getByTestId('cu-full')).toHaveTextContent(/50 กก\./);
    await press('cu-full');
    await press('cu-next');
    await typeInt('cu-end', '4');
    expect(screen.getByTestId('cu-full')).toHaveTextContent(/40 กก\./);
    await press('cu-full');
    await press('cu-next');
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/180 กก\./);
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 3–4 เต็ม · 2 × 40/);
    await press('cu-save');
    const at3 = (await kinds()).filter((e) => e.kind === 'accept' && e.pointId === farm.a[2]);
    expect(at3.map((e) => [(e as { netG: number }).netG, (e as { tareG: number }).tareG])).toEqual([[40_000, 3_000], [40_000, 3_000]]);
  });

  it('owner 2026-11-16: บันทึกย้อนหลัง on the point picker opens the chosen tapper\'s flow at once (link and ⋯ menu)', async () => {
    await started();
    await inSale(<PointScreen />, { farm: farm.farmA, tapper: farm.red });
    expect(screen.getByTestId('pick-backfill')).toHaveTextContent(/บันทึกย้อนหลัง/);
    await press('pick-backfill');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/backfill?tapper=${farm.red}`);
    router.push.mockClear();
    await press('pick-menu');
    await press('menu-backfill');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/backfill?tapper=${farm.red}`);
  });

  it('owner 2026-11-16: the counter\'s ⋯ บันทึกย้อนหลัง goes straight to its tapper\'s flow, no point picker', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    await press('counter-menu');
    await press('menu-backfill');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${saleId}/backfill?tapper=${farm.red}`);
  });

  it('opened for a tapper: nothing is in the order yet; the points are tapped in paper order', async () => {
    await started();
    await inSale(<BackfillScreen />, { tapper: farm.red });
    expect(screen.getByTestId('cu-order')).toBeTruthy();
    expect(enabled('cu-next')).toBe(false);
    await press(`cu-order-${farm.a[1]}`);
    await press(`cu-order-${farm.a[0]}`);
    expect(screen.getByTestId(`cu-order-${farm.a[1]}`)).toHaveTextContent(/1/);
    await press('cu-next');
    expect(screen.getByTestId('cu-point-name')).toHaveTextContent(/จุด 2/);
    await typeInt('cu-end', '2');
    await press('cu-full');
    await press('cu-next');
    expect(screen.getByTestId('cu-start')).toHaveTextContent(/3/);
    await typeInt('cu-end', '4');
    await press('cu-full');
    await press('cu-next');
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/200 กก\./);
    await press('cu-save');
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${saleId}/counter?point=${farm.a[0]}`);
  });

  it('the point being entered stands out: its name and "1 of 2" in a heading, on the point and the top-up page (owner 2026-11-16)', async () => {
    await started();
    await inSale(<BackfillScreen />, { tapper: farm.red });
    await press(`cu-order-${farm.a[1]}`);
    await press(`cu-order-${farm.a[0]}`);
    await press('cu-next');
    expect(screen.getByTestId('cu-point-name')).toHaveTextContent(/จุด 2/);
    expect(screen.getByTestId('cu-point-name')).toHaveTextContent(/1 จาก 2/);
    await typeInt('cu-end', '2');
    await press('cu-short');
    await typeKg('cu-short-kg', '30');
    await press('cu-next');
    expect(screen.getByTestId('cu-topup')).toBeTruthy();
    expect(screen.getByTestId('cu-point-name')).toHaveTextContent(/จุด 1/);
    expect(screen.getByTestId('cu-point-name')).toHaveTextContent(/2 จาก 2/);
  });

  it('not topped up: basket 12 closes at 30 kg', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[0] });
    await press(`cu-order-${farm.a[1]}`);
    await press('cu-next');
    await typeInt('cu-end', '12');
    await press('cu-short');
    await typeKg('cu-short-kg', '30');
    await press('cu-next');
    await press('cu-nofill');
    await press('cu-next');
    expect(screen.getByTestId('cu-start')).toHaveTextContent(/13/);
    await typeInt('cu-end', '14');
    await press('cu-full');
    await press('cu-next');
    expect(screen.getByTestId('cu-summary')).toHaveTextContent(/เข่ง 12 ไม่เต็ม 30 · ปิดเข่ง/);
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/680 กก\./);
    await press('cu-save');
    expect((await kinds()).filter((e) => e.kind === 'sys')).toHaveLength(1);
  });

  it('per point: the point starts at 1 and there is no order page or top-up question', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-numbering-per-point');
    await press('start-next');
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    expect(screen.queryByTestId('cu-order')).toBeNull();
    expect(screen.getByTestId('cu-start')).toHaveTextContent(/1/);
    await typeInt('cu-end', '7');
    await press('cu-full');
    await press('cu-next');
    expect(screen.getByTestId('cu-total')).toHaveTextContent(/350 กก\./);
  });

  it('BF-8: only before counting live — a tapper with a basket already cannot catch up', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    c.unmount();
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    expect(screen.getByTestId('cu-blocked')).toHaveTextContent(/นับเองไปแล้ว/);
    expect(screen.queryByTestId('cu-next')).toBeNull();
  });

  it('opened for a tapper, a point in the link is ignored: BF-8 still reads that tapper (review N1)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    c.unmount();
    await inSale(<BackfillScreen />, { tapper: farm.red, point: farm.a[4] });
    expect(screen.getByTestId('cu-blocked')).toHaveTextContent(/นับเองไปแล้ว/);
    expect(screen.queryByTestId('cu-next')).toBeNull();
  });

  it('a tapper with no points that day says so, with no way to save (review N2)', async () => {
    await started();
    await inSale(<BackfillScreen />, { tapper: 'nobody' });
    expect(screen.getByTestId('cu-no-points')).toHaveTextContent(/ไม่มีจุด/);
    expect(screen.queryByTestId('cu-next')).toBeNull();
    expect(screen.queryByTestId('cu-save')).toBeNull();
  });

  it('per point, opened for a tapper: a point already counted live cannot be picked (BF-8)', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-numbering-per-point');
    await press('start-next');
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    c.unmount();
    await inSale(<BackfillScreen />, { tapper: farm.red });
    expect(screen.getByTestId(`cu-order-${farm.a[0]}`).props.accessibilityState).toMatchObject({ disabled: true });
    await press(`cu-order-${farm.a[0]}`);
    expect(enabled('cu-next')).toBe(false);
    await press(`cu-order-${farm.a[1]}`);
    expect(enabled('cu-next')).toBe(true);
  });

  it('the end number pad takes whole numbers only', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[4] });
    await press('cu-end');
    expect(screen.queryByTestId('cu-end-pad-key-.')).toBeNull();
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
    await chooseFill('full');
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
    await chooseFill('full');
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
    await inSale(<BackfillScreen />, { point: farm.a[4] });
    await press('cu-end');
    await padKeys('cu-end', '2');
    await press('cu-end-pad-key-done');
    await press('cu-full');
    await press('cu-next');
    await press('cu-save');
    await inSale(<HistoryScreen />, { point: farm.a[4] });
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
  /** E01-S20 row 21: tap a side's card, then press keys on the in-sheet pad. "" = hold ⌫ (clear). */
  const typeIn = async (side: 'scale' | 'net', text: string) => {
    await press(`reading-${side}`);
    if (text === '') {
      await act(async () => fireEvent(screen.getByTestId('reading-pad-key-back'), 'longPress'));
      return;
    }
    for (const k of text) await press(`reading-pad-key-${k}`);
  };
  const shown = (side: 'scale' | 'net') => screen.getByTestId(`reading-${side}-value`);
  const lastShort = async () => (await store().load(saleId)).filter((e) => e.kind === 'short').pop();

  it('starts in typing mode with both weights shown: scale 37, net 35', async () => {
    await openSheet();
    expect(shown('scale')).toHaveTextContent('37');
    expect(shown('net')).toHaveTextContent('35');
    expect(screen.getByTestId('reading-scale-tag')).toHaveTextContent('ค่าเดา · พิมพ์ทับ');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('คำนวณให้');
    expect(screen.queryByTestId('reading')).toBeNull();
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 37_000, tareG: 2_000 });
  });

  it('typing the scale reading works the net out, and records that reading', async () => {
    await openSheet();
    await typeIn('scale', '40');
    expect(shown('net')).toHaveTextContent('38');
    expect(screen.getByTestId('reading-scale-tag')).toHaveTextContent('กำลังกรอก');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('คำนวณให้');
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 40_000, tareG: 2_000 });
  });

  it('typing the net rubber works the scale out, and the tags swap', async () => {
    await openSheet();
    await typeIn('net', '30');
    expect(shown('scale')).toHaveTextContent('32');
    expect(screen.getByTestId('reading-net-tag')).toHaveTextContent('กำลังกรอก');
    expect(screen.getByTestId('reading-scale-tag')).toHaveTextContent('คำนวณให้');
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 32_000, tareG: 2_000 });
  });

  it('keeps one decimal and at most 3 whole digits (the old box: 999.9)', async () => {
    await openSheet();
    await typeIn('net', '30.55');
    expect(shown('net')).toHaveTextContent('30.5');
    expect(shown('scale')).toHaveTextContent('32.5');
    await typeIn('scale', '1234');
    expect(shown('scale')).toHaveTextContent('123');
  });

  it('nothing typed, or a net of zero or less, cannot be saved and says why', async () => {
    await openSheet();
    await typeIn('scale', '');
    expect(screen.getByTestId('short-save').props.accessibilityState).toMatchObject({ disabled: true });
    expect(shown('net')).toHaveTextContent('–');
    await typeIn('scale', '2');
    expect(screen.getByTestId('short-too-low')).toBeTruthy();
    expect(screen.getByTestId('short-save').props.accessibilityState).toMatchObject({ disabled: true });
    await press('reading-pad-key-back');
    await press('reading-pad-key-3');
    expect(screen.queryByTestId('short-too-low')).toBeNull();
  });

  it('over a full basket warns but still saves', async () => {
    await openSheet();
    await typeIn('scale', '55');
    expect(screen.getByTestId('short-over')).toBeTruthy();
    await press('short-save');
    expect(await lastShort()).toMatchObject({ readingG: 55_000 });
  });

  it('shows how much is still lacking in typing mode, on one line', async () => {
    await openSheet();
    expect(screen.getByTestId('card-lack')).toHaveTextContent(/ยังขาด\s*15/);
  });

  it('NP-8: the guess is edited from its end — "." first starts at "0.", ⌫ first removes one digit of the guess', async () => {
    await openSheet();
    await press('reading-pad-key-back');
    expect(shown('scale')).toHaveTextContent(/^3$/);
    await press('reading-pad-key-6');
    expect(shown('scale')).toHaveTextContent('36');
    await press('short-cancel');
    await press('tool-short');
    await press('reading-pad-key-.');
    expect(shown('scale')).toHaveTextContent('0.');
  });

  it('NP-8: the pad is in the sheet (no OS keyboard, no second sheet); hold ⌫ clears', async () => {
    await openSheet();
    expect(screen.getByTestId('reading-pad')).toBeTruthy();
    expect(screen.queryByTestId('reading-scale-input')).toBeNull();
    await typeIn('scale', '');
    expect(shown('scale')).toHaveTextContent('–');
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
    // Owner 2026-11-03 (E03-S11): the unit alone; "น้ำหนัก (กก.)" was cut at 360 px.
    expect(screen.getByTestId('card-kg')).toHaveTextContent(/^กก\./);
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

/** The traced originals drawn inside the element with this testID (E03-S11). */
function art(testID: string): string[] {
  return within(screen.getByTestId(testID)).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id as string);
}

describe('FarmMate originals on the sale screens (E03-S11 FM-8)', () => {
  it('start: each field leads with its original', async () => {
    await inSale(<StartSaleScreen />);
    expect(art('start-date')).toEqual(['farmwork.calendar']);
    expect(art('start-buyer')).toEqual(['people.buyer']);
    expect(art('start-manager')).toEqual(['people.manager']);
    expect(art('start-time')).toEqual(['farmwork.history']);
    expect(art('start-price-row')).toEqual(['sale.rubberPrice']);
    expect(art('start-pair')).toEqual(['farmwork.tapping']);
    expect(art('start-note-row')).toEqual(['farm.photos']);
  });

  it('point picker: each point tile is the weighing point', async () => {
    await started();
    await inSale(<PointScreen />, { pair: 'builtin-50' });
    await press('pick-farm-' + farm.farmA);
    expect(art(`pick-point-${farm.a[0]}`)).toEqual(['farm.weighPoint']);
  });

  it('empty-scale check: the scale and the basket; the warning keeps its line icon', async () => {
    await started();
    await inSale(<ZeroTareScreen />, { point: farm.a[0], net: '50000', basket: '2000' });
    expect(art('zero-tare')).toEqual(expect.arrayContaining(['sale.recordYield', 'sale.weigh']));
    expect(art('zero-tare').every((id) => ['sale.recordYield', 'sale.weigh'].includes(id))).toBe(true);
    // The two choices: "scale is off" weighs, so it is the scale original; waiting keeps its hourglass.
    await press('zero-not0');
    await press('empty-reading-more');
    expect(art('choose-skew')).toEqual(['sale.weigh']);
    expect(art('choose-wait')).toEqual([]);
  });

  it('fill sheet (E04-S21): the ways are radio rows led by the scale reading, not art tiles (mockup agreed 2026-11-17)', async () => {
    await started();
    await readyAt(farm.a[0]);
    const c = await counterAt(farm.a[0]);
    await hold();
    await press('tool-short');
    await press('short-save');
    c.unmount();
    await inSale(<PointScreen />, { mode: 'switch', farm: farm.farmA, tapper: farm.red });
    await press(`pick-point-${farm.a[1]}`);
    for (const id of ['fill-full', 'fill-part', 'fill-next']) {
      expect(screen.getByTestId(id).props.accessibilityRole).toBe('radio');
      expect(art(id)).toEqual([]);
    }
  });

  it('counter: history and short-basket tools draw originals, undo keeps its arrow; menu rows draw originals, delete keeps its bin', async () => {
    await started();
    await readyAt(farm.a[0]);
    await counterAt(farm.a[0]);
    expect(art('tool-history')).toEqual(['farmwork.history']);
    expect(art('tool-short')).toEqual(['sale.weigh']);
    expect(art('tool-undo')).toEqual([]);
    // Owner 2026-11-03: the weight card says just "กก." so it fits one line at 360 px (it was cut to "น้ำหนัก (…").
    expect(screen.queryByText('น้ำหนัก (กก.)')).toBeNull();
    expect(screen.getAllByText('กก.').length).toBeGreaterThan(0);
    // ...and a screen reader still hears what it counts (lead 2026-11-03).
    expect(within(screen.getByTestId('card-kg')).getByLabelText('น้ำหนัก (กิโลกรัม)')).toHaveTextContent(/^กก\.$/);
    await press('counter-menu');
    expect(art('menu-finish')).toEqual([]);
    expect(art('menu-backfill')).toEqual(['farmwork.history']);
    expect(art('menu-public')).toEqual(['system.multiDevice']);
    expect(art('menu-price')).toEqual(['sale.rubberPrice']);
    expect(art('menu-info')).toEqual(['system.about']);
    expect(art('menu-home')).toEqual(['nav.home']);
    expect(art('menu-debts')).toEqual(['finance.otherCost']);
    expect(art('menu-sales')).toEqual(['analysis.saleHistory']);
    expect(art('menu-delete')).toEqual([]);
  });

  it('catch-up: the Σ bar carries the weighing original (was the proof tile)', async () => {
    await started();
    await inSale(<BackfillScreen />, { point: farm.a[4] });
    expect(art('cu-sum-bar')).toEqual(['sale.weigh']);
  });
});
