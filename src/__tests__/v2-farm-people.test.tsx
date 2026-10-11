import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';

import { BuyersScreen } from '../v2/farm/buyers-screen';
import { FarmHubScreen } from '../v2/farm/farm-hub';
import { PeopleScreen, PersonScreen } from '../v2/farm/people-screens';
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
jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});

// Built inside the factory: jest.mock is hoisted above any outer const.
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
  router: Record<'push' | 'replace' | 'back' | 'setParams', jest.Mock> & { canGoBack: jest.Mock };
};
const people = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  for (const fn of Object.values(mockRouter)) fn.mockClear?.();
});

describe('ข้อมูลฟาร์ม hub (farm mockup 2)', () => {
  it('lists the five groups in mockup order with live counts and the offline note', async () => {
    const m = people();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    await m.addProperty({ name: 'ทุเรียน คลองพลู', crop: 'durian' });
    await m.addPoint(farm.id, 'จุด 1');
    await m.create('แดง', ['tapper']);
    await m.create('อาจารย์สมหวัง', ['manager', 'payer']);
    await m.addBuyer('คนรับซื้อยาง ก');

    wrap(<FarmHubScreen />);
    await flush();

    expect(screen.getByTestId('screen-title').props.children).toBe('ข้อมูลฟาร์ม');
    const order = ['hub-farms', 'hub-people', 'hub-buyers', 'hub-accounts', 'hub-sale-settings'];
    for (const id of order) expect(screen.getByTestId(id)).toBeTruthy();
    expect(within(screen.getByTestId('hub-farms')).getByText('2 สวน')).toBeTruthy();
    expect(within(screen.getByTestId('hub-farms')).getByText('1 จุดชั่ง')).toBeTruthy();
    expect(within(screen.getByTestId('hub-people')).getByText('2 คน')).toBeTruthy();
    expect(within(screen.getByTestId('hub-buyers')).getByText('1 ราย')).toBeTruthy();
    expect(within(screen.getByTestId('hub-accounts')).getByText('0 บัญชี')).toBeTruthy();
    for (const fact of ['น้ำหนักยางสุทธิ', 'น้ำหนักเข่ง', 'ตาชั่ง', 'ตรวจตาชั่งเปล่า', 'เลขเข่ง']) {
      expect(within(screen.getByTestId('hub-sale-settings')).getByText(fact)).toBeTruthy();
    }
    expect(screen.getByText('ใช้กับทุกเครื่องในกลุ่ม')).toBeTruthy();
  });

  it('each row opens its screen', async () => {
    wrap(<FarmHubScreen />);
    await flush();
    const routes: Record<string, string> = {
      'hub-farms': '/v2/farms',
      'hub-people': '/v2/people',
      'hub-buyers': '/v2/buyers',
      'hub-accounts': '/v2/accounts',
      'hub-sale-settings': '/v2/sale-settings',
    };
    for (const [id, href] of Object.entries(routes)) {
      fireEvent.press(screen.getByTestId(id));
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
  });
});

describe('คน — list, filter, deleted (farm mockup 4)', () => {
  it('shows each person with one role per line and a tapper\'s point count; filters by role', async () => {
    const m = people();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    const p1 = await m.addPoint(farm.id, 'จุด 1');
    const p2 = await m.addPoint(farm.id, 'จุด 2');
    await m.assignTapper(p1.id, daeng.id, null);
    await m.assignTapper(p2.id, daeng.id, null);
    await m.create('อาจารย์สมหวัง', ['manager', 'payer']);

    wrap(<PeopleScreen />);
    await flush();

    const row = screen.getByTestId(`person-${daeng.id}`);
    expect(within(row).getByText('คนกรีดยาง')).toBeTruthy();
    expect(within(row).getByText('2 จุด')).toBeTruthy();
    const list = screen.getByTestId('people-list');
    expect(within(list).getByText('ผู้จัดการสวน')).toBeTruthy();
    // ผู้จ่าย is not a person role on screen any more (owner 2026-10-10); the data keeps it.
    expect(within(list).queryByText('ผู้จ่าย')).toBeNull();
    expect(screen.queryByTestId('filter-payer')).toBeNull();

    fireEvent.press(screen.getByTestId('filter-tapper'));
    expect(screen.queryByText('อาจารย์สมหวัง')).toBeNull();
    expect(screen.getByText('แดง')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`person-${daeng.id}`));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/person/${daeng.id}`);
    // Adding from a role filter starts the new person on that role.
    fireEvent.press(screen.getByTestId('add-person'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/person/new?role=tapper');
    fireEvent.press(screen.getByTestId('filter-all'));
    fireEvent.press(screen.getByTestId('add-person'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/person/new');
  });

  it('groups the list owner, manager, assistant, tapper, other', async () => {
    const m = people();
    await m.create('กก', ['tapper']);
    await m.create('ขข', ['tenant']);
    await m.create('คค', ['assistant']);
    await m.create('งง', ['manager']);
    await m.create('จจ', ['owner']);
    wrap(<PeopleScreen />);
    await flush();
    const rows = within(screen.getByTestId('people-list')).getAllByText(/^(กก|ขข|คค|งง|จจ)$/).map((n) => n.props.children);
    expect(rows).toEqual(['จจ', 'งง', 'คค', 'กก', 'ขข']);
  });

  it('opens with a role filter picked when asked (?filter=tapper, from the home card ข้อมูลคนงาน)', async () => {
    await people().create('แดง', ['tapper']);
    await people().create('อาจารย์สมหวัง', ['manager']);
    mockParams.current = { filter: 'tapper' };
    wrap(<PeopleScreen />);
    await flush();
    expect(screen.getByText('แดง')).toBeTruthy();
    expect(screen.queryByText('อาจารย์สมหวัง')).toBeNull();
  });

  it('follows ?filter= when it arrives after the first render (a static page hydrates without it)', async () => {
    await people().create('แดง', ['tapper']);
    await people().create('อาจารย์สมหวัง', ['manager']);
    let bump = () => {};
    function Host() {
      const [, set] = useState(0);
      bump = () => set((n) => n + 1);
      return <PeopleScreen />;
    }
    wrap(<Host />);
    await flush();
    expect(screen.getByText('อาจารย์สมหวัง')).toBeTruthy();
    mockParams.current = { filter: 'tapper' };
    act(() => bump());
    await flush();
    expect(screen.queryByText('อาจารย์สมหวัง')).toBeNull();
    expect(screen.getByText('แดง')).toBeTruthy();
  });

  it('the buyers filter lists buyers', async () => {
    await people().addBuyer('คนรับซื้อยาง ก');
    wrap(<PeopleScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('filter-buyers'));
    expect(screen.getByText('คนรับซื้อยาง ก')).toBeTruthy();
  });

  it('deleted people sit behind a small link, labelled ลบแล้ว, and restore from there', async () => {
    const m = people();
    const gone = await m.create('นัด', ['worker']);
    await m.remove(gone.id);
    wrap(<PeopleScreen />);
    await flush();
    expect(screen.queryByText('นัด')).toBeNull();
    fireEvent.press(screen.getByTestId('show-deleted'));
    expect(within(screen.getByTestId(`deleted-${gone.id}`)).getByText('ลบแล้ว')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId(`restore-${gone.id}`)));
    await flush();
    expect((await m.get(gone.id))?.deleted).toBe(false);
  });
});

describe('คน — form (farm mockup 5)', () => {
  it('starts a new person on the role of the filter they were added from (?role=)', async () => {
    mockParams.current = { id: 'new', role: 'assistant' };
    wrap(<PersonScreen />);
    await flush();
    expect(screen.getByTestId('role-assistant')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('person-name'), 'สมศรี');
    fireEvent.press(screen.getByTestId('person-save'));
    await flush();
    mockParams.current = {};
    screen.unmount();
    wrap(<PeopleScreen />);
    await flush();
    const row = within(screen.getByTestId('people-list')).getByText('สมศรี');
    expect(row).toBeTruthy();
    expect(within(screen.getByTestId('people-list')).getByText('ผู้ช่วยสวน')).toBeTruthy();
  });

  it('adds a person with built-in and typed roles; errors only after a save attempt and keep what was typed', async () => {
    mockParams.current = { id: 'new' };
    wrap(<PersonScreen />);
    await flush();
    expect(screen.getByTestId('screen-title').props.children).toBe('เพิ่มคน');
    expect(screen.queryByTestId('person-name-error')).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId('person-save')));
    expect(screen.getByTestId('person-name-error')).toBeTruthy();
    expect(screen.getByTestId('person-roles-error')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('person-name'), 'แดง');
    fireEvent.press(screen.getByTestId('role-tapper'));
    fireEvent.changeText(screen.getByTestId('person-other-role'), 'ลูกคนงาน');
    fireEvent.press(screen.getByTestId('person-add-other-role'));
    expect(screen.getByTestId('other-role-ลูกคนงาน')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('person-save')));
    await flush();

    const [p] = await people().list();
    expect(p).toMatchObject({ name: 'แดง', roles: ['tapper'], otherRoles: ['ลูกคนงาน'] });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('offers no ผู้จ่าย role, and keeps it on save for someone who already has it', async () => {
    const p = await people().create('อาจารย์สมหวัง', ['manager', 'payer']);
    mockParams.current = { id: p.id, edit: '1' };
    wrap(<PersonScreen />);
    await flush();
    expect(screen.queryByTestId('role-payer')).toBeNull();
    expect(screen.queryByText('ผู้จ่าย')).toBeNull();
    fireEvent.changeText(screen.getByTestId('person-name'), 'อ.สมหวัง');
    await act(async () => fireEvent.press(screen.getByTestId('person-save')));
    await flush();
    expect(await people().get(p.id)).toMatchObject({ name: 'อ.สมหวัง', roles: ['manager', 'payer'] });
  });

  it('edits a name in place; the id stays', async () => {
    const p = await people().create('แดง', ['tapper']);
    mockParams.current = { id: p.id, edit: '1' };
    wrap(<PersonScreen />);
    await flush();
    expect(screen.getByTestId('screen-title').props.children).toBe('แก้ข้อมูลคน');
    expect(screen.getByTestId('person-name').props.value).toBe('แดง');
    fireEvent.changeText(screen.getByTestId('person-name'), 'แดง ใจดี');
    await act(async () => fireEvent.press(screen.getByTestId('person-save')));
    await flush();
    expect((await people().get(p.id))?.name).toBe('แดง ใจดี');
  });

  it('warns, without blocking, when the tapper role goes while they still tap points', async () => {
    const m = people();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const p = await m.create('แดง', ['tapper', 'worker']);
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(pt.id, p.id, null);
    mockParams.current = { id: p.id, edit: '1' };
    wrap(<PersonScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('role-tapper'));
    await act(async () => fireEvent.press(screen.getByTestId('person-save')));
    expect(screen.getByTestId('role-warning')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('role-warning-yes')));
    await flush();
    expect((await m.get(p.id))?.roles).toEqual(['worker']);
  });
});

describe('คน — detail and delete (farm mockup 6, 7)', () => {
  it('shows roles, the points tapped now, the share; delete warns with the points and soft-deletes', async () => {
    const m = people();
    const farm = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    const p = await m.create('แดง', ['tapper']);
    const pt = await m.addPoint(farm.id, 'จุด 1');
    await m.assignTapper(pt.id, p.id, null);
    mockParams.current = { id: p.id };
    wrap(<PersonScreen />);
    await flush();

    expect(screen.getByTestId('screen-title').props.children).toBe('แดง');
    const points = screen.getByTestId('person-points');
    expect(within(points).getByText('จุด 1')).toBeTruthy();
    expect(within(points).getByText('สวนจันทเขลม')).toBeTruthy();
    expect(within(points).getByText('ไม่ระบุวันเริ่ม')).toBeTruthy();
    const share = screen.getByTestId('share-summary');
    expect(within(share).getByText('คนกรีดยาง 50%')).toBeTruthy();
    expect(within(share).getByText('ค่าเริ่มต้น')).toBeTruthy();

    fireEvent.press(screen.getByTestId('share-summary'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/share/${p.id}`);
    fireEvent.press(screen.getByTestId('person-edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/person/${p.id}?edit=1`);

    fireEvent.press(screen.getByTestId('person-delete'));
    const warning = screen.getByTestId('delete-warning');
    expect(within(warning).getByText('แดงยังรับผิดชอบ 1 จุด')).toBeTruthy();
    expect(within(warning).getByText('จุด 1')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('delete-confirm-yes')));
    await flush();
    expect((await m.get(p.id))?.deleted).toBe(true);
  });

  it('an unknown id says so instead of a blank screen', async () => {
    mockParams.current = { id: 'nobody' };
    wrap(<PersonScreen />);
    await flush();
    expect(screen.getByTestId('not-found')).toBeTruthy();
  });
});

describe('คนรับซื้อยาง (farm mockup 8)', () => {
  it('adds, renames and soft-deletes a buyer from the sheet form', async () => {
    wrap(<BuyersScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('add-buyer'));
    await act(async () => fireEvent.press(screen.getByTestId('buyer-save')));
    expect(screen.getByTestId('buyer-name-error')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('buyer-name'), 'คนรับซื้อยาง ก');
    await act(async () => fireEvent.press(screen.getByTestId('buyer-save')));
    await flush();

    const [b] = (await people().state()).buyers;
    expect(b.name).toBe('คนรับซื้อยาง ก');
    expect(screen.getByTestId(`buyer-${b.id}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`buyer-${b.id}`));
    expect(screen.getByTestId('buyer-name').props.value).toBe('คนรับซื้อยาง ก');
    fireEvent.changeText(screen.getByTestId('buyer-name'), 'คนรับซื้อยาง ข');
    await act(async () => fireEvent.press(screen.getByTestId('buyer-save')));
    await flush();
    expect((await people().state()).buyers[0].name).toBe('คนรับซื้อยาง ข');

    fireEvent.press(screen.getByTestId(`buyer-${b.id}`));
    fireEvent.press(screen.getByTestId('buyer-delete'));
    await act(async () => fireEvent.press(screen.getByTestId('delete-confirm-yes')));
    await flush();
    expect((await people().state()).buyers[0].deleted).toBe(true);
    expect(screen.getByTestId('show-deleted')).toBeTruthy();
  });

  it('marks the buyer the latest sale used as ใช้ล่าสุด', async () => {
    const m = people();
    const b = await m.addBuyer('คนรับซื้อยาง ก');
    jest.spyOn(m, 'latestBuyerId').mockResolvedValue(b.id);
    wrap(<BuyersScreen />);
    await flush();
    expect(within(screen.getByTestId(`buyer-${b.id}`)).getByText('ใช้ล่าสุด')).toBeTruthy();
  });
});
