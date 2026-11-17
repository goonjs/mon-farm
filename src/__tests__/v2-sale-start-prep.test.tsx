/**
 * E15-S02 · the start-sale page takes the buyer and the price from the prep (owner 2026-11-18 03:01
 * "ก · ก · ตกลง AC ตาม mockup A–D เริ่มเขียนโค้ดได้ (แนะนำ)"). Mockup docs/ux/mockups/flow-sale-from-prep.html:
 * A today's prep fills at once · B a later day asks first · C no price → buyer only · D no prep / used → as before.
 * The sale still writes `sale_started.buyerId` and `price_set`; the finance log gets nothing new (q2, no prepId).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { LogBuilder } from '../core/fixtures';
import { SALE_PREP_TARGET } from '../core/finance/sale-prep';
import type { SalePrepPatch } from '../core/finance/types';
import { todayIso } from '../core/master';
import type { SaleEvent, SysPayload } from '../core/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { StartSaleScreen } from '../v2/sale/start-screen';

jest.setTimeout(20_000);

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
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismiss: jest.fn(), dismissAll: jest.fn(), dismissTo: jest.fn() };
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
const sys = (events: readonly SaleEvent[], t: SysPayload['t']) =>
  events.filter((e) => e.kind === 'sys' && e.payload.t === t).map((e) => (e as { payload: SysPayload }).payload);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TODAY = todayIso(Date.now());
/** A day after today, as an ISO day. */
const LATER = new Date(Date.parse(`${TODAY}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);

let farm: MockFarm;
let coop = '';
let n = 0;
let saleId = '';

/** A fresh prep: cancel what an earlier case left, then write these rows (the app's own events). */
async function prep(patch: SalePrepPatch) {
  await wait(3);
  await writeFinance(SALE_PREP_TARGET, null, { t: 'sale_prep_set', patch: { cancelled: true } });
  await wait(3);
  await writeFinance(SALE_PREP_TARGET, null, { t: 'sale_prep_set', patch });
  await wait(3);
}
const standard = (over: SalePrepPatch = {}): SalePrepPatch => ({ buyerId: coop, buyerName: 'สหกรณ์บ้านนา', date: TODAY, priceSatangPerKg: 5250, ...over });

async function open(ui: ReactElement = <StartSaleScreen />) {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
}
const started = async () => sys(await store().load(saleId), 'sale_started')[0] as { buyerId?: string; buyer: string };
const prices = async () => sys(await store().load(saleId), 'price_set').map((p) => (p as { satangPerKg: number }).satangPerKg);

beforeAll(async () => {
  farm = await seedMockFarm(master());
  coop = (await master().addBuyer('สหกรณ์บ้านนา')).id;
});
beforeEach(() => {
  n += 1;
  saleId = `sale-prep-${n}`;
  jest.clearAllMocks();
});

describe('A · a prep for today fills the page at once (PS-2, PS-3)', () => {
  it('buyer = the one booked, price = the agreed one, each saying where it came from', async () => {
    await prep(standard());
    await open();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/สหกรณ์บ้านนา/);
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/ที่นัดไว้ · แก้ได้/);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/52\.50/);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/ราคาที่ตกลงไว้ · แก้ได้/);
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
  });

  it('ถัดไป writes sale_started.buyerId and price_set as it always did, and nothing new in the finance log', async () => {
    await prep(standard());
    const before = (await financeStore.load()).length;
    await open();
    await press('start-next');
    expect(await started()).toMatchObject({ buyerId: coop, buyer: 'สหกรณ์บ้านนา' });
    expect(await prices()).toEqual([5250]);
    expect((await financeStore.load()).length).toBe(before);
  });

  it('every field can still be changed: another price, another buyer', async () => {
    await prep(standard());
    await open();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/ที่นัดไว้/);
    await press('start-price-row');
    for (const k of ['4', '8']) await press(`start-price-pad-key-${k}`);
    await press('start-price-done');
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/48/);
    await press('start-buyer');
    await press(`start-buyer-${farm.buyer}`);
    expect(screen.getByTestId('start-buyer')).not.toHaveTextContent(/ที่นัดไว้/);
    await press('start-next');
    expect(await started()).toMatchObject({ buyerId: farm.buyer });
    expect(await prices()).toEqual([4800]);
  });

  it('a prep dated a day already past fills too (q1)', async () => {
    await prep(standard({ date: '2026-01-05' }));
    await open();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/สหกรณ์บ้านนา/);
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
  });
});

describe('B · a prep for a later day asks first (PS-3)', () => {
  it('the card is on top, nothing is filled yet', async () => {
    await prep(standard({ date: LATER }));
    await open();
    expect(screen.getByTestId('start-prep-ask')).toHaveTextContent(/ใช้ที่เตรียมไว้ไหม/);
    expect(screen.getByTestId('start-prep-ask')).toHaveTextContent(/สหกรณ์บ้านนา/);
    expect(screen.getByTestId('start-prep-ask')).toHaveTextContent(/52\.50/);
    expect(screen.getByTestId('start-buyer')).not.toHaveTextContent(/ที่นัดไว้/);
    expect(screen.getByTestId('start-price-row')).not.toHaveTextContent(/52\.50/);
    // mockup B: the "ไม่ใช้ ตั้งเอง" link sits in the middle under the full-width button
    expect(StyleSheet.flatten(screen.getByTestId('start-prep-skip').props.style)).toMatchObject({ alignSelf: 'center' });
  });

  it('ใช้ที่เตรียมไว้ → filled like A, the card gone', async () => {
    await prep(standard({ date: LATER }));
    await open();
    await press('start-prep-use');
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/สหกรณ์บ้านนา/);
    await press('start-next');
    expect(await started()).toMatchObject({ buyerId: coop });
    expect(await prices()).toEqual([5250]);
  });

  it('ไม่ใช้ ตั้งเอง → the page as before, no price written', async () => {
    await prep(standard({ date: LATER }));
    await open();
    await press('start-prep-skip');
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
    expect(screen.getByTestId('start-buyer')).not.toHaveTextContent(/ที่นัดไว้/);
    await press('start-next');
    expect(await prices()).toEqual([]);
  });
});

describe('C · a prep with no price (PS-6, q4)', () => {
  it('the buyer fills, the price stays "ใส่ทีหลัง"', async () => {
    await prep(standard({ priceSatangPerKg: null }));
    await open();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/สหกรณ์บ้านนา/);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/ใส่ทีหลัง/);
    await press('start-next');
    expect(await prices()).toEqual([]);
  });
});

describe('D · no prep, or one a sale used: the page is as it was (PS-7)', () => {
  it('no prep: no "ที่นัดไว้", no price', async () => {
    await prep({ cancelled: true });
    await open();
    expect(screen.getByTestId('start-buyer')).not.toHaveTextContent(/ที่นัดไว้/);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/ใส่ทีหลัง/);
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
  });

  it('a sale started after the prep used it: nothing is filled', async () => {
    await prep(standard());
    const b = new LogBuilder('sale-after-prep');
    b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: '', workerLead: '', where: 'farm' });
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
    await open();
    expect(screen.getByTestId('start-buyer')).not.toHaveTextContent(/ที่นัดไว้/);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/ใส่ทีหลัง/);
    expect(screen.queryByTestId('start-prep-ask')).toBeNull();
  });
});
