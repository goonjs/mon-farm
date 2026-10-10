import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HomeScreen from '../app/index';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
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

describe('Home — ☰ menu + card home (E01-S17 X1, v1.1.0 farm screens 1/25)', () => {
  it('has the shared header with the ☰ button, and the sales in a card section', async () => {
    for (const e of setUpSale(new LogBuilder('sale-a', 'dev-other')).build()) await mockStore.append(e);
    wrap(<HomeScreen />);
    await flush();

    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByTestId('open-menu')).toBeTruthy();
    expect(screen.getByTestId('home-sales')).toBeTruthy();
    expect(screen.getByTestId('sale-sale-a')).toBeTruthy();
    expect(screen.getByTestId('new-sale')).toBeTruthy();
  });

  it('settings and the farm profile live in the menu, which the scrim closes', async () => {
    wrap(<HomeScreen />);
    await flush();
    expect(screen.queryByTestId('open-settings')).toBeNull();

    fireEvent.press(screen.getByTestId('open-menu'));
    expect(screen.getByTestId('open-settings')).toBeTruthy();
    expect(screen.getByTestId('menu-farm-profile')).toBeTruthy();
    expect(screen.getByText('ของกลุ่ม · ทุกเครื่องเห็นเหมือนกัน')).toBeTruthy();
    expect(screen.getByText('เฉพาะเครื่องนี้ · ไม่ส่งไปเครื่องอื่น')).toBeTruthy();

    fireEvent.press(screen.getByTestId('drawer-scrim'));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });
});
