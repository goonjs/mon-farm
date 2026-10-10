import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import PeopleScreen from '../app/people';
import BuyersScreen from '../app/buyers';
import { PersonForm } from '../components/PersonForm';
import { peopleStore as mockPeople } from '../store/people';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function clear() {
  const state = await mockPeople.state();
  for (const p of state.people) if (!p.deleted) await mockPeople.remove(p.id);
  for (const b of state.buyers) if (!b.deleted) await mockPeople.remove(b.id);
}

describe('People list — E03-S01', () => {
  beforeEach(clear);

  it('filters by role: tapper shows only tappers (D-74 F12)', async () => {
    const red = await mockPeople.create('แดง', ['tapper']);
    const boss = await mockPeople.create('สมหวัง', ['manager', 'payer']);
    wrap(<PeopleScreen />);
    await flush();
    expect(screen.getByTestId(`person-${red.id}`)).toBeTruthy();
    expect(screen.getByTestId(`person-${boss.id}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId('filter-tapper'));
    await flush();
    expect(screen.getByTestId(`person-${red.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`person-${boss.id}`)).toBeNull();
  });

  it('shows each person\'s roles, typed-in ones included', async () => {
    const p = await mockPeople.create('น้อง', ['payer'], ['ลูกคนงาน']);
    wrap(<PeopleScreen />);
    await flush();
    expect(screen.getByTestId(`person-${p.id}`)).toHaveTextContent(/ผู้จ่าย/);
    expect(screen.getByTestId(`person-${p.id}`)).toHaveTextContent(/ลูกคนงาน/);
  });

  it('deleted people sit behind a small link, labelled "ลบแล้ว" with a restore link (D-74 F13)', async () => {
    const p = await mockPeople.create('แดง', ['tapper']);
    await mockPeople.remove(p.id);
    wrap(<PeopleScreen />);
    await flush();
    expect(screen.queryByTestId(`person-${p.id}`)).toBeNull();

    fireEvent.press(screen.getByTestId('show-deleted'));
    await flush();
    expect(screen.getByTestId(`deleted-${p.id}`)).toHaveTextContent(/ลบแล้ว/);

    await act(async () => {
      fireEvent.press(screen.getByTestId(`restore-${p.id}`));
    });
    await flush();
    expect((await mockPeople.get(p.id))?.deleted).toBe(false);
  });
});

describe('PersonForm — E03-S01', () => {
  beforeEach(clear);

  it('blocks saving without a name and a role, and says why (D-68)', async () => {
    const onDone = jest.fn();
    wrap(<PersonForm personId={null} onDone={onDone} />);
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-save'));
    });
    expect(screen.getByText('ใส่ชื่อ')).toBeTruthy();
    expect(screen.getByText('เลือกบทบาทอย่างน้อย 1 อย่าง')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('creates a person with several roles and a typed-in role', async () => {
    const onDone = jest.fn();
    wrap(<PersonForm personId={null} onDone={onDone} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('person-name'), 'สมหวัง');
    fireEvent.press(screen.getByTestId('role-manager'));
    fireEvent.press(screen.getByTestId('role-payer'));
    fireEvent.changeText(screen.getByTestId('person-other-role'), 'ลูกคนงาน');
    fireEvent.press(screen.getByTestId('person-add-other-role'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-save'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect(await mockPeople.list()).toMatchObject([
      { name: 'สมหวัง', roles: ['manager', 'payer'], otherRoles: ['ลูกคนงาน'] },
    ]);
  });

  it('renaming keeps the id', async () => {
    const p = await mockPeople.create('แดง', ['tapper']);
    wrap(<PersonForm personId={p.id} onDone={jest.fn()} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('person-name'), 'แดงใหม่');
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-save'));
    });
    await flush();
    expect(await mockPeople.get(p.id)).toMatchObject({ id: p.id, name: 'แดงใหม่' });
  });

  // Delete moved to the read-only detail with its sheet: see person-detail.test.tsx.

  it('shows the added date in พ.ศ.; a tap switches to ค.ศ. (D-65 Q1)', async () => {
    const p = await mockPeople.create('แดง', ['tapper']);
    wrap(<PersonForm personId={p.id} onDone={jest.fn()} />);
    await flush();
    const be = new Date(p.createdTs).getFullYear() + 543;
    expect(screen.getByTestId('person-added-date')).toHaveTextContent(new RegExp(String(be)));
    fireEvent.press(screen.getByTestId('person-added-date'));
    expect(screen.getByTestId('person-added-date')).toHaveTextContent(new RegExp(String(be - 543)));
  });
});

describe('Buyers — E03-S01 (MD-6)', () => {
  beforeEach(clear);

  it('adds a buyer from the form', async () => {
    wrap(<BuyersScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('buyer-name'), 'ล้ง ก');
    await act(async () => {
      fireEvent.press(screen.getByTestId('buyer-save'));
    });
    await flush();
    expect((await mockPeople.state()).buyers.filter((b) => !b.deleted)).toMatchObject([{ name: 'ล้ง ก' }]);
    expect(screen.getByText('ล้ง ก')).toBeTruthy();
  });

  it('deletes a buyer (กู้คืนได้) and restores it from the deleted list', async () => {
    const b = await mockPeople.addBuyer('ล้ง ข');
    wrap(<BuyersScreen />);
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId(`buyer-delete-${b.id}`));
    });
    await flush();
    expect(screen.queryByTestId(`buyer-${b.id}`)).toBeNull();
    fireEvent.press(screen.getByTestId('show-deleted'));
    await act(async () => {
      fireEvent.press(screen.getByTestId(`restore-${b.id}`));
    });
    await flush();
    expect((await mockPeople.state()).buyers.find((x) => x.id === b.id)?.deleted).toBe(false);
  });
});
