import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { dayAfter, dayBefore, thaiDayInput, todayIso } from '../core/master';
import { FarmsScreen, PropertyScreen } from '../v2/farm/farms-screens';
import { PointScreen, PointsScreen, PointsWizardScreen } from '../v2/farm/points-screens';
import type { MasterStore } from '../store/master-store';
import { store as mockStore } from '../store/store';
import { emitSyncChanged, setEngineStatus, setSyncMode } from '../sync/changed';
import { newGroup } from '../core/group';
import { userFromSignIn } from '../core/user';
import { accountStore as mockAccounts } from '../store/account';
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
jest.mock('../store/account', () => {
  const { MemoryAccountStore } = jest.requireActual('../store/account-memory');
  return { accountStore: new MemoryAccountStore() };
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
/** A day a month ahead, as typed (d/m/yyyy พ.ศ.). */
function ahead(days: number) {
  let d = TODAY;
  for (let i = 0; i < days; i++) d = dayAfter(d);
  return d;
}

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  for (const fn of Object.values(mockRouter)) fn.mockClear();
});

describe('สวนและจุดชั่ง — list (farm mockup 9)', () => {
  it('shows crop, today\'s area or ไม่ทราบ, and the point count; deleted farms behind the link', async () => {
    const m = master();
    const a = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    await m.recordArea(a.id, 12500, TODAY);
    await m.addPoint(a.id, 'จุด 1');
    const b = await m.addProperty({ name: 'ทุเรียน ตะเคียนทอง', crop: 'durian' });
    const c = await m.addProperty({ name: 'สวนเก่า', crop: 'rubber' });
    await m.remove(c.id);

    wrap(<FarmsScreen />);
    await flush();

    const rowA = screen.getByTestId(`farm-${a.id}`);
    expect(within(rowA).getByText('ยาง')).toBeTruthy();
    expect(within(rowA).getByText('125 ไร่')).toBeTruthy();
    expect(within(rowA).getByText('1 จุดชั่ง')).toBeTruthy();
    const rowB = screen.getByTestId(`farm-${b.id}`);
    expect(within(rowB).getByText('ทุเรียน')).toBeTruthy();
    expect(within(rowB).getByText('ไม่ทราบ')).toBeTruthy();
    expect(screen.queryByText('สวนเก่า')).toBeNull();
    // The helper stays on offer once points exist (repeatable set-up).
    expect(screen.getByTestId('open-wizard')).toBeTruthy();

    fireEvent.press(rowA);
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/property/${a.id}`);
    fireEvent.press(screen.getByTestId('add-farm'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/property/new');
    fireEvent.press(screen.getByTestId('show-deleted'));
    expect(within(screen.getByTestId(`deleted-${c.id}`)).getByText('ลบแล้ว')).toBeTruthy();
  });

  it('offers the set-up helper while the group has farms but no points (D-73)', async () => {
    await master().addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    wrap(<FarmsScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('open-wizard'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/points-wizard');
  });
});

describe('สวน — form (farm mockup 10)', () => {
  it('Save sits in the header, with no pinned bar at the bottom', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PropertyScreen />);
    await flush();
    const header = screen.getByTestId('screen-header');
    expect(within(header).getByTestId('property-save')).toBeTruthy();
    expect(screen.getAllByTestId(/-save$/)).toHaveLength(1);
  });

  it('needs only a name and a crop; blank area, year and GPS stay unknown', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PropertyScreen />);
    await flush();
    expect(screen.getByTestId('screen-title').props.children).toBe('เพิ่มสวน');
    await press('property-save');
    expect(screen.getByTestId('property-name-error')).toBeTruthy();
    expect(screen.getByTestId('property-crop-error')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('property-name'), 'ทุเรียน ตะเคียนทอง');
    fireEvent.press(screen.getByTestId('property-crop-durian'));
    expect(screen.getAllByText('ไม่ทราบ').length).toBeGreaterThanOrEqual(3);
    await press('property-save');

    const [p] = (await master().state()).properties;
    expect(p).toMatchObject({ name: 'ทุเรียน ตะเคียนทอง', crop: 'durian', plantedYearBe: null, gps: null, areaHistory: [] });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('a typed area takes effect today; bad values are refused with the reason, keeping the input', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PropertyScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนจันทเขลม');
    fireEvent.press(screen.getByTestId('property-crop-rubber'));
    fireEvent.changeText(screen.getByTestId('property-area'), '0');
    fireEvent.changeText(screen.getByTestId('property-planted'), '25');
    await press('property-save');
    expect(screen.getByTestId('property-area-error')).toBeTruthy();
    expect(screen.getByTestId('property-planted-error')).toBeTruthy();
    expect(screen.getByTestId('property-area').props.value).toBe('0');

    fireEvent.changeText(screen.getByTestId('property-area'), '125');
    fireEvent.changeText(screen.getByTestId('property-planted'), '2554');
    fireEvent.changeText(screen.getByTestId('property-gps'), '12.6113, 102.1035');
    await press('property-save');
    const [p] = (await master().state()).properties;
    expect(p.areaHistory).toEqual([expect.objectContaining({ centiRai: 12500, effective: TODAY })]);
    expect(p.plantedYearBe).toBe(2554);
    expect(p.gps).toEqual({ latE6: 12611300, lngE6: 102103500 });
  });

  it('edits name and crop in place', async () => {
    const p = await master().addProperty({ name: 'สวน', crop: 'rubber' });
    mockParams.current = { id: p.id, edit: '1' };
    wrap(<PropertyScreen />);
    await flush();
    expect(screen.getByTestId('property-name').props.value).toBe('สวน');
    expect(screen.queryByTestId('property-area')).toBeNull();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนฝั่งคลองพลู');
    await press('property-save');
    expect((await master().state()).properties[0].name).toBe('สวนฝั่งคลองพลู');
  });
});

describe('สวน — detail, area history, delete (farm mockup 11, 12)', () => {
  it('a new area is a new dated line; the old one stays in the history', async () => {
    const m = master();
    const p = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber', plantedYearBe: 2554 });
    await m.recordArea(p.id, 12000, '2026-01-01');
    mockParams.current = { id: p.id };
    wrap(<PropertyScreen />);
    await flush();
    expect(within(screen.getByTestId('property-area-now')).getByText('120 ไร่')).toBeTruthy();
    expect(within(screen.getByTestId('property-planted')).getByText('2554')).toBeTruthy();
    expect(within(screen.getByTestId('property-gps')).getByText('ไม่ทราบ')).toBeTruthy();

    fireEvent.press(screen.getByTestId('change-area'));
    fireEvent.changeText(screen.getByTestId('area-new'), '125');
    fireEvent.changeText(screen.getByTestId('area-new-date'), thaiDayInput(TODAY));
    await press('area-save');

    const history = (await m.state()).properties[0].areaHistory;
    expect(history.map((a) => a.centiRai)).toEqual([12500, 12000]);
    expect(within(screen.getByTestId('area-history')).getByText('125 ไร่')).toBeTruthy();
    expect(within(screen.getByTestId('area-history')).getByText('120 ไร่')).toBeTruthy();
    expect(within(screen.getByTestId('area-history')).getByText('ใช้อยู่')).toBeTruthy();
  });

  it('lists the farm\'s points with today\'s tapper; adds a point; delete warns its points go too', async () => {
    const m = master();
    const p = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const p1 = await m.addPoint(p.id, 'จุด 1');
    await m.addPoint(p.id, 'จุด 2');
    await m.assignTapper(p1.id, daeng.id, null);
    mockParams.current = { id: p.id };
    wrap(<PropertyScreen />);
    await flush();

    const points = screen.getByTestId('property-points');
    expect(within(points).getByText('จุดชั่ง (2)')).toBeTruthy();
    expect(within(screen.getByTestId(`point-${p1.id}`)).getByText('แดง')).toBeTruthy();
    expect(within(points).getByText('ยังไม่มีคนกรีด')).toBeTruthy();
    fireEvent.press(screen.getByTestId('add-point'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/point/new?property=${p.id}`);

    fireEvent.press(screen.getByTestId('property-delete'));
    expect(within(screen.getByTestId('delete-warning')).getByText('จุดชั่ง 2 จุดในสวนนี้ถูกลบไปด้วย')).toBeTruthy();
    await press('delete-confirm-yes');
    const state = await m.state();
    expect(state.properties[0].deleted).toBe(true);
    expect(state.points.every((x) => x.hidden)).toBe(true);
  });
});

describe('จุดชั่ง — add, offer to assign, detail, plan (farm mockup 14–16)', () => {
  it('refuses a name already used in that farm; after saving offers to assign a tapper now or later', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    await m.addPoint(farm.id, 'จุด 1');
    mockParams.current = { id: 'new', property: farm.id };
    wrap(<PointScreen />);
    await flush();
    expect(screen.getByText('สวนจันทเขลม')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('point-name'), 'จุด 1');
    await press('point-save');
    expect(within(screen.getByTestId('point-name-error')).getByText('มีจุดชื่อ "จุด 1" ในสวนนี้แล้ว')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('point-name'), 'จุด 5');
    await press('point-save');
    expect(screen.getByTestId('offer-assign')).toBeTruthy();
    const made = (await m.state()).points.find((x) => x.name === 'จุด 5')!;
    fireEvent.press(screen.getByTestId('offer-now'));
    expect(mockRouter.replace).toHaveBeenLastCalledWith(`/v2/point/${made.id}?plan=1`);
  });

  it('shows who taps it now; plans a new tapper ahead, previews the hand-over, and can cancel the plan', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const nat = await m.create('นัด', ['tapper']);
    const pt = await m.addPoint(farm.id, 'จุด 3');
    await m.assignTapper(pt.id, daeng.id, null);
    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();

    expect(screen.getByTestId('screen-title').props.children).toBe('จุด 3');
    const timeline = screen.getByTestId('timeline');
    expect(within(timeline).getByText('แดง')).toBeTruthy();
    expect(within(timeline).getByText('ตอนนี้')).toBeTruthy();

    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId(`plan-tapper-${nat.id}`));
    fireEvent.changeText(screen.getByTestId('plan-from'), thaiDayInput(ahead(30)));
    expect(screen.getByTestId('plan-preview')).toBeTruthy();
    await press('plan-save');

    const planned = (await m.state()).assignments.filter((a) => !a.deleted && a.tapperId === nat.id);
    expect(planned).toHaveLength(1);
    expect(within(screen.getByTestId('timeline')).getByText('ตามแผน ยังไม่ถึงวัน')).toBeTruthy();
    await press(`cancel-plan-${planned[0].assignmentId}`);
    expect((await m.state()).assignments.find((a) => a.assignmentId === planned[0].assignmentId)?.deleted).toBe(true);
  });

  it('a first assignment may have no start day; opening with ?plan=1 shows the plan sheet', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const pt = await m.addPoint(farm.id, 'จุด 1');
    mockParams.current = { id: pt.id, plan: '1' };
    wrap(<PointScreen />);
    await flush();
    expect(within(screen.getByTestId('timeline')).getByText('ยังไม่มีคนกรีด')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`plan-tapper-${daeng.id}`));
    await press('plan-save');
    expect((await m.state()).assignments).toEqual([expect.objectContaining({ tapperId: daeng.id, from: null })]);
  });

  it('?property= naming a missing or deleted farm says not found, and nothing can be saved', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนเก่า', crop: 'rubber' });
    await m.remove(farm.id);
    for (const property of [farm.id, 'no-such-farm']) {
      mockParams.current = { id: 'new', property };
      const { unmount } = wrap(<PointScreen />);
      await flush();
      expect(screen.getByTestId('not-found')).toBeTruthy();
      expect(screen.queryByTestId('point-save')).toBeNull();
      unmount();
    }
    expect((await m.state()).points).toEqual([]);
  });

  it('ลาออก: the last day is checked like the others — a date, a tapper in place, not before they started', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const nat = await m.create('นัด', ['tapper']);
    const empty = await m.addPoint(farm.id, 'จุดว่าง');
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(pt.id, daeng.id, null);
    let tenAgo = TODAY;
    for (let i = 0; i < 10; i++) tenAgo = dayBefore(tenAgo);
    await m.assignTapper(pt.id, nat.id, tenAgo);
    const before = (await m.state()).assignments.length;

    mockParams.current = { id: empty.id };
    const { unmount } = wrap(<PointScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId('plan-leave'));
    fireEvent.changeText(screen.getByTestId('plan-to'), thaiDayInput(ahead(5)));
    await press('plan-save');
    expect(within(screen.getByTestId('plan-to-error')).getByText('วันนั้นจุดนี้ไม่มีคนกรีด')).toBeTruthy();
    unmount();

    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId('plan-leave'));
    fireEvent.changeText(screen.getByTestId('plan-to'), thaiDayInput(dayBefore(dayBefore(tenAgo))));
    await press('plan-save');
    expect(within(screen.getByTestId('plan-to-error')).getByText('ก่อนวันที่คนกรีดตอนนี้เริ่ม')).toBeTruthy();
    expect((await m.state()).assignments).toHaveLength(before);

    fireEvent.changeText(screen.getByTestId('plan-to'), thaiDayInput(ahead(5)));
    await press('plan-save');
    expect((await m.state()).assignments).toHaveLength(before + 1);
  });

  it('renames and soft-deletes a point', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const pt = await m.addPoint(farm.id, 'จุด 1');
    mockParams.current = { id: pt.id, edit: '1' };
    const { unmount } = wrap(<PointScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('point-name'), 'จุดริมคลอง');
    await press('point-save');
    expect((await m.state()).points[0].name).toBe('จุดริมคลอง');
    unmount();

    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('point-delete'));
    await press('delete-confirm-yes');
    expect((await m.state()).points[0].deleted).toBe(true);
  });

  it('a deleted point can be restored from its detail', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.remove(pt.id);
    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();
    expect(screen.queryByTestId('point-delete')).toBeNull();
    expect(within(screen.getByTestId('deleted-list')).getByText('ลบแล้ว')).toBeTruthy();
    await press(`restore-${pt.id}`);
    expect((await m.state()).points[0].deleted).toBe(false);
    expect(screen.getByTestId('point-delete')).toBeTruthy();
  });
});

describe('จุดชั่ง — all points and the set-up helper (farm mockup 13, 13b)', () => {
  it('lists every point under its farm with today\'s tapper', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(pt.id, daeng.id, null);
    wrap(<PointsScreen />);
    await flush();
    expect(screen.getByText('สวนจันทเขลม')).toBeTruthy();
    expect(within(screen.getByTestId(`point-${pt.id}`)).getByText('แดง')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`point-${pt.id}`));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/point/${pt.id}`);
  });

  it('deleted points sit behind the small link, with their farm, and can be restored', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const keep = await m.addPoint(farm.id, 'จุด 1');
    const gone = await m.addPoint(farm.id, 'จุด 2');
    await m.remove(gone.id);
    // A point that went with its farm comes back with the farm, not from here.
    const old = await m.addProperty({ name: 'สวนเก่า', crop: 'rubber' });
    await m.addPoint(old.id, 'จุดเก่า');
    await m.remove(old.id);
    wrap(<PointsScreen />);
    await flush();
    expect(screen.getByTestId(`point-${keep.id}`)).toBeTruthy();
    expect(screen.queryByText('จุด 2')).toBeNull();
    expect(screen.getByText('ที่ลบแล้ว (1)')).toBeTruthy();
    await press('show-deleted');
    const list = screen.getByTestId('deleted-list');
    expect(within(list).getByText('จุด 2')).toBeTruthy();
    expect(within(list).getByText('สวนจันทเขลม')).toBeTruthy();
    expect(within(list).queryByText('จุดเก่า')).toBeNull();
    // A screen reader hears which record the link restores.
    expect(screen.getByTestId(`restore-${gone.id}`).props.accessibilityLabel).toBe('กู้คืน จุด 2');
    await press(`restore-${gone.id}`);
    expect((await m.state()).points.find((p) => p.id === gone.id)?.deleted).toBe(false);
    await press('hide-deleted');
    expect(screen.getByTestId(`point-${gone.id}`)).toBeTruthy();
  });

  it('on the names page, back (header or ย้อนกลับ) returns to page 1 and keeps the names typed', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    wrap(<PointsWizardScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${daeng.id}`));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.changeText(screen.getByTestId(`wizard-name-${daeng.id}-0`), 'จุดริมคลอง');

    fireEvent.press(screen.getByTestId('wizard-prev'));
    expect(screen.getByTestId('wizard-next')).toBeTruthy();
    expect(screen.getByTestId(`wizard-count-${daeng.id}-value`).props.children).toBe('1');
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId(`wizard-name-${daeng.id}-0`).props.value).toBe('จุดริมคลอง');

    fireEvent.press(screen.getByTestId('v2-back'));
    expect(screen.getByTestId('wizard-next')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    // On page 1 the header back leaves the helper as before.
    fireEvent.press(screen.getByTestId('v2-back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('farm → tappers → how many → names, then creates every point with its tapper at once', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const nat = await m.create('นัด', ['tapper']);
    wrap(<PointsWizardScreen />);
    await flush();

    fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${daeng.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${nat.id}`));
    fireEvent.press(screen.getByTestId(`wizard-count-${daeng.id}-more`));
    expect(screen.getByTestId(`wizard-count-${daeng.id}-value`).props.children).toBe('2');
    fireEvent.press(screen.getByTestId('wizard-next'));

    fireEvent.changeText(screen.getByTestId(`wizard-name-${daeng.id}-0`), 'จุด 1');
    fireEvent.changeText(screen.getByTestId(`wizard-name-${daeng.id}-1`), 'จุด 2');
    await press('wizard-create');
    expect(screen.getByTestId('wizard-missing')).toBeTruthy();
    expect((await m.state()).points).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId(`wizard-name-${nat.id}-0`), 'จุด 3');
    await press('wizard-create');
    const state = await m.state();
    expect(state.points.map((p) => p.name).sort()).toEqual(['จุด 1', 'จุด 2', 'จุด 3']);
    expect(state.assignments.filter((a) => a.tapperId === daeng.id)).toHaveLength(2);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('first pull (E01-S09: two offline phones must not both create "จุด 1")', () => {
    const offline = (value: boolean) =>
      Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => !value });

    afterEach(async () => {
      setSyncMode('off');
      setEngineStatus(null);
      offline(false);
      jest.restoreAllMocks();
      await mockStore.setSyncCursor('group-1', 0);
      for (const op of await mockAccounts.pendingOps()) await mockAccounts.completeOp(op);
    });

    async function toNamesPage() {
      const m = master();
      const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
      const daeng = await m.create('แดง', ['tapper']);
      wrap(<PointsWizardScreen />);
      await flush();
      fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
      fireEvent.press(screen.getByTestId(`wizard-tapper-${daeng.id}`));
      fireEvent.press(screen.getByTestId('wizard-next'));
      fireEvent.changeText(screen.getByTestId(`wizard-name-${daeng.id}-0`), 'จุด 1');
      return m;
    }

    it('while sync is running and nothing has been pulled yet, says so and creates nothing', async () => {
      await mockStore.setSyncCursor('group-1', 0);
      setSyncMode('on');
      const m = await toNamesPage();
      expect(screen.getByTestId('wizard-wait-pull')).toBeTruthy();
      await press('wizard-create');
      expect((await m.state()).points).toHaveLength(0);
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it('creates once the first pull has finished, without leaving the screen', async () => {
      await mockStore.setSyncCursor('group-1', 0);
      setSyncMode('on');
      const m = await toNamesPage();
      await act(async () => {
        await mockStore.setSyncCursor('group-1', 1); // the engine's first pull found an empty group
        emitSyncChanged();
      });
      await flush();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
      await press('wizard-create');
      expect((await m.state()).points.map((p) => p.name)).toEqual(['จุด 1']);
    });

    it('a cold start with a stored cursor does not wait while the connection is still being set up', async () => {
      await mockStore.setSyncCursor('group-1', 1_790_000_000_000);
      setSyncMode('connecting');
      const m = await toNamesPage();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
      expect(screen.queryByTestId('wizard-no-sync')).toBeNull();
      await press('wizard-create');
      expect((await m.state()).points.map((p) => p.name)).toEqual(['จุด 1']);
    });

    it('the error warning does not promise that the data will be sent when syncing works', async () => {
      setSyncMode('on');
      setEngineStatus({ state: 'error', pending: 1, error: 'invalid' });
      await toNamesPage();
      const warning = within(screen.getByTestId('wizard-no-sync'));
      expect(warning.getByText(/จะยังไม่ขึ้นกลุ่มจนกว่าปัญหานี้จะหาย/)).toBeTruthy();
      expect(warning.queryByText(/จะส่งเมื่อซิงก์ได้/)).toBeNull();
    });

    it('waits too while the connection is still being set up', async () => {
      setSyncMode('connecting');
      await toNamesPage();
      expect(screen.getByTestId('wizard-wait-pull')).toBeTruthy();
    });

    it('offline on a first launch is never a trap: says so, and creates anyway', async () => {
      setSyncMode('on');
      offline(true);
      const m = await toNamesPage();
      expect(screen.getByTestId('wizard-no-sync')).toBeTruthy();
      expect(within(screen.getByTestId('wizard-no-sync')).getByText(/ไม่มีอินเทอร์เน็ต/)).toBeTruthy();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
      await press('wizard-create');
      expect((await m.state()).points.map((p) => p.name)).toEqual(['จุด 1']);
    });

    it('a sync error (rules not deployed, no database, refused) says it cannot sync and lets the person go on', async () => {
      setSyncMode('on');
      setEngineStatus({ state: 'error', pending: 3, error: 'denied' });
      const m = await toNamesPage();
      expect(within(screen.getByTestId('wizard-no-sync')).getByText(/ซิงก์กับกลุ่มไม่ได้/)).toBeTruthy();
      await press('wizard-create');
      expect((await m.state()).points.map((p) => p.name)).toEqual(['จุด 1']);
    });

    it('after the grace period without a first pull it stops waiting and says it cannot sync', async () => {
      setSyncMode('on');
      const m = await toNamesPage();
      expect(screen.getByTestId('wizard-wait-pull')).toBeTruthy();
      const later = Date.now() + 25_000;
      jest.spyOn(Date, 'now').mockReturnValue(later);
      await act(async () => emitSyncChanged());
      await flush();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
      expect(screen.getByTestId('wizard-no-sync')).toBeTruthy();
      await press('wizard-create');
      expect((await m.state()).points).toHaveLength(1);
    });

    it('a brand-new group made on this phone (not on the server yet) has nobody to duplicate: no wait at all', async () => {
      const somchai = userFromSignIn('test-user', 'สมชาย', { provider: 'google', subject: 'g-1' });
      const { membership, op } = newGroup('group-1', 'สวน', somchai, 1);
      await mockAccounts.createGroup(membership, op);
      setSyncMode('on');
      const m = await toNamesPage();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
      expect(screen.queryByTestId('wizard-no-sync')).toBeNull();
      await press('wizard-create');
      expect((await m.state()).points.map((p) => p.name)).toEqual(['จุด 1']);
    });

    it('a build that does not sync is never held up', async () => {
      setSyncMode('off');
      await toNamesPage();
      expect(screen.queryByTestId('wizard-wait-pull')).toBeNull();
    });
  });

  it('keeps the helper on the points list when points already exist', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    await m.addPoint(farm.id, 'จุด 1');
    wrap(<PointsScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('open-wizard'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/points-wizard');
  });

  it('can be used again on a farm that has points: shows them, refuses a repeated name, adds the next person', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const nat = await m.create('นัด', ['tapper']);
    const p1 = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(p1.id, daeng.id, null);
    wrap(<PointsWizardScreen />);
    await flush();

    fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
    expect(screen.getByTestId('wizard-existing').props.children).toContain('จุด 1');
    fireEvent.press(screen.getByTestId(`wizard-tapper-${nat.id}`));
    fireEvent.press(screen.getByTestId('wizard-next'));

    fireEvent.changeText(screen.getByTestId(`wizard-name-${nat.id}-0`), 'จุด 1');
    await press('wizard-create');
    expect(screen.getByTestId('wizard-duplicates')).toBeTruthy();
    expect((await m.state()).points).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId(`wizard-name-${nat.id}-0`), 'จุด 2');
    await press('wizard-create');
    const state = await m.state();
    expect(state.points.map((p) => p.name).sort()).toEqual(['จุด 1', 'จุด 2']);
    expect(state.assignments.filter((a) => a.tapperId === nat.id)).toHaveLength(1);
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
