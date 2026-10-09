import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FONT_LOAD_TIMEOUT_MS, FontGate } from './FontGate';

const mockUseFonts = jest.fn();
const mockHide = jest.fn(() => Promise.resolve());
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: () => mockHide(),
}));
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));

/**
 * The first screen must not paint in a fallback font and then jump to Noto
 * Sans Thai (AC: font loads before the first screen). A font that fails to
 * load must not block the app either — a farm with no network still has to
 * be able to count, in the system font if need be.
 */
describe('FontGate', () => {
  test('renders nothing while the embedded font is loading', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(screen.queryByText('เข่ง')).toBeNull();
  });

  test('renders the app once the font is loaded', () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(screen.getByText('เข่ง')).toBeOnTheScreen();
  });

  beforeEach(() => mockHide.mockClear());

  test('keeps the splash up while loading, and hides it once ready', () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { rerender } = render(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(mockHide).not.toHaveBeenCalled();
    mockUseFonts.mockReturnValue([true, null]);
    rerender(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  test('gives up waiting after a timeout — a load that never settles must not blank the app', () => {
    jest.useFakeTimers();
    try {
      mockUseFonts.mockReturnValue([false, null]);
      render(<FontGate><Text>เข่ง</Text></FontGate>);
      expect(screen.queryByText('เข่ง')).toBeNull();
      act(() => jest.advanceTimersByTime(FONT_LOAD_TIMEOUT_MS));
      expect(screen.getByText('เข่ง')).toBeOnTheScreen();
      expect(mockHide).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('still renders the app if the font fails to load', () => {
    mockUseFonts.mockReturnValue([false, new Error('missing asset')]);
    render(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(screen.getByText('เข่ง')).toBeOnTheScreen();
  });
});
