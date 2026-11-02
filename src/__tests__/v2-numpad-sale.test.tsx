/**
 * E01-S20 NP-4 rows 17–20: the sale's number fields write the same events
 * however they are typed. The payload assertions below were written first and
 * passed on the old text fields; only `enter` (how a value is typed) changed
 * when the fields moved to the app number pad.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { entryToSatang, entryToScaled, pressKey, startEntry, type EntryConfig, type EntryKey } from '../core/number-entry';
import { parseKgG, parsePrice } from '../core/sale-points';
import type { SaleEvent, SysPayload } from '../core/types';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { BackfillScreen } from '../v2/sale/backfill-screen';
import { CheckScreen } from '../v2/sale/money-screens';
import { PointScreen } from '../v2/sale/point-screen';
import { StartSaleScreen } from '../v2/sale/start-screen';

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
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismiss: jest.fn(), dismissAll: jest.fn(), dismissTo: jest.fn() };
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
const { __params: params } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> } };

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
const prices = async (id: string) => sys(await store().load(id), 'price_set').map((p) => (p as { satangPerKg: number }).satangPerKg);

let farm: MockFarm;
let n = 0;
let saleId = '';

async function inSale(ui: ReactElement, p: Record<string, string> = {}) {
  params.current = p;
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
}
async function seed(build: (b: LogBuilder) => void) {
  const b = new LogBuilder(saleId);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', buyerId: farm.buyer, manager: 'อ.สมหวัง', workerLead: '', where: 'farm' });
  b.sys({ t: 'pair_set', netG: 50_000, basketG: 2_000 });
  build(b);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
}

/**
 * How a value is typed: the only part that changed with the pad. Each opens the
 * field, types the text and commits it (the old text field's "done"/save, or the
 * pad's ตกลง / ✓). The old text-field version was:
 *   startPrice: press start-price-row, changeText start-price, press sheet-done
 *   optionPrice: press menu-price, changeText option-price, press option-price-save
 *   checkPrice: changeText check-price (the save is pressed by the test)
 *   backfillFull / backfillShort: changeText backfill-full / backfill-short
 */
const typeKeys = async (field: string, keys: string | string[]) => {
  // The first key replaces the value already there.
  for (const k of keys) await press(`${field}-pad-key-${k}`);
};
const enter = {
  startPrice: async (text: string) => {
    await press('start-price-row');
    await typeKeys('start-price', text);
    await press('start-price-done');
  },
  optionPrice: async (text: string) => {
    await press('pick-menu');
    await press('menu-price');
    await typeKeys('option-price', text);
    await press('option-price-done');
  },
  checkPrice: async (text: string) => {
    await press('check-price');
    await typeKeys('check-price', text);
    await press('check-price-done');
  },
  backfillFull: async (text: string) => {
    await press('backfill-full');
    await typeKeys('backfill-full', text);
    await press('backfill-full-pad-key-done');
  },
  backfillShort: async (text: string) => {
    if (!screen.queryByTestId('backfill-short-pad')) await press('backfill-short');
    await typeKeys('backfill-short', text);
    await press('backfill-short-done');
  },
};

beforeAll(async () => {
  farm = await seedMockFarm(master());
});
beforeEach(() => {
  n += 1;
  saleId = `sale-np-${n}`;
  jest.clearAllMocks();
});

describe('row 17 start-price: price_set satangPerKg via parsePrice (NP-4)', () => {
  it('blank: the sale starts with no price (set later)', async () => {
    await inSale(<StartSaleScreen />);
    await press('start-next');
    const ev = await store().load(saleId);
    expect(sys(ev, 'sale_started')).toHaveLength(1);
    expect(sys(ev, 'price_set')).toEqual([]);
  });

  it('52.5 → 5250 satang per kg', async () => {
    await inSale(<StartSaleScreen />);
    await enter.startPrice('52.5');
    await press('start-next');
    expect(await prices(saleId)).toEqual([5250]);
  });

  it('48.50 → 4850; a whole price 26 → 2600', async () => {
    await inSale(<StartSaleScreen />);
    await enter.startPrice('48.50');
    await press('start-next');
    expect(await prices(saleId)).toEqual([4850]);
    n += 1;
    saleId = `sale-np-${n}`;
    await inSale(<StartSaleScreen />);
    await enter.startPrice('26');
    await press('start-next');
    expect(await prices(saleId)).toEqual([2600]);
  });

  it('0 is refused: no price of 0 is ever written', async () => {
    await inSale(<StartSaleScreen />);
    await enter.startPrice('0');
    await press('start-next');
    expect(await prices(saleId)).toEqual([]);
  });
});

describe('row 18 option-price: saves only a set price that differs from the current one (NP-4)', () => {
  const inPoint = () => inSale(<PointScreen />);

  it('no price yet: 52.50 → 5250', async () => {
    await seed(() => undefined);
    await inPoint();
    await enter.optionPrice('52.50');
    expect(await prices(saleId)).toEqual([5250]);
  });

  it('the same price as now writes nothing; a different one writes it', async () => {
    await seed((b) => b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' }));
    await inPoint();
    await enter.optionPrice('48.5');
    expect(await prices(saleId)).toEqual([4850]);
    await enter.optionPrice('49');
    expect(await prices(saleId)).toEqual([4850, 4900]);
  });

  it('0 is refused', async () => {
    await seed(() => undefined);
    await inPoint();
    await enter.optionPrice('0');
    expect(await prices(saleId)).toEqual([]);
  });
});

describe('row 19 check-price: price_set before settling (NP-4)', () => {
  it('48.50 → 4850', async () => {
    await seed(() => undefined);
    await inSale(<CheckScreen />);
    expect(screen.getByTestId('check-price-save').props.accessibilityState).toMatchObject({ disabled: true });
    await enter.checkPrice('48.50');
    await press('check-price-save');
    expect(await prices(saleId)).toEqual([4850]);
  });

  it('0 is refused: save stays off and nothing is written', async () => {
    await seed(() => undefined);
    await inSale(<CheckScreen />);
    await enter.checkPrice('0');
    expect(screen.getByTestId('check-price-save').props.accessibilityState).toMatchObject({ disabled: true });
    await press('check-price-save');
    expect(await prices(saleId)).toEqual([]);
  });
});

describe('row 20 backfill: full count (/^\\d+$/) and short kg net (parseKgG, grams) → events (NP-4)', () => {
  const backfilled = async () => {
    const ev = await store().load(saleId);
    return {
      full: ev.filter((e) => e.kind === 'accept' && e.input === 'backfill').map((e) => {
        const a = e as { basketNo: number; netG: number; tareG: number };
        return [a.basketNo, a.netG, a.tareG];
      }),
      short: ev.filter((e) => e.kind === 'short').map((e) => {
        const s = e as { basketNo: number; readingG: number; tareG: number; backfill?: boolean };
        return [s.basketNo, s.readingG, s.tareG, s.backfill];
      }),
    };
  };
  const at = () => inSale(<BackfillScreen />, { point: farm.a[2] });

  it('3 full + 23.5 kg net: baskets 1–3 at 50 kg, the short one read as 23.5 + 2 kg basket', async () => {
    await seed(() => undefined);
    await at();
    await enter.backfillFull('3');
    await enter.backfillShort('23.5');
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/จะได้ 4 เข่ง/);
    expect(screen.getByTestId('backfill-total')).toHaveTextContent(/173\.5 กก\./);
    await press('backfill-save');
    expect(await backfilled()).toEqual({
      full: [[1, 50_000, 2_000], [2, 50_000, 2_000], [3, 50_000, 2_000]],
      short: [[4, 25_500, 2_000, true]],
    });
  });

  it('three decimals of a kg are kept as grams: 0.125 kg → 125 g net', async () => {
    await seed(() => undefined);
    await at();
    await enter.backfillShort('0.125');
    expect(screen.getByTestId('backfill-total')).toHaveTextContent(/0\.125 กก\./);
    await press('backfill-save');
    expect(await backfilled()).toEqual({ full: [], short: [[1, 2_125, 2_000, true]] });
  });

  it('full only, the short kg left blank: no short basket', async () => {
    await seed(() => undefined);
    await at();
    await enter.backfillFull('2');
    await press('backfill-save');
    expect(await backfilled()).toEqual({ full: [[1, 50_000, 2_000], [2, 50_000, 2_000]], short: [] });
  });

  it('the largest count, 999 full baskets, is taken', async () => {
    await seed(() => undefined);
    await at();
    await enter.backfillFull('999');
    expect(screen.getByTestId('backfill-plan')).toHaveTextContent(/จะได้ 999 เข่ง/);
    expect(screen.getByTestId('backfill-total')).toHaveTextContent(/49,950 กก\./);
  });

  it('nothing typed: nothing to save', async () => {
    await seed(() => undefined);
    await at();
    expect(screen.queryByTestId('backfill-plan')).toBeNull();
    expect(screen.getByTestId('backfill-save').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a short basket of 0 kg is never recorded', async () => {
    await seed(() => undefined);
    await at();
    await enter.backfillShort('0');
    await press('backfill-save');
    expect((await backfilled()).short).toEqual([]);
  });
});

describe('the pad never makes a value the old parsers refuse (NP-4, reverse direction)', () => {
  const typed = (text: string, cfg: EntryConfig) => [...text].reduce((st, k) => pressKey(st, k as EntryKey, cfg), startEntry('')).raw;
  const text = (n: number, decimals: number) => {
    const whole = Math.floor(n / 10 ** decimals);
    const frac = String(n % 10 ** decimals).padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : String(whole);
  };

  it('every price 0.01–999.99 typed on the money pad is the same satang as parsePrice of that text', () => {
    const cfg: EntryConfig = { kind: 'money', maxDigits: 8 };
    for (let satang = 1; satang <= 99_999; satang++) {
      const raw = typed(text(satang, 2), cfg);
      const old = parsePrice(raw);
      if (!old.ok || old.satang !== satang || entryToSatang(raw) !== satang) throw new Error(`${satang}: pad "${raw}" vs parsePrice ${JSON.stringify(old)}`);
    }
  });

  it('short kg net on the decimal pad (4 · 3) is the same grams as parseKgG', () => {
    const cfg: EntryConfig = { kind: 'decimal', maxDigits: 4, decimals: 3 };
    const grams = [1, 9, 10, 100, 125, 999, 1_000, 23_500, 9_999_999];
    for (let g = 1; g <= 9_999_999; g += 997) grams.push(g);
    for (const g of grams) {
      const raw = typed(text(g, 3), cfg);
      if (parseKgG(raw) !== g || entryToScaled(raw, 3) !== g) throw new Error(`${g}: pad "${raw}" vs parseKgG ${parseKgG(raw)}`);
    }
  });
});

describe('E01-S20 sale number fields on the pad (NP-12, NP-14, NP-15, NP-6)', () => {
  it('NP-12: the start price row opens the pad sheet itself, no sheet on a sheet', async () => {
    await inSale(<StartSaleScreen />);
    expect(screen.queryByTestId('start-price-pad')).toBeNull();
    await press('start-price-row');
    expect(screen.getByTestId('start-price-sheet')).toBeTruthy();
    expect(screen.getByTestId('start-price-pad')).toBeTruthy();
    expect(screen.queryByTestId('price-sheet')).toBeNull();
    expect(screen.queryByTestId('start-price-words')).toBeNull();
  });

  it('start price: the row says ใส่ทีหลัง until set; เว้นว่าง (ใส่ทีหลัง) takes a price back to later', async () => {
    await inSale(<StartSaleScreen />);
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/ใส่ทีหลัง/);
    await enter.startPrice('52.5');
    expect(screen.getByTestId('start-price-row')).toHaveTextContent(/52\.50 ฿\/กก\./);
    await press('start-price-row');
    expect(screen.getByTestId('start-price-clear')).toHaveTextContent('เว้นว่าง (ใส่ทีหลัง)');
    await press('start-price-clear');
    expect(screen.queryByTestId('start-price-pad')).toBeNull();
    await press('start-next');
    expect(await prices(saleId)).toEqual([]);
  });

  it('NP-14: 999.99 ฿/kg is the most; a slipped 000 (52 → 52,000) cannot be committed', async () => {
    await inSale(<StartSaleScreen />);
    await enter.startPrice('999.99');
    await press('start-next');
    expect(await prices(saleId)).toEqual([99_999]);
    n += 1;
    saleId = `sale-np-${n}`;
    await inSale(<StartSaleScreen />);
    await press('start-price-row');
    await typeKeys('start-price', '52');
    await press('start-price-pad-key-000');
    expect(screen.getByTestId('start-price-sheet')).toHaveTextContent(/ต้องไม่เกิน 999\.99/);
    expect(screen.getByTestId('start-price-done').props.accessibilityState).toMatchObject({ disabled: true });
    await press('start-price-done');
    await act(async () => fireEvent.press(screen.getByTestId('start-price-sheet-scrim')));
    await flush();
    await press('start-next');
    expect(await prices(saleId)).toEqual([]);
  });

  it('NP-14 at the check: 1000 is refused; NP-14 in the options: an old price over the cap stays until changed', async () => {
    await seed(() => undefined);
    await inSale(<CheckScreen />);
    await press('check-price');
    await typeKeys('check-price', '1000');
    expect(screen.getByTestId('check-price-done').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId('check-price-words')).toBeNull();

    n += 1;
    saleId = `sale-np-${n}`;
    await seed((b) => b.sys({ t: 'price_set', satangPerKg: 150_000, indexRef: '' }));
    await inSale(<PointScreen />);
    await press('pick-menu');
    await press('menu-price');
    expect(screen.getByTestId('option-price-display')).toHaveTextContent('1,500.00');
    expect(screen.getByTestId('option-price-done').props.accessibilityState).toMatchObject({ disabled: true });
    expect(await prices(saleId)).toEqual([150_000]);
    await typeKeys('option-price', '52');
    await press('option-price-done');
    expect(await prices(saleId)).toEqual([150_000, 5_200]);
  });

  it('NP-12 options: the pad opens straight from the menu, with the hint and no เว้นว่าง (a set price cannot be cleared)', async () => {
    await seed((b) => b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' }));
    await inSale(<PointScreen />);
    await press('pick-menu');
    await press('menu-price');
    expect(screen.getByTestId('option-price-pad')).toBeTruthy();
    expect(screen.getByTestId('option-price-below')).toHaveTextContent(/แก้ได้จนกว่าจะปิดการขาย/);
    expect(screen.queryByTestId('option-price-clear')).toBeNull();
    await press('option-price-done');
    expect(screen.queryByTestId('option-price-pad')).toBeNull();
    expect(await prices(saleId)).toEqual([4850]);
  });

  it('NP-15: ✓ on the full baskets opens the short-basket pad at once; it can be closed or left blank', async () => {
    await seed(() => undefined);
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    expect(screen.getByTestId('backfill-short')).toHaveTextContent(/ไม่บังคับ/);
    await press('backfill-full');
    await typeKeys('backfill-full', '12');
    await press('backfill-full-pad-key-done');
    expect(screen.queryByTestId('backfill-full-pad')).toBeNull();
    expect(screen.getByTestId('backfill-short-pad')).toBeTruthy();
    expect(screen.getByTestId('backfill-short-clear')).toHaveTextContent('เว้นว่าง (ไม่มีเข่งไม่เต็ม)');
    await press('backfill-short-clear');
    expect(screen.queryByTestId('backfill-short-pad')).toBeNull();
    expect(screen.getByTestId('backfill-full')).toHaveTextContent(/12\s*เข่ง/);
    expect(screen.getByTestId('backfill-save')).toHaveTextContent('บันทึก 12 เข่ง');
  });

  it('backfill short kg: a fifth whole digit and a fourth decimal do not go in (12345.6789 → 1,234.678); a short one can be cleared again', async () => {
    await seed(() => undefined);
    await inSale(<BackfillScreen />, { point: farm.a[2] });
    await press('backfill-short');
    await typeKeys('backfill-short', '12345.6789');
    expect(screen.getByTestId('backfill-short-display')).toHaveTextContent('1,234.678');
    // The refused key says so and holds ตกลง until a key is taken again.
    expect(screen.getByTestId('backfill-short-done').props.accessibilityState).toMatchObject({ disabled: true });
    await typeKeys('backfill-short', ['back', '8']);
    expect(screen.getByTestId('backfill-short-display')).toHaveTextContent('1,234.678');
    await press('backfill-short-done');
    expect(screen.getByTestId('backfill-total')).toHaveTextContent(/1,234\.678 กก\./);
    await press('backfill-short');
    await press('backfill-short-clear');
    expect(screen.queryByTestId('backfill-plan')).toBeNull();
  });
});
