import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HoldStage } from './HoldStage';
import { ThemeProvider } from '../theme';

/**
 * Component-tier tests: behaviour that needs a React tree but not a browser.
 *
 * Deliberately NOT tested here: layout, sizing, contrast. Testing Library
 * cannot see pixels, so asserting on them at this tier would be theatre — the
 * numeral's height ratio is measured in Playwright, against a real viewport.
 */

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initial="light">{ui}</ThemeProvider>);

describe('HoldStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the count in the public register', () => {
    wrap(<HoldStage count={87} onCount={jest.fn()} onReject={jest.fn()} caption="2 + 50 = 52 กก." />);
    expect(screen.getByTestId('count')).toHaveTextContent('87');
  });

  it('shows the expected reading until something happens', () => {
    wrap(<HoldStage count={0} onCount={jest.fn()} onReject={jest.fn()} caption="2 + 50 = 52 กก." />);
    expect(screen.getByTestId('caption')).toHaveTextContent(/52/);
  });

  it('does not start a hold when the pile is not ready', () => {
    const onCount = jest.fn();
    wrap(
      <HoldStage count={0} onCount={onCount} onReject={jest.fn()} caption="not ready" enabled={false} />,
    );
    act(() => {
      fireEvent(screen.getByTestId('stage'), 'pressIn');
      jest.advanceTimersByTime(5_000);
    });
    expect(onCount).not.toHaveBeenCalled();
  });

  it('counts once when the hold runs to completion', () => {
    const onCount = jest.fn();
    wrap(<HoldStage count={0} onCount={onCount} onReject={jest.fn()} caption="c" holdMs={3000} />);

    act(() => {
      fireEvent(screen.getByTestId('stage'), 'pressIn');
      jest.advanceTimersByTime(3_001);
    });

    expect(onCount).toHaveBeenCalledTimes(1);
  });

  it('does not count a moment early — 2999ms is not a hold', () => {
    const onCount = jest.fn();
    wrap(<HoldStage count={0} onCount={onCount} onReject={jest.fn()} caption="c" holdMs={3000} />);

    act(() => {
      fireEvent(screen.getByTestId('stage'), 'pressIn');
      jest.advanceTimersByTime(2_999);
    });

    expect(onCount).not.toHaveBeenCalled();
  });

  it('leaves no timer behind when unmounted mid-hold', () => {
    const onCount = jest.fn();
    const view = wrap(<HoldStage count={0} onCount={onCount} onReject={jest.fn()} caption="c" holdMs={3000} />);

    act(() => {
      fireEvent(screen.getByTestId('stage'), 'pressIn');
      jest.advanceTimersByTime(1_000);
    });
    view.unmount();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    // A hold that outlived its screen would count a basket into a pile nobody
    // is looking at.
    expect(onCount).not.toHaveBeenCalled();
  });
});
