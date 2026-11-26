import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { financeStore } from '../store/finance';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { tokens } from '../../design/tokens';
import { expectChoiceTile } from '../test/choice-shape';
import { wrap } from '../test/render';
import { clearDraft } from '../v2/sale/closeout/use-closeout';
import { CloseoutSummaryScreen } from '../v2/sale/closeout/summary-screen';

// Each case renders whole close-out screens and writes to the finance log: 1–2 s here, 3–4× slower on
// a CI runner, where jest's 5 s default timed out a first case and the shared fixture failed the rest.
jest.setTimeout(20_000);

/**
 * E05-S11 · สรุปจ่ายเงิน with nothing recorded (mockup A0): no debts, the farm
 * owes no one. Both cards ask; no tapper card has a debt row.
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
const router = () => (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router;

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
const text = (id: string) => screen.getByTestId(id);
const disabled = (id: string) => !!screen.getByTestId(id).props.accessibilityState?.disabled;

const SALE = 'sale-co-empty';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const count = async () => (await financeStore.load()).length;

let farm: MockFarm;

beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
});

beforeEach(() => {
  clearDraft(SALE);
  router().push.mockClear();
});

describe('nothing recorded: the cards ask (CO-17, CO-26, A0)', () => {
  it('asks about debt and about money the farm owes; no tapper card has a debt row', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(text('co-debt-ask')).toHaveTextContent(/มีหนี้ค้างของคนกรีดไหม/);
    expect(text('co-owed-ask')).toHaveTextContent(/สวนค้างจ่ายคนกรีดไหม/);
    expect(screen.queryByTestId(`co-deduct-${farm.red}`)).toBeNull();
    expect(screen.queryByTestId(`co-deduct-${farm.nat}`)).toBeNull();
    expect(text(`co-cash-${farm.red}`)).toHaveTextContent('9,188.00');
    expect(text(`co-cash-${farm.nat}`)).toHaveTextContent('5,250.00');
    expect(disabled('co-confirm')).toBe(true);
    expect(text('co-confirm')).toHaveTextContent('↑ ตอบการ์ดด้านบนทั้ง 2 ใบก่อน');
  });

  it('ไม่มี answers a card; the button then names the other one', async () => {
    await inSale(<CloseoutSummaryScreen />);
    // E01-S26 PS26-7, owner rvs26-07 (2026-11-23 "ใช้ปุ่มแบบ I และหาทางไม่ให้เป็นกรอบซ้อนกรอบดีไหม"):
    // two equal style I tiles; not answered yet = no tick.
    for (const id of ['co-debt-none', 'co-debt-add-first', 'co-owed-none', 'co-owed-add-first']) expectChoiceTile(screen.getByTestId(id), 'mark');
    // Both cards read "+ มี · จดหนี้", as PS26-7 and mockup p9-after (review N3).
    for (const id of ['co-debt-add-first', 'co-owed-add-first']) expect(screen.getByTestId(id)).toHaveTextContent('+ มี · จดหนี้');
    // No box inside a box: the asking block has no frame of its own around the tiles.
    for (const id of ['co-debt-ask', 'co-owed-ask']) {
      const s = StyleSheet.flatten(screen.getByTestId(id).props.style) ?? {};
      expect(s.borderWidth ?? 0).toBe(0);
      expect(s.backgroundColor ?? 'transparent').toBe('transparent');
    }
    expect(screen.getByTestId('co-debt-none').props.accessibilityState).toMatchObject({ selected: false });
    await press('co-debt-none');
    expect(screen.getByTestId('co-debt-none').props.accessibilityState).toMatchObject({ selected: true });
    // "ไม่มี" picked reads as settled: the accept (green) tone of style I.
    expect(StyleSheet.flatten(screen.getByTestId('co-debt-none').props.style)).toMatchObject({ borderColor: tokens.color.light.accept });
    // "+ มี · จดหนี้" opens the debt form; it is never a ticked answer itself.
    expect(screen.getByTestId('co-debt-add-first').props.accessibilityState).toMatchObject({ selected: false });
    expect(text('co-confirm')).toHaveTextContent('↑ ตอบการ์ดสวนค้างจ่ายก่อน');
    await press('co-owed-none');
    expect(text('co-confirm')).not.toHaveTextContent(/ตอบ/);
    expect(await count()).toBe(0);
  });

  it('มี · จดหนี้ goes to the debt form', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-debt-add-first');
    expect(router().push).toHaveBeenCalled();
  });
});

describe('the last choice is read after the logs load, never in the first render (CO-23, E01-S19)', () => {
  it('does not touch device settings during the first render', async () => {
    const { deviceSettings } = jest.requireMock('../store/device-settings') as { deviceSettings: { get: (k: string) => string | null } };
    const spy = jest.spyOn(deviceSettings, 'get');
    wrap(<SaleProvider saleId={SALE}><CloseoutSummaryScreen /></SaleProvider>);
    expect(spy.mock.calls.filter(([k]) => String(k).startsWith('mon-farm:last-'))).toHaveLength(0);
    await flush();
    expect(spy.mock.calls.filter(([k]) => String(k).startsWith('mon-farm:last-')).length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});

