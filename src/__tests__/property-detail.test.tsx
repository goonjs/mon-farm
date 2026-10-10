import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PropertyDetail } from '../components/PropertyDetail';
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
  const f = await mockMaster.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber', plantedYearBe: 2554 });
  await mockMaster.recordArea(f.id, 12_000, '2026-01-01');
  await mockMaster.recordArea(f.id, 12_500, '2026-10-01');
  const p1 = await mockMaster.addPoint(f.id, 'จุด 1');
  const p2 = await mockMaster.addPoint(f.id, 'จุด 2');
  const red = await mockMaster.create('แดง', ['tapper']);
  await mockMaster.assignTapper(p1.id, red.id, null);
  return { f, p1, p2 };
}

describe('Property detail — mockup v1.1.0 farm-14/15', () => {
  it('read-only: crop, area now, planted year and age, GPS unknown, area history, points with their tapper', async () => {
    const { f, p1, p2 } = await setup();
    wrap(<PropertyDetail propertyId={f.id} onEdit={jest.fn()} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId('property-summary')).toHaveTextContent(/สวนจันทเขลม.*ยาง/);
    expect(screen.getByTestId('property-area-now')).toHaveTextContent(/125 ไร่/);
    expect(screen.getByTestId('property-planted')).toHaveTextContent(/2554/);
    expect(screen.getByTestId('property-gps')).toHaveTextContent(/ไม่ทราบ/);
    expect(screen.getByTestId('area-history')).toHaveTextContent(/125 ไร่.*ใช้อยู่.*120 ไร่/);
    expect(screen.getByTestId('property-points')).toHaveTextContent(/จุดชั่ง \(2\)/);
    expect(screen.getByTestId(`point-${p1.id}`)).toHaveTextContent(/แดง/);
    expect(screen.getByTestId(`point-${p2.id}`)).toHaveTextContent(/ยังไม่มีคนกรีด/);
    expect(screen.queryByTestId('property-name')).toBeNull();
  });

  it('เปลี่ยนพื้นที่ adds a dated entry, never overwrites (MD-1)', async () => {
    const { f } = await setup();
    wrap(<PropertyDetail propertyId={f.id} onEdit={jest.fn()} onDone={jest.fn()} />);
    await flush();
    fireEvent.press(screen.getByTestId('change-area'));
    fireEvent.changeText(screen.getByTestId('area-new'), '130');
    fireEvent.changeText(screen.getByTestId('area-new-date'), '5/10/2569');
    await act(async () => {
      fireEvent.press(screen.getByTestId('area-save'));
    });
    await flush();
    const got = (await mockMaster.state()).properties.find((p) => p.id === f.id)!;
    expect(got.areaHistory.map((a) => a.centiRai)).toEqual([13_000, 12_500, 12_000]);
    expect(screen.getByTestId('property-area-now')).toHaveTextContent(/130 ไร่/);
  });

  it('delete is a sheet: its points go with it, old sales keep their baskets, and it can be restored (farm-15)', async () => {
    const { f } = await setup();
    const onDone = jest.fn();
    wrap(<PropertyDetail propertyId={f.id} onEdit={jest.fn()} onDone={onDone} />);
    await flush();
    expect(screen.getByTestId('property-delete')).toHaveTextContent('ลบสวน (กู้คืนได้)');
    fireEvent.press(screen.getByTestId('property-delete'));
    expect(screen.getByTestId('delete-warning')).toHaveTextContent(/จุดชั่ง 2 จุดในสวนนี้ถูกลบไปด้วย/);
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/กู้คืนได้ — จุดชั่งกลับมาด้วย/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-yes'));
    });
    await flush();
    expect((await mockMaster.state()).properties.find((p) => p.id === f.id)?.deleted).toBe(true);
    expect(onDone).toHaveBeenCalled();
  });
});
