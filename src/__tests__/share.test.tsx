import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TapperShare } from '../components/TapperShare';
import { shareOn } from '../core/master';
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
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('TapperShare — E03-S06', () => {
  it('shows 50/50 as the default with "never changed" history', async () => {
    const red = await mockMaster.create('แดง', ['tapper']);
    wrap(<TapperShare tapperId={red.id} />);
    await flush();
    expect(screen.getByTestId('share-now')).toHaveTextContent(/คนกรีดยาง 50%/);
    expect(screen.getByTestId('share-now')).toHaveTextContent(/ค่าเริ่มต้น/);
    expect(screen.getByTestId('share-history')).toHaveTextContent(/ยังไม่เคยเปลี่ยน/);
  });

  it('custom: types the tapper side, shows the owner side, refuses a non-whole or out-of-range number', async () => {
    const red = await mockMaster.create('แดง', ['tapper']);
    wrap(<TapperShare tapperId={red.id} />);
    await flush();
    fireEvent.press(screen.getByTestId('share-custom'));
    fireEvent.changeText(screen.getByTestId('share-pct'), '45');
    expect(screen.getByTestId('share-owner')).toHaveTextContent(/55%/);
    fireEvent.changeText(screen.getByTestId('share-pct'), '45.5');
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-save'));
    });
    expect(screen.getByText('ใส่เป็นจำนวนเต็ม เช่น 55')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('share-pct'), '101');
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-save'));
    });
    expect(screen.getByText('ใส่ได้ตั้งแต่ 0 ถึง 100')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('share-pct'), '55');
    fireEvent.changeText(screen.getByTestId('share-from'), '1/10/2569');
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-save'));
    });
    await flush();
    expect(shareOn(await mockMaster.state(), red.id, '2026-10-01')).toMatchObject({ tapperPct: 55, ownerPct: 45 });
    expect(screen.getByTestId('share-history')).toHaveTextContent(/55%/);
  });

  it('refuses a start on the day of a closed sale, naming the first allowed day (D-74 F17)', async () => {
    const red = await mockMaster.create('แดง', ['tapper']);
    jest.spyOn(mockMaster, 'lastClosedSaleDay').mockResolvedValue('2026-09-18');
    wrap(<TapperShare tapperId={red.id} />);
    await flush();
    fireEvent.press(screen.getByTestId('share-custom'));
    fireEvent.changeText(screen.getByTestId('share-pct'), '55');
    fireEvent.changeText(screen.getByTestId('share-from'), '18/9/2569');
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-save'));
    });
    expect(screen.getByTestId('share-too-early')).toHaveTextContent(/18 ก.ย. 2569/);
    expect(screen.getByTestId('share-too-early')).toHaveTextContent(/19 ก.ย. 2569/);
    jest.restoreAllMocks();
  });
});
