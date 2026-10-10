import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PersonDetail } from '../components/PersonDetail';
import { peopleStore as mockMaster } from '../store/people';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/master-store');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true }),
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function setup() {
  const f = await mockMaster.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
  const p1 = await mockMaster.addPoint(f.id, `จุด ก ${Math.random().toString(36).slice(2, 5)}`);
  const p2 = await mockMaster.addPoint(f.id, `จุด ข ${Math.random().toString(36).slice(2, 5)}`);
  const red = await mockMaster.create('แดง', ['tapper']);
  const nat = await mockMaster.create('นัด', ['tapper']);
  await mockMaster.assignTapper(p1.id, red.id, null);
  await mockMaster.assignTapper(p2.id, red.id, null);
  await mockMaster.assignTapper(p2.id, nat.id, '2099-01-01');
  return { f, p1, p2, red };
}

describe('Person detail — mockup v1.1.0 farm-05/06', () => {
  it('read-only: profile, the points they tap now with farm and dates, a planned change, and the share', async () => {
    const { p1, p2, red } = await setup();
    const onEdit = jest.fn();
    wrap(<PersonDetail personId={red.id} onEdit={onEdit} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId('person-profile')).toHaveTextContent(/แดง.*คนกรีดยาง/);
    expect(screen.getByTestId(`person-point-${p1.id}`)).toHaveTextContent(/สวนจันทเขลม.*ไม่ระบุวันเริ่ม/);
    expect(screen.getByTestId(`person-point-${p2.id}`)).toHaveTextContent(/ถึง\s*31 ธ.ค. 2641.*มีแผนเปลี่ยน/);
    expect(screen.getByTestId('share-summary')).toHaveTextContent(/คนกรีดยาง 50%.*เจ้าของสวน 50%.*ค่าเริ่มต้น/);
    expect(screen.queryByTestId('person-name')).toBeNull();
    fireEvent.press(screen.getByTestId('person-edit'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('delete is a sheet that names their points and what happens to them, then soft-deletes (farm-06)', async () => {
    const { p1, red } = await setup();
    const onDone = jest.fn();
    wrap(<PersonDetail personId={red.id} onEdit={jest.fn()} onDone={onDone} />);
    await flush();
    expect(screen.getByTestId('person-delete')).toHaveTextContent('ลบ (กู้คืนได้)');
    fireEvent.press(screen.getByTestId('person-delete'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/ลบ "แดง" ไหม/);
    expect(screen.getByTestId('delete-warning')).toHaveTextContent(new RegExp(`แดงยังรับผิดชอบ 2 จุด.*${p1.name}`));
    expect(screen.getByTestId('delete-warning')).toHaveTextContent(/ยังไม่มีคนกรีดยาง/);
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/กู้คืนได้/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-yes'));
    });
    await flush();
    expect((await mockMaster.get(red.id))?.deleted).toBe(true);
    expect(onDone).toHaveBeenCalled();
  });

  it('someone with no points gets no warning, and no share card unless a tapper', async () => {
    const boss = await mockMaster.create('สมหวัง', ['manager']);
    wrap(<PersonDetail personId={boss.id} onEdit={jest.fn()} onDone={jest.fn()} />);
    await flush();
    expect(screen.queryByTestId('share-summary')).toBeNull();
    fireEvent.press(screen.getByTestId('person-delete'));
    expect(screen.queryByTestId('delete-warning')).toBeNull();
  });
});
