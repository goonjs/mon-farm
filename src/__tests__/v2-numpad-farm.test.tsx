import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { dayBefore, parsePlantedYear, parseRai, parseTapperPct, thaiDayInput, todayIso } from '../core/master';
import { scaledToEntry } from '../core/number-entry';
import { useI18n } from '../i18n';
import { writeEra } from '../i18n/preference';
import { plantedProblem, PropertyScreen, raiProblem } from '../v2/farm/farms-screens';
import { ShareScreen } from '../v2/farm/shares-screens';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';

/**
 * E01-S20 NP-4 for the farm screens (rows 13–16): what gets saved for each
 * value typed. Written against the old text fields first; only the `type*`
 * helpers change when the fields move to the app number pad — the payload
 * assertions stay exactly as they are.
 */

jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  const holder = { current: new MemoryPeopleStore() };
  return {
    get peopleStore() {
      return holder.current;
    },
    __reset: () => {
      holder.current = new MemoryPeopleStore();
    },
  };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});

const { __params: mockParams } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> } };
const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};

// The era is a device preference kept in localStorage, as on web; React Native's test env has none.
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

const TODAY = todayIso(Date.now());
const THIS_YEAR_BE = new Date(Date.now() + 7 * 3600_000).getUTCFullYear() + 543;

// ---- How a value is typed (the only part that changes with the pad) ----

/** Keys on a field's app pad: `<testID>-pad-key-<k>`. */
const keys = (field: string, text: string) => {
  for (const k of text) fireEvent.press(screen.getByTestId(`${field}-pad-key-${k}`));
};
/** Open the card, type, press ตกลง (decimal) or ✓ (whole numbers). A refused value leaves the sheet open, uncommitted. */
const typeArea = (text: string) => {
  fireEvent.press(screen.getByTestId('property-area'));
  keys('property-area', text);
  fireEvent.press(screen.getByTestId('property-area-done'));
};
const typePlanted = (text: string) => {
  fireEvent.press(screen.getByTestId('property-planted'));
  keys('property-planted', text);
  fireEvent.press(screen.getByTestId('property-planted-pad-key-done'));
};
/** Row 15: the pad sits in the change-area sheet itself; its save button commits. */
const typeAreaNew = (text: string) => keys('area-new', text);
const typeSharePct = (text: string) => {
  fireEvent.press(screen.getByTestId('share-pct'));
  keys('share-pct', text);
  fireEvent.press(screen.getByTestId('share-pct-pad-key-done'));
};

// ---- Screens ----

async function newFarm(fill: () => void) {
  mockParams.current = { id: 'new' };
  wrap(<PropertyScreen />);
  await flush();
  fireEvent.changeText(screen.getByTestId('property-name'), 'สวนบน');
  fireEvent.press(screen.getByTestId('property-crop-rubber'));
  fill();
  await press('property-save');
  return (await master().state()).properties;
}

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  globalThis.localStorage.clear();
});

describe('NP-4 row 13 — property-area saves centiRai through parseRai', () => {
  it('blank = unknown: no area line', async () => {
    const [p] = await newFarm(() => undefined);
    expect(p.areaHistory).toEqual([]);
  });

  it.each([
    ['12.5', 1250],
    ['125', 12500],
    ['0.01', 1],
    ['99999.99', 9999999],
  ])('%s ไร่ → %i centiRai, effective today', async (text, centiRai) => {
    const [p] = await newFarm(() => typeArea(text));
    expect(p.areaHistory).toEqual([expect.objectContaining({ centiRai, effective: TODAY })]);
  });

  it('0 is never saved as an area', async () => {
    const props = await newFarm(() => typeArea('0'));
    expect(props.flatMap((p) => p.areaHistory)).toEqual([]);
  });
});

describe('NP-4 row 14 — property-planted saves plantedYearBe through parsePlantedYear', () => {
  it('blank = unknown: null', async () => {
    const [p] = await newFarm(() => undefined);
    expect(p.plantedYearBe).toBeNull();
  });

  it.each([
    ['2554', 2554],
    ['2011', 2554],
    [String(THIS_YEAR_BE), THIS_YEAR_BE],
  ])('%s → plantedYearBe %i (ค.ศ. < 2400 gets +543)', async (text, yearBe) => {
    const [p] = await newFarm(() => typePlanted(text));
    expect(p.plantedYearBe).toBe(yearBe);
  });

  it.each([String(THIS_YEAR_BE + 1), '25', '0'])('%s is never saved (future year / not 4 digits)', async (text) => {
    const props = await newFarm(() => typePlanted(text));
    expect(props.map((p) => p.plantedYearBe).filter((y) => y !== null)).toEqual([]);
  });

  it('editing keeps the stored year when it is not touched', async () => {
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber', plantedYearBe: 2550 });
    mockParams.current = { id: farm.id, edit: '1' };
    wrap(<PropertyScreen />);
    await flush();
    await press('property-save');
    expect((await master().state()).properties[0].plantedYearBe).toBe(2550);
  });

  it('a stored year the form no longer accepts (e.g. a future year from a fast clock) says why on save, not silently (review N1)', async () => {
    const future = new Date().getFullYear() + 543 + 2;
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber', plantedYearBe: future });
    mockParams.current = { id: farm.id, edit: '1' };
    wrap(<PropertyScreen />);
    await flush();
    expect(screen.queryByTestId('property-planted-error')).toBeNull();
    await press('property-save');
    expect(screen.getByTestId('property-planted-error')).toBeTruthy();
    expect((await master().state()).properties[0].plantedYearBe).toBe(future);
  });
});

describe('NP-4 row 15 — area-new in the change-area sheet: a new dated line', () => {
  async function changeArea(fill: () => void) {
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber' });
    await master().recordArea(farm.id, 12000, '2026-01-01');
    mockParams.current = { id: farm.id };
    wrap(<PropertyScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('change-area'));
    fill();
    await press('area-save');
    return (await master().state()).properties[0].areaHistory;
  }

  it.each([
    ['12.5', 1250],
    ['130', 13000],
    ['99999.99', 9999999],
  ])('%s ไร่ → %i centiRai from today', async (text, centiRai) => {
    const history = await changeArea(() => typeAreaNew(text));
    expect(history.map((a) => [a.centiRai, a.effective])).toEqual([
      [centiRai, TODAY],
      [12000, '2026-01-01'],
    ]);
  });

  it('keeps the effective date typed in the same sheet', async () => {
    const day = dayBefore(TODAY);
    const history = await changeArea(() => {
      typeAreaNew('130');
      fireEvent.changeText(screen.getByTestId('area-new-date'), thaiDayInput(day));
    });
    expect(history[0]).toMatchObject({ centiRai: 13000, effective: day });
  });

  it.each(['', '0'])('"%s" is refused with the reason; nothing saved', async (text) => {
    const history = await changeArea(() => (text ? typeAreaNew(text) : undefined));
    expect(history.map((a) => a.centiRai)).toEqual([12000]);
    expect(screen.getByTestId('area-new-error')).toBeTruthy();
  });
});

describe('NP-4 row 16 — custom share-pct saves the tapper\'s whole percent', () => {
  async function custom(fill: () => void) {
    const daeng = await master().create('แดง', ['tapper']);
    mockParams.current = { id: daeng.id };
    wrap(<ShareScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('share-mode-custom'));
    fill();
    await press('share-save');
    return { daeng, shares: (await master().state()).shares };
  }

  it.each([
    ['55', 55],
    ['0', 0],
    ['100', 100],
  ])('%s%% → tapperPct %i', async (text, tapperPct) => {
    const { daeng, shares } = await custom(() => typeSharePct(text));
    expect(shares).toEqual([expect.objectContaining({ tapperId: daeng.id, tapperPct, from: TODAY })]);
  });

  it.each(['', '120'])('"%s" is never saved', async (text) => {
    const { shares } = await custom(() => (text ? typeSharePct(text) : undefined));
    expect(shares).toEqual([]);
  });

  it('blank custom says why', async () => {
    await custom(() => undefined);
    expect(screen.getByTestId('share-pct-error')).toBeTruthy();
  });
});

// ---- On the pad only (E01-S20): what the old text fields could not show ----

describe('rows 13–14 on the pad: the reason shows and ✓ / ตกลง stays shut (NP-5, NP-6)', () => {
  async function form() {
    mockParams.current = { id: 'new' };
    wrap(<PropertyScreen />);
    await flush();
  }

  it('area: the decimal pad, 0 refused with a short reason, 2 decimals at most, "เว้นว่าง (ไม่ทราบ)" clears', async () => {
    await form();
    expect(within(screen.getByTestId('property-area')).getByText('ไม่ทราบ')).toBeTruthy();
    fireEvent.press(screen.getByTestId('property-area'));
    expect(screen.queryByTestId('property-area-pad-key-00')).toBeNull();
    keys('property-area', '0');
    expect(screen.getByText('ต้องมากกว่า 0')).toBeTruthy();
    expect(screen.getByTestId('property-area-done').props.accessibilityState).toMatchObject({ disabled: true });
    keys('property-area', '.12');
    expect(screen.getByTestId('property-area-display').props.children).toBe('0.12');
    keys('property-area', '5');
    expect(screen.getByText('ใหญ่เกินไป')).toBeTruthy();
    fireEvent.press(screen.getByTestId('property-area-pad-key-back'));
    keys('property-area', '2');
    fireEvent.press(screen.getByTestId('property-area-done'));
    expect(within(screen.getByTestId('property-area')).getByText('0.12')).toBeTruthy();
    expect(within(screen.getByTestId('property-area')).getByText('ไร่')).toBeTruthy();

    fireEvent.press(screen.getByTestId('property-area'));
    fireEvent.press(screen.getByTestId('property-area-clear'));
    expect(within(screen.getByTestId('property-area')).getByText('ไม่ทราบ')).toBeTruthy();
  });

  it('planted year: no grouping, 4 digits, future and short years refused with their reason', async () => {
    await form();
    fireEvent.press(screen.getByTestId('property-planted'));
    keys('property-planted', '25');
    expect(screen.getByText('ปีไม่ถูกต้อง')).toBeTruthy();
    expect(screen.getByTestId('property-planted-pad-key-done').props.accessibilityState).toMatchObject({ disabled: true });
    keys('property-planted', String(THIS_YEAR_BE + 1).slice(2));
    expect(screen.getByTestId('property-planted-display').props.children).toBe(String(THIS_YEAR_BE + 1));
    expect(screen.getByText('ปีนี้ยังไม่ถึง')).toBeTruthy();
  });

  it('the old "ไม่ทราบ" pills beside area and year are gone; the GPS hint wraps instead of being cut (Q6)', async () => {
    await form();
    // One "ไม่ทราบ" in each empty card; GPS has no pill beside it either (d0), so its box is full width.
    expect(screen.getAllByText('ไม่ทราบ')).toHaveLength(2);
    expect(screen.getByTestId('property-gps').props.multiline).toBe(true);
    fireEvent.changeText(screen.getByTestId('property-gps'), '12.6113,\n102.1035');
    expect(screen.getByTestId('property-gps').props.value).toBe('12.6113, 102.1035');
  });
});

function EraSwitch() {
  const { toggleEra } = useI18n();
  return <Pressable testID="era-switch" onPress={toggleEra} />;
}

describe('NP-13 the planted year follows the device era; what is kept stays พ.ศ.', () => {
  const card = () => within(screen.getByTestId('property-planted'));

  it('พ.ศ. device: typing 2011 shows 2554 พ.ศ. after ✓ and keeps 2554', async () => {
    const [p] = await newFarm(() => {
      typePlanted('2011');
      expect(card().getByText('2554')).toBeTruthy();
      expect(card().getByText('พ.ศ.')).toBeTruthy();
    });
    expect(p.plantedYearBe).toBe(2554);
  });

  it('ค.ศ. device: a stored 2554 shows as 2011 ค.ศ.; typed พ.ศ. or ค.ศ. both show ค.ศ. and keep พ.ศ.', async () => {
    writeEra('ce');
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber', plantedYearBe: 2554 });
    mockParams.current = { id: farm.id, edit: '1' };
    wrap(<PropertyScreen />);
    await flush();
    expect(card().getByText('2011')).toBeTruthy();
    expect(card().getByText('ค.ศ.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('property-planted'));
    expect(screen.getByTestId('property-planted-display').props.children).toBe('2011');
    fireEvent.press(screen.getByTestId('property-planted-pad-key-done'));
    typePlanted('2560');
    expect(card().getByText('2017')).toBeTruthy();
    await press('property-save');
    expect((await master().state()).properties[0].plantedYearBe).toBe(2560);
    typePlanted('2007');
    expect(card().getByText('2007')).toBeTruthy();
    await press('property-save');
    expect((await master().state()).properties[0].plantedYearBe).toBe(2550);
  });

  it('switching พ.ศ./ค.ศ. moves the card with it; the saved year does not change', async () => {
    mockParams.current = { id: 'new' };
    wrap(
      <>
        <EraSwitch />
        <PropertyScreen />
      </>,
    );
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนบน');
    fireEvent.press(screen.getByTestId('property-crop-rubber'));
    typePlanted('2554');
    expect(card().getByText('2554')).toBeTruthy();
    fireEvent.press(screen.getByTestId('era-switch'));
    expect(card().getByText('2011')).toBeTruthy();
    expect(card().getByText('ค.ศ.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('era-switch'));
    expect(card().getByText('2554')).toBeTruthy();
    expect(card().getByText('พ.ศ.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('era-switch'));
    await press('property-save');
    expect((await master().state()).properties[0].plantedYearBe).toBe(2554);
  });
});

describe('row 15: the decimal pad is in the change-area sheet itself (NP-12)', () => {
  it('no second sheet; the date field keeps working and turns the pad off while typed', async () => {
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber' });
    mockParams.current = { id: farm.id };
    wrap(<PropertyScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('change-area'));
    const sheet = within(screen.getByTestId('area-sheet'));
    expect(sheet.getByTestId('area-new-pad')).toBeTruthy();
    expect(sheet.queryByTestId('area-new-pad-key-00')).toBeNull();
    expect(screen.queryByTestId('area-new-sheet')).toBeNull();
    keys('area-new', '12.345');
    expect(screen.getByTestId('area-new-display').props.children).toBe('12.34');
    fireEvent(screen.getByTestId('area-new-date'), 'focus');
    expect(screen.queryByTestId('area-new-pad')).toBeNull();
    fireEvent(screen.getByTestId('area-new-date'), 'blur');
    keys('area-new', '.');
    // "12." is twelve, not a refusal.
    fireEvent.press(screen.getByTestId('area-new-pad-key-back'));
    fireEvent.press(screen.getByTestId('area-new-pad-key-back'));
    expect(screen.getByTestId('area-new-display').props.children).toBe('12.');
    await press('area-save');
    expect((await master().state()).properties[0].areaHistory.map((a) => a.centiRai)).toEqual([1200]);
  });
});

describe('row 16 on the pad', () => {
  it('over 100 is refused with "ต้องไม่เกิน 100"; the owner\'s share shows on the card', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    mockParams.current = { id: daeng.id };
    wrap(<ShareScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('share-mode-custom'));
    expect(screen.getByText(/^คนกรีดยางได้ \(%\)/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('share-pct'));
    keys('share-pct', '120');
    expect(screen.getByText('ต้องไม่เกิน 100')).toBeTruthy();
    expect(screen.getByTestId('share-pct-pad-key-done').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('share-pct-pad-key-back'));
    fireEvent.press(screen.getByTestId('share-pct-pad-key-done'));
    expect(within(screen.getByTestId('share-pct')).getByText('12')).toBeTruthy();
    expect(within(screen.getByTestId('share-pct')).getByText('→ เจ้าของสวน 88%')).toBeTruthy();
  });
});

describe('NP-4 the other way: every value the pad can make goes through the old parser unchanged', () => {
  it('ไร่ (5 · 2): the pad value is what parseRai makes of the same text; only 0 is refused', () => {
    const values = [...Array.from({ length: 200_001 }, (_, i) => i), ...Array.from({ length: 1000 }, (_, i) => 9_999_999 - i)];
    const wrong = values.filter((n) => {
      const r = parseRai(scaledToEntry(n, 2));
      const refused = raiProblem(n, 'x') !== undefined;
      return n > 0 ? refused || !r.ok || r.centiRai !== n : !refused;
    });
    expect(wrong).toEqual([]);
  });

  it('ปีที่ปลูก (4 · 0): ✓ opens exactly when parsePlantedYear takes the text', () => {
    const now = Date.now();
    const wrong = Array.from({ length: 10_000 }, (_, n) => n).filter(
      (n) => (plantedProblem(n, now, { bad: 'b', future: 'f' }) === undefined) !== parsePlantedYear(String(n), now).ok,
    );
    expect(wrong).toEqual([]);
  });

  it('% (3 · 0, max 100): the pad\'s limit is parseTapperPct\'s', () => {
    for (let n = 0; n <= 999; n++) expect(parseTapperPct(String(n)).ok).toBe(n <= 100);
  });
});
