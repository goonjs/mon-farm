import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FontGate } from './FontGate';

const mockUseFonts = jest.fn();
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

  test('still renders the app if the font fails to load', () => {
    mockUseFonts.mockReturnValue([false, new Error('missing asset')]);
    render(<FontGate><Text>เข่ง</Text></FontGate>);
    expect(screen.getByText('เข่ง')).toBeOnTheScreen();
  });
});
