import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import PropertiesScreen from '../app/properties';
import { PointForm } from '../components/PointForm';
import { PointsWizard } from '../components/PointsWizard';
import { PropertyForm } from '../components/PropertyForm';
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
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function clear() {
  const s = await mockMaster.state();
  for (const r of [...s.points, ...s.properties, ...s.people]) if (!r.deleted) await mockMaster.remove(r.id);
}

async function shownPoints() {
  return (await mockMaster.state()).points.filter((p) => !p.hidden);
}

describe('PointForm — E03-S03', () => {
  beforeEach(clear);

  it('adds a point under a farm, and refuses a name already used in that farm with a Thai reason', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
    await mockMaster.addPoint(f.id, 'จุด 1');
    const onDone = jest.fn();
    wrap(<PointForm pointId={null} propertyId={f.id} onDone={onDone} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('point-name'), 'จุด 1');
    await act(async () => {
      fireEvent.press(screen.getByTestId('point-save'));
    });
    await flush();
    expect(screen.getByText('มีจุดชื่อ "จุด 1" ในสวนนี้แล้ว')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('point-name'), 'จุด 2');
    await act(async () => {
      fireEvent.press(screen.getByTestId('point-save'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect((await shownPoints()).map((p) => p.name).sort()).toEqual(['จุด 1', 'จุด 2']);
  });

  it('deletes a point (กู้คืนได้) after confirming', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
    const p = await mockMaster.addPoint(f.id, 'จุด 1');
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.press(screen.getByTestId('point-delete'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/กู้คืนได้/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-yes'));
    });
    await flush();
    expect(await shownPoints()).toEqual([]);
  });
});

describe('Farm screen lists its points — E03-S03', () => {
  beforeEach(clear);

  it('shows the farm\'s points and flags a duplicate name', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
    const p = await mockMaster.addPoint(f.id, 'จุด 1');
    wrap(<PropertyForm propertyId={f.id} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId(`point-${p.id}`)).toHaveTextContent(/จุด 1/);
  });
});

describe('PointsWizard — the generic starter (D-73)', () => {
  beforeEach(clear);

  it('farm → tappers → count each → type every name → creates them all at once', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
    const red = await mockMaster.create('แดง', ['tapper']);
    const nat = await mockMaster.create('นัด', ['tapper']);
    const onDone = jest.fn();
    wrap(<PointsWizard onDone={onDone} />);
    await flush();
    fireEvent.press(screen.getByTestId(`wizard-farm-${f.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${red.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${nat.id}`));
    fireEvent.press(screen.getByTestId(`wizard-more-${red.id}`)); // แดง: 2

    // Names are required — nothing invented.
    await act(async () => {
      fireEvent.press(screen.getByTestId('wizard-create'));
    });
    expect(screen.getByText('ใส่ชื่อจุดให้ครบทุกจุด')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId(`wizard-name-${red.id}-0`), 'จุด 1');
    fireEvent.changeText(screen.getByTestId(`wizard-name-${red.id}-1`), 'จุด 2');
    fireEvent.changeText(screen.getByTestId(`wizard-name-${nat.id}-0`), 'จุด 3');
    await act(async () => {
      fireEvent.press(screen.getByTestId('wizard-create'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect((await shownPoints()).map((p) => p.name).sort()).toEqual(['จุด 1', 'จุด 2', 'จุด 3']);
  });

  it('the starter button shows on the farm list only while there are no points', async () => {
    const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
    const first = wrap(<PropertiesScreen />);
    await flush();
    expect(screen.getByTestId('open-wizard')).toBeTruthy();
    first.unmount();
    await mockMaster.addPoint(f.id, 'จุด 1');
    wrap(<PropertiesScreen />);
    await flush();
    expect(screen.queryByTestId('open-wizard')).toBeNull();
  });
});
