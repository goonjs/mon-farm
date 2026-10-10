import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import PropertiesScreen from '../app/properties';
import { PropertyForm } from '../components/PropertyForm';
import { peopleStore as mockMaster } from '../store/people';
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

async function active() {
  return (await mockMaster.state()).properties.filter((p) => !p.deleted);
}

async function clear() {
  for (const p of (await mockMaster.state()).properties) if (!p.deleted) await mockMaster.remove(p.id);
}

describe('Properties list — E03-S02', () => {
  beforeEach(clear);

  it('shows crop and today\'s area, or "ไม่ทราบ" when no area was given (D-65 Q7)', async () => {
    const a = await mockMaster.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    await mockMaster.recordArea(a.id, 12_500, '2020-01-01');
    const b = await mockMaster.addProperty({ name: 'ทุเรียน ตะเคียนทอง', crop: 'durian' });
    wrap(<PropertiesScreen />);
    await flush();
    expect(screen.getByTestId(`property-${a.id}`)).toHaveTextContent(/ยาง/);
    expect(screen.getByTestId(`property-${a.id}`)).toHaveTextContent(/125 ไร่/);
    expect(screen.getByTestId(`property-${b.id}`)).toHaveTextContent(/ทุเรียน/);
    expect(screen.getByTestId(`property-${b.id}`)).toHaveTextContent(/ไม่ทราบ/);
  });

  it('a deleted property sits behind the deleted link and can be restored', async () => {
    const a = await mockMaster.addProperty({ name: 'สวนเก่า', crop: 'rubber' });
    await mockMaster.remove(a.id);
    wrap(<PropertiesScreen />);
    await flush();
    expect(screen.queryByTestId(`property-${a.id}`)).toBeNull();
    fireEvent.press(screen.getByTestId('show-deleted'));
    await act(async () => {
      fireEvent.press(screen.getByTestId(`restore-${a.id}`));
    });
    await flush();
    expect((await mockMaster.state()).properties.find((p) => p.id === a.id)?.deleted).toBe(false);
  });
});

describe('PropertyForm — E03-S02', () => {
  beforeEach(clear);

  it('needs a name and a crop; area, planted year and GPS may stay blank', async () => {
    const onDone = jest.fn();
    wrap(<PropertyForm propertyId={null} onDone={onDone} />);
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    expect(screen.getByText('ใส่ชื่อสวน')).toBeTruthy();
    expect(screen.getByText('เลือกประเภท')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนใหม่');
    fireEvent.press(screen.getByTestId('crop-rubber'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect(await active()).toMatchObject([
      { name: 'สวนใหม่', crop: 'rubber', plantedYearBe: null, gps: null, areaHistory: [] },
    ]);
  });

  it('refuses an area that is not a number > 0, and keeps what was typed', async () => {
    const onDone = jest.fn();
    wrap(<PropertyForm propertyId={null} onDone={onDone} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวน');
    fireEvent.press(screen.getByTestId('crop-durian'));
    fireEvent.changeText(screen.getByTestId('property-area'), '0');
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    expect(screen.getByText('ใส่พื้นที่เป็นตัวเลขมากกว่า 0')).toBeTruthy();
    expect(screen.getByTestId('property-area').props.value).toBe('0');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('saves area with its effective date, planted year (พ.ศ.) and GPS', async () => {
    wrap(<PropertyForm propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวนจันทเขลม');
    fireEvent.press(screen.getByTestId('crop-rubber'));
    fireEvent.changeText(screen.getByTestId('property-area'), '76');
    fireEvent.changeText(screen.getByTestId('property-area-date'), '3/10/2569');
    fireEvent.changeText(screen.getByTestId('property-planted'), '2554');
    fireEvent.changeText(screen.getByTestId('property-gps'), '12.6113, 102.1035');
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    await flush();
    const [f] = await active();
    expect(f).toMatchObject({ plantedYearBe: 2554, gps: { latE6: 12_611_300, lngE6: 102_103_500 } });
    expect(f.areaHistory).toMatchObject([{ centiRai: 7600, effective: '2026-10-03' }]);
  });

  it('a planted year typed in ค.ศ. is stored as พ.ศ. (review fix)', async () => {
    wrap(<PropertyForm propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('property-name'), 'สวน ค.ศ.');
    fireEvent.press(screen.getByTestId('crop-rubber'));
    fireEvent.changeText(screen.getByTestId('property-planted'), '2011');
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    await flush();
    expect((await active()).find((p) => p.name === 'สวน ค.ศ.')?.plantedYearBe).toBe(2554);
  });

  it('changing the area adds a history entry instead of overwriting (MD-1)', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน', crop: 'rubber' });
    await mockMaster.recordArea(f.id, 12_000, '2026-01-01');
    wrap(<PropertyForm propertyId={f.id} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId('area-history')).toHaveTextContent(/120 ไร่/);
    fireEvent.changeText(screen.getByTestId('property-area'), '125');
    fireEvent.changeText(screen.getByTestId('property-area-date'), '1/10/2569');
    await act(async () => {
      fireEvent.press(screen.getByTestId('property-save'));
    });
    await flush();
    const [got] = await active();
    expect(got.areaHistory.map((a) => a.centiRai)).toEqual([12_500, 12_000]);
  });

  it('delete is always allowed, says กู้คืนได้, and warns its weighing points go with it (D-58, D-65 Q9)', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน', crop: 'rubber' });
    const onDone = jest.fn();
    wrap(<PropertyForm propertyId={f.id} onDone={onDone} />);
    await flush();
    fireEvent.press(screen.getByTestId('property-delete'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/จุดชั่ง/);
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/กู้คืนได้/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-yes'));
    });
    await flush();
    expect((await mockMaster.state()).properties.find((p) => p.id === f.id)?.deleted).toBe(true);
    expect(onDone).toHaveBeenCalled();
  });
});
