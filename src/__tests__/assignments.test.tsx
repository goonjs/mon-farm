import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PersonDetail } from '../components/PersonDetail';
import { PersonForm } from '../components/PersonForm';
import { PointForm } from '../components/PointForm';
import { tapperOn, todayIso } from '../core/master';
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
  const f = await mockMaster.addProperty({ name: 'สวน ก', crop: 'rubber' });
  const p = await mockMaster.addPoint(f.id, `จุด ${Math.random().toString(36).slice(2, 6)}`);
  const red = await mockMaster.create('แดง', ['tapper']);
  const nat = await mockMaster.create('นัด', ['tapper']);
  return { f, p, red, nat };
}

describe('Point screen — tapper of the point (E03-S05)', () => {
  it('a point with no tapper warns "ยังไม่มีคนกรีด" and can be given one', async () => {
    const { p, red } = await setup();
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId('no-tapper')).toHaveTextContent(/ยังไม่มีคนกรีด/);
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId(`plan-tapper-${red.id}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-save'));
    });
    await flush();
    expect(tapperOn(await mockMaster.state(), p.id, '2000-01-01')).toBe(red.id);
    expect(screen.getByTestId('timeline')).toHaveTextContent(/แดง/);
  });

  it('planning a change shows when the old tapper ends — the day before (D-63)', async () => {
    const { p, red, nat } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId(`plan-tapper-${nat.id}`));
    fireEvent.changeText(screen.getByTestId('plan-from'), '1/11/2569');
    expect(screen.getByTestId('plan-preview')).toHaveTextContent(/31 ต.ค. 2569/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-save'));
    });
    await flush();
    const s = await mockMaster.state();
    expect([tapperOn(s, p.id, '2026-10-31'), tapperOn(s, p.id, '2026-11-01')]).toEqual([red.id, nat.id]);
  });

  it('leaving with no replacement takes only an end date', async () => {
    const { p, red } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId('plan-leave'));
    fireEvent.changeText(screen.getByTestId('plan-to'), '31/10/2569');
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-save'));
    });
    await flush();
    const s = await mockMaster.state();
    expect([tapperOn(s, p.id, '2026-10-31'), tapperOn(s, p.id, '2026-11-01')]).toEqual([red.id, null]);
  });

  it('a plan that has not started yet can be cancelled (D-74 F3)', async () => {
    const { p, red, nat } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    const plan = await mockMaster.assignTapper(p.id, nat.id, '2099-01-01');
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId(`cancel-plan-${plan}`));
    });
    await flush();
    expect(tapperOn(await mockMaster.state(), p.id, '2099-06-01')).toBe(red.id);
  });

  it('after a new point is saved, offers to assign a tapper now or later (D-74 F15)', async () => {
    const { f } = await setup();
    const onDone = jest.fn();
    wrap(<PointForm pointId={null} propertyId={f.id} onDone={onDone} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('point-name'), `ใหม่ ${Math.random()}`);
    await act(async () => {
      fireEvent.press(screen.getByTestId('point-save'));
    });
    await flush();
    expect(screen.getByTestId('offer-assign')).toBeTruthy();
    fireEvent.press(screen.getByTestId('offer-later'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('review fixes — E03-S05', () => {
  it('once a point has a tapper, a change needs a start day', async () => {
    const { p, red, nat } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    fireEvent.press(screen.getByTestId('plan-change'));
    fireEvent.press(screen.getByTestId(`plan-tapper-${nat.id}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-save'));
    });
    expect(screen.getByText('ใส่วันเริ่ม — เปลี่ยนคนกรีดมีผลไปข้างหน้า')).toBeTruthy();
    expect(tapperOn(await mockMaster.state(), p.id, '2000-01-01')).toBe(red.id);
  });

  it('a planned leave shows and can be cancelled', async () => {
    const { p, red } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    const leave = await mockMaster.endTapper(p.id, '2099-01-01');
    wrap(<PointForm pointId={p.id} propertyId={null} onDone={jest.fn()} />);
    await flush();
    expect(screen.getByTestId(`vacancy-${leave}`)).toHaveTextContent(/ตามแผน/);
    await act(async () => {
      fireEvent.press(screen.getByTestId(`cancel-plan-${leave}`));
    });
    await flush();
    expect(tapperOn(await mockMaster.state(), p.id, '2099-06-01')).toBe(red.id);
  });
});

describe('People screen side (E03-S01 AC4/AC7, E03-S05)', () => {
  it("shows the tapper's current points, and deleting warns with their names but does not block", async () => {
    const { p, red } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    const onDone = jest.fn();
    wrap(<PersonDetail personId={red.id} onEdit={jest.fn()} onDone={onDone} />);
    await flush();
    expect(screen.getByTestId('person-points')).toHaveTextContent(new RegExp(p.name));
    fireEvent.press(screen.getByTestId('person-delete'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(new RegExp(p.name));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/ยังไม่มีคนกรีดยาง/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-yes'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect((await mockMaster.get(red.id))?.deleted).toBe(true);
  });

  it('removing the tapper role while the person has points warns first, then saves', async () => {
    const { p, red } = await setup();
    await mockMaster.assignTapper(p.id, red.id, null);
    const onDone = jest.fn();
    wrap(<PersonForm personId={red.id} onDone={onDone} />);
    await flush();
    fireEvent.press(screen.getByTestId('role-tapper'));
    fireEvent.press(screen.getByTestId('role-worker'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-save'));
    });
    expect(screen.getByTestId('role-warning')).toHaveTextContent(new RegExp(p.name));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('role-warning-yes'));
    });
    await flush();
    expect(onDone).toHaveBeenCalled();
    expect((await mockMaster.get(red.id))?.roles).toEqual(['worker']);
  });

  it('todayIso is the Bangkok day', () => {
    expect(todayIso(Date.UTC(2026, 9, 1, 18, 0))).toBe('2026-10-02');
  });
});
