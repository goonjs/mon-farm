import { act, fireEvent, screen } from '@testing-library/react-native';

import { HoldStage } from './HoldStage';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

// A 390 × 844 phone in portrait — the device the rotate hint exists for.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

/**
 * E01-S13: the rotate hint must never flicker. It is decided only once a
 * layout has confirmed the numeral's real size — never on the first paint,
 * which uses the token's estimated digit width — and decided again whenever
 * the numeral's size changes. These drive the two layouts by hand; the
 * real-geometry outcome is covered in e2e/orientation.spec.ts.
 */
function layoutStage(width: number, height: number) {
  fireEvent(screen.getByTestId('stage'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}
function fontSizeOfCount(): number {
  const style = [screen.getByTestId('count').props.style].flat(Infinity).reduce((a, s) => ({ ...a, ...s }), {});
  return style.fontSize as number;
}
/** Lay the count out at `em` per digit — what a face with that advance would measure. */
function layoutCount(digits: number, em: number) {
  const width = fontSizeOfCount() * em * digits;
  fireEvent(screen.getByTestId('count'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 1 } } });
}

describe('HoldStage rotate hint', () => {
  const est = tokens.publicNumeral.digitWidthEm;

  it('is not shown on the first, estimated paint', () => {
    wrap(<HoldStage count={1186} onCount={jest.fn()} onReject={jest.fn()} caption="c" />);
    act(() => layoutStage(390, 600));
    expect(screen.queryByTestId('rotate-hint')).toBeNull();
  });

  it('is shown once a layout confirms the numeral is under the floor', () => {
    wrap(<HoldStage count={1186} onCount={jest.fn()} onReject={jest.fn()} caption="c" />);
    act(() => layoutStage(390, 600));
    act(() => layoutCount(4, est)); // measured = estimate → confirmed
    expect(screen.getByTestId('rotate-hint')).toBeOnTheScreen();
  });

  it('waits for a correction to be confirmed before deciding', () => {
    wrap(<HoldStage count={186} onCount={jest.fn()} onReject={jest.fn()} caption="c" />);
    act(() => layoutStage(390, 600));
    act(() => layoutCount(3, 0.5)); // narrower face → numeral grows, not yet confirmed
    expect(screen.queryByTestId('rotate-hint')).toBeNull();
    act(() => layoutCount(3, 0.5)); // same advance at the new size → confirmed
    // 390 / (3 × 0.5) = 260 → 260 / 390 ≈ 0.67, over the floor: no hint.
    expect(screen.queryByTestId('rotate-hint')).toBeNull();
  });

  it('decides again when the numeral size changes, and keeps its answer when it does not', () => {
    wrap(<HoldStage count={1186} onCount={jest.fn()} onReject={jest.fn()} caption="c" />);
    act(() => layoutStage(390, 600));
    act(() => layoutCount(4, est));
    expect(screen.getByTestId('rotate-hint')).toBeOnTheScreen();

    // Taller stage, same width: the numeral is width-bound and keeps its size,
    // so no new count layout will come — the answer must stand, not vanish.
    act(() => layoutStage(390, 700));
    expect(screen.getByTestId('rotate-hint')).toBeOnTheScreen();

    // Narrower stage: the numeral shrinks — undecided until confirmed again.
    act(() => layoutStage(300, 700));
    expect(screen.queryByTestId('rotate-hint')).toBeNull();
    act(() => layoutCount(4, est));
    expect(screen.getByTestId('rotate-hint')).toBeOnTheScreen();
  });
});
