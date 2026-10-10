import { act, screen } from '@testing-library/react-native';

import { SPLASH_MS, SplashScreen } from './splash-screen';
import { wrap } from '../test/render';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => mockRouter,
}));

/** `/` — a short splash (the mockup's logo and name), then the v2 home. */
describe('SplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('shows the app name and what it is for, with the drawn mark', () => {
    wrap(<SplashScreen />);
    expect(screen.getByTestId('splash')).toBeTruthy();
    expect(screen.getByTestId('splash-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('FarmMate')).toBeTruthy();
    expect(screen.getByText('แอปบริหารสวนยาง')).toBeTruthy();
  });

  it('replaces itself with the v2 home after a moment, leaving no way back to it', () => {
    wrap(<SplashScreen />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(SPLASH_MS));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('is short', () => {
    expect(SPLASH_MS).toBeLessThanOrEqual(1200);
  });

  it('does not navigate after it is gone', () => {
    const { unmount } = wrap(<SplashScreen />);
    unmount();
    act(() => jest.advanceTimersByTime(SPLASH_MS));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
