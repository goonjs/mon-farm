import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { formatThaiDate, saleSettings, thaiDayInput, todayIso } from '../core/master';
import { readCountMode, readHoldMs } from '../store/hold-preference';
import { SaleSettingsScreen } from '../v2/farm/sale-settings-screen';
import { ShareScreen, SharesScreen } from '../v2/farm/shares-screens';
import { SpeechProvider } from '../speech';
import { V2Device } from '../v2/device-screen';
import { readWeighMode } from '../store/weigh-mode-preference';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';

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

const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: Record<'push' | 'replace' | 'back' | 'setParams', jest.Mock>;
};
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
const TODAY = todayIso(Date.now());

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

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  for (const fn of Object.values(mockRouter)) fn.mockClear();
  globalThis.localStorage?.clear();
});

describe('ส่วนแบ่ง (farm mockup 17)', () => {
  it('lists tappers with today\'s share; a tap opens theirs', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    await master().create('อาจารย์สมหวัง', ['manager']);
    wrap(<SharesScreen />);
    await flush();
    const row = screen.getByTestId(`share-${daeng.id}`);
    expect(within(row).getByText('คนกรีดยาง 50%')).toBeTruthy();
    expect(within(row).getByText('ค่าเริ่มต้น')).toBeTruthy();
    expect(screen.queryByText('อาจารย์สมหวัง')).toBeNull();
    fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/share/${daeng.id}`);
  });

  it('50/50 by default; custom takes the tapper\'s whole percent, shows the owner\'s, and starts on a day', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    mockParams.current = { id: daeng.id };
    wrap(<ShareScreen />);
    await flush();
    expect(within(screen.getByTestId('share-now')).getByText('คนกรีดยาง 50%')).toBeTruthy();
    expect(within(screen.getByTestId('share-history')).getByText('ยังไม่เคยเปลี่ยน')).toBeTruthy();

    fireEvent.press(screen.getByTestId('share-mode-custom'));
    fireEvent.changeText(screen.getByTestId('share-pct'), '55.5');
    await press('share-save');
    expect(within(screen.getByTestId('share-pct-error')).getByText('ใส่เป็นจำนวนเต็ม เช่น 55')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('share-pct'), '120');
    await press('share-save');
    expect(within(screen.getByTestId('share-pct-error')).getByText('ใส่ได้ตั้งแต่ 0 ถึง 100')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('share-pct'), '55');
    expect(screen.getByText('→ เจ้าของสวน 45%')).toBeTruthy();
    expect(screen.getByTestId('share-from').props.value).toBe(thaiDayInput(TODAY));
    await press('share-save');

    const state = await master().state();
    expect(state.shares).toEqual([expect.objectContaining({ tapperId: daeng.id, tapperPct: 55, from: TODAY })]);
    expect(within(screen.getByTestId('share-now')).getByText('คนกรีดยาง 55%')).toBeTruthy();
    expect(within(screen.getByTestId('share-history')).getByText(/คนกรีดยาง 55%/)).toBeTruthy();
  });

  it('refuses a start on or before the tapper\'s latest closed sale, naming the first day allowed', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    jest.spyOn(master(), 'lastClosedSaleDay').mockResolvedValue(TODAY);
    mockParams.current = { id: daeng.id };
    wrap(<ShareScreen />);
    await flush();
    await press('share-save');
    expect(screen.getByTestId('share-too-early')).toBeTruthy();
    expect(within(screen.getByTestId('share-too-early')).getByText(new RegExp(formatThaiDate(Date.parse(`${TODAY}T12:00:00+07:00`), 'be')))).toBeTruthy();
    expect((await master().state()).shares).toEqual([]);
  });
});

describe('ตั้งค่าวันขาย (farm mockup 3)', () => {
  it('scale type: whole kg on, one decimal shown but not selectable yet', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    expect(screen.getByTestId('scale-whole').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('scale-decimal1').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('every group setting saves on its own as a master event', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    await press('numbering-per-point');
    await press('zero-skip');
    await press('dup-more');
    await press('dup-more');
    await press('dup-more');
    await press('make-default-builtin-60');

    const s = saleSettings(await master().state());
    expect(s).toMatchObject({ numbering: 'per-point', zeroCheck: 'skip', dupWindowS: 10 });
    expect(s.pairs.find((p) => p.isDefault)?.pairId).toBe('builtin-60');
    expect(screen.getByTestId('dup-value').props.children).toBe('10');
  });

  it('adds a net + basket pair in whole kg, showing what the scale should read', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('add-pair'));
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('new-net-more'));
    fireEvent.press(screen.getByTestId('new-basket-more'));
    expect(screen.getByText('ตาชั่งควรอ่าน 58 กก.')).toBeTruthy();
    await press('save-pair');
    const pairs = saleSettings(await master().state()).pairs;
    expect(pairs.map((p) => [p.netG, p.basketG])).toContainEqual([55000, 3000]);
  });

  it('hold time is this device\'s only, labelled so, and stays within 0.5–1 s', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    expect(screen.getByTestId('hold-device-only')).toBeTruthy();
    fireEvent.press(screen.getByTestId('hold-more'));
    expect(readHoldMs()).toBe(800);
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('hold-more'));
    expect(readHoldMs()).toBe(1000);
  });

  it('counting by hold or by tap is this device\'s choice; tap hides the hold time (E04-S17)', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    expect(readCountMode()).toBe('hold');
    expect(screen.getByTestId('count-mode-hold').props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByTestId('count-mode-tap'));
    expect(readCountMode()).toBe('tap');
    expect(screen.queryByTestId('hold')).toBeNull();
    fireEvent.press(screen.getByTestId('count-mode-hold'));
    expect(screen.getByTestId('hold-more')).toBeTruthy();
  });
});

describe('เครื่องนี้ (device-only settings)', () => {
  it('theme, hold time, speech, language and the date era — nothing here syncs', async () => {
    wrap(
      <SpeechProvider initial>
        <V2Device />
      </SpeechProvider>,
    );
    await flush();
    expect(screen.getByTestId('device-theme-light').props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByTestId('device-theme-dark'));
    expect(screen.getByTestId('device-theme-dark').props.accessibilityState).toMatchObject({ checked: true });

    fireEvent.press(screen.getByTestId('device-hold-less'));
    expect(readHoldMs()).toBe(600);
    fireEvent.press(screen.getByTestId('device-count-mode-tap'));
    expect(readCountMode()).toBe('tap');
    fireEvent.press(screen.getByTestId('device-count-mode-hold'));

    expect(screen.getByTestId('device-weigh-mode-type').props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByTestId('device-weigh-mode-dial'));
    expect(screen.getByTestId('device-weigh-mode-dial').props.accessibilityState).toMatchObject({ checked: true });
    expect(readWeighMode()).toBe('dial');

    fireEvent.press(screen.getByTestId('device-speech-off'));
    expect(screen.getByTestId('device-speech-off').props.accessibilityState).toMatchObject({ checked: true });

    fireEvent.press(screen.getByTestId('device-era-ce'));
    expect(screen.getByTestId('device-era-ce').props.accessibilityState).toMatchObject({ checked: true });

    fireEvent.press(screen.getByTestId('device-language-en'));
    expect(screen.getByTestId('screen-title').props.children).toBe('this device');
    expect(await master().state()).toMatchObject({ people: [], shares: [] });
  });
});
