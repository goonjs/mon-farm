import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { dayAfter, saleSettings, thaiDayInput, todayIso } from '../core/master';
import { BuyersScreen } from '../v2/farm/buyers-screen';
import { PropertyScreen } from '../v2/farm/farms-screens';
import { PersonScreen } from '../v2/farm/people-screens';
import { PointScreen, PointsWizardScreen } from '../v2/farm/points-screens';
import { SaleSettingsScreen } from '../v2/farm/sale-settings-screen';
import { ShareScreen } from '../v2/farm/shares-screens';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';

/**
 * A write that fails (quota, IndexedDB errors) must not be silent: the screen
 * says "บันทึกไม่สำเร็จ ลองอีกครั้ง", keeps what was typed, and a second tap
 * neither duplicates nor loses anything.
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
jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
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
const failOnce = <K extends keyof MasterStore>(name: K) =>
  jest.spyOn(master(), name as never).mockRejectedValueOnce(new Error('QuotaExceededError') as never);
const FAILED = 'บันทึกไม่สำเร็จ ลองอีกครั้ง';

const TODAY = todayIso(Date.now());
function ahead(days: number) {
  let d = TODAY;
  for (let i = 0; i < days; i++) d = dayAfter(d);
  return d;
}

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  for (const fn of Object.values(mockRouter)) fn.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('a failed save says so and keeps the form', () => {
  it('person: stays with the name typed; the retry saves once', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PersonScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('person-name'), 'แดง');
    fireEvent.press(screen.getByTestId('role-tapper'));
    failOnce('create');
    await press('person-save');
    expect(within(screen.getByTestId('save-failed')).getByText(FAILED)).toBeTruthy();
    expect(screen.getByTestId('person-name').props.value).toBe('แดง');
    expect(mockRouter.back).not.toHaveBeenCalled();
    await press('person-save');
    expect((await master().state()).people.map((p) => p.name)).toEqual(['แดง']);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('new farm with an area: when the area fails, the retry edits that farm instead of adding a second', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PropertyScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนบน');
    fireEvent.press(screen.getByTestId('property-crop-rubber'));
    fireEvent.changeText(screen.getByTestId('property-area'), '125');
    failOnce('recordArea');
    await press('property-save');
    expect(screen.getByTestId('save-failed')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนบนเขา');
    await press('property-save');
    const { properties } = await master().state();
    expect(properties).toHaveLength(1);
    expect(properties[0]).toMatchObject({ name: 'สวนบนเขา', areaHistory: [expect.objectContaining({ centiRai: 12500 })] });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('a new dated area: the sheet stays open with the error', async () => {
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber' });
    mockParams.current = { id: farm.id };
    wrap(<PropertyScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('change-area'));
    fireEvent.changeText(screen.getByTestId('area-new'), '130');
    failOnce('recordArea');
    await press('area-save');
    expect(within(screen.getByTestId('area-sheet')).getByTestId('save-failed')).toBeTruthy();
    expect(screen.getByTestId('area-new').props.value).toBe('130');
  });

  it('point: a failed add is reported, not thrown', async () => {
    const farm = await master().addProperty({ name: 'สวน', crop: 'rubber' });
    mockParams.current = { id: 'new', property: farm.id };
    wrap(<PointScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('point-name'), 'จุด 1');
    failOnce('addPoint');
    await press('point-save');
    expect(screen.getByTestId('save-failed')).toBeTruthy();
    expect(screen.queryByTestId('offer-assign')).toBeNull();
    await press('point-save');
    expect(screen.getByTestId('offer-assign')).toBeTruthy();
    expect((await master().state()).points).toHaveLength(1);
  });

  it('แก้แผน writes the new plan before cancelling the old, so a failure loses nothing', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const nat = await m.create('นัด', ['tapper']);
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(pt.id, daeng.id, null);
    const old = await m.assignTapper(pt.id, nat.id, ahead(30));
    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();

    await press(`edit-plan-${old}`);
    fireEvent.changeText(screen.getByTestId('plan-from'), thaiDayInput(ahead(40)));
    fireEvent.press(screen.getByTestId(`plan-tapper-${nat.id}`));
    failOnce('assignTapper');
    await press('plan-save');
    expect(within(screen.getByTestId('plan-sheet')).getByTestId('save-failed')).toBeTruthy();
    // The new one failed: the old plan is still there.
    expect((await m.state()).assignments.find((a) => a.assignmentId === old)?.deleted).toBe(false);

    failOnce('remove');
    await press('plan-save');
    // The new one is written; cancelling the old failed — both stand, nothing lost.
    let live = (await m.state()).assignments.filter((a) => !a.deleted && a.tapperId === nat.id);
    expect(live.map((a) => a.from).sort()).toEqual([ahead(30), ahead(40)]);
    expect(screen.getByTestId('save-failed')).toBeTruthy();

    await press('plan-save');
    live = (await m.state()).assignments.filter((a) => !a.deleted && a.tapperId === nat.id);
    // The retry only cancels the old one; the new one is not written twice.
    expect(live.map((a) => a.from)).toEqual([ahead(40)]);
    expect(screen.queryByTestId('save-failed')).toBeNull();
  });

  it('set-up helper: a failed create stays on the names page', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    wrap(<PointsWizardScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${daeng.id}`));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.changeText(screen.getByTestId(`wizard-name-${daeng.id}-0`), 'จุด 1');
    failOnce('createStarterPoints');
    await press('wizard-create');
    expect(screen.getByTestId('save-failed')).toBeTruthy();
    expect(screen.getByTestId(`wizard-name-${daeng.id}-0`).props.value).toBe('จุด 1');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('buyer: the sheet stays open with the name', async () => {
    wrap(<BuyersScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('add-buyer'));
    fireEvent.changeText(screen.getByTestId('buyer-name'), 'คนรับซื้อยาง ก');
    failOnce('addBuyer');
    await press('buyer-save');
    expect(within(screen.getByTestId('buyer-sheet')).getByTestId('save-failed')).toBeTruthy();
    expect(screen.getByTestId('buyer-name').props.value).toBe('คนรับซื้อยาง ก');
    await press('buyer-save');
    expect((await master().state()).buyers.map((b) => b.name)).toEqual(['คนรับซื้อยาง ก']);
  });

  it('share: says so and keeps the percent', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    mockParams.current = { id: daeng.id };
    wrap(<ShareScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('share-mode-custom'));
    fireEvent.changeText(screen.getByTestId('share-pct'), '55');
    failOnce('setShare');
    await press('share-save');
    expect(screen.getByTestId('save-failed')).toBeTruthy();
    expect(screen.getByTestId('share-pct').props.value).toBe('55');
  });

  it('sale settings: a setting that did not save says so', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    failOnce('updateSettings');
    await press('numbering-per-point');
    expect(screen.getByTestId('save-failed')).toBeTruthy();
    expect(saleSettings(await master().state()).numbering).not.toBe('per-point');
  });

  it('delete: the confirm sheet stays open and says so', async () => {
    const daeng = await master().create('แดง', ['tapper']);
    mockParams.current = { id: daeng.id };
    wrap(<PersonScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('person-delete'));
    failOnce('remove');
    await press('delete-confirm-yes');
    expect(within(screen.getByTestId('delete-confirm')).getByTestId('save-failed')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect((await master().state()).people[0].deleted).toBe(false);
  });
});
