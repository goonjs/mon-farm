import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { fractionOfHour, hhmm, hourAtFraction } from '../../core/cover-sky';
import { wrap } from '../../test/render';
import { HomeCover } from './index';

// expo-router's focus effect, driven by hand: `mockFocus.blur()` / `mockFocus.focus()`.
const mockFocus = { run: () => undefined as void | (() => void), cleanup: undefined as void | (() => void), blur() {}, focus() {} };
mockFocus.blur = () => mockFocus.cleanup?.();
mockFocus.focus = () => {
  mockFocus.cleanup = mockFocus.run();
};
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      mockFocus.run = cb;
      mockFocus.cleanup = cb();
      return () => mockFocus.cleanup?.();
    }, [cb]);
  },
}));

const NOON = new Date(2026, 10, 2, 12, 0);
const cover = () => screen.getByTestId('home-cover');
const shown = () => cover().props.accessibilityValue?.text as string;
const flowOffset = () => screen.getByTestId('cover-flow-1').props.strokeDashoffset as number;
const touch = (type: string, x: number, y: number) => fireEvent(cover(), type, { nativeEvent: { pageX: x, pageY: y } });

async function mount(reduceMotion = false, width = 358, onDragChange?: (dragging: boolean) => void) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  wrap(<HomeCover onDragChange={onDragChange} />);
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent(cover(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 148 } } });
}

const tick = (ms: number) => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers({ now: NOON });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('HomeCover', () => {
  it('shows the device time and follows the clock (CS-2)', async () => {
    await mount();
    expect(shown()).toBe('12:00');
    await tick(60_000);
    expect(shown()).toBe('12:01');
  });

  it('is 148 tall (as before) and named for screen readers (CS-1, CS-9)', async () => {
    await mount();
    expect(cover()).toHaveStyle({ height: 148 });
    expect(cover().props.accessibilityLabel).toBe('ภาพปก: สวนยางริมลำธาร');
    expect(cover().props.accessibilityHint).toBe('แตะเพื่อเล่นภาพทั้งวัน');
  });

  it('moves the time with a sideways drag and keeps it after release (CS-3)', async () => {
    await mount();
    touch('responderGrant', 100, 50);
    touch('responderMove', 200, 54);
    const expected = hourAtFraction(fractionOfHour(12) + 100 / 358);
    expect(shown()).toBe(hhmm(expected));
    touch('responderRelease', 200, 54);
    await tick(120_000);
    expect(shown()).toBe(hhmm(expected));
  });

  it('lets the page scroll on an up-down drag (CS-3)', async () => {
    await mount();
    const move = cover().props.onResponderTerminationRequest as () => boolean;
    touch('responderGrant', 100, 50);
    touch('responderMove', 104, 130);
    expect(shown()).toBe('12:00');
    expect(move()).toBe(true);
    touch('responderGrant', 100, 50);
    touch('responderMove', 160, 52);
    expect(move()).toBe(false);
  });

  it('plays the whole day in 30 seconds on a tap, and a second tap returns to now (CS-4)', async () => {
    await mount();
    touch('responderGrant', 100, 50);
    touch('responderRelease', 101, 51);
    await tick(7_500);
    expect(shown()).toMatch(/^1[78]:/);
    touch('responderGrant', 100, 50);
    touch('responderRelease', 100, 50);
    expect(shown()).toBe('12:00');
  });

  it('plays from the screen-reader activate action too (CS-9)', async () => {
    await mount();
    fireEvent(cover(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await tick(15_000);
    expect(shown()).toMatch(/^0[0-1]:/);
  });

  it('moves the water, and stops when the app goes to the background (CS-5)', async () => {
    let listener: (s: AppStateStatus) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      listener = fn as (s: AppStateStatus) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    await mount();
    const a = flowOffset();
    await tick(500);
    expect(flowOffset()).not.toBe(a);
    act(() => listener('background'));
    const b = flowOffset();
    await tick(2_000);
    expect(flowOffset()).toBe(b);
  });

  it('keeps water and clouds still with reduce motion on (CS-5)', async () => {
    await mount(true);
    const a = flowOffset();
    await tick(2_000);
    expect(flowOffset()).toBe(a);
    expect(shown()).toBe('12:00');
  });
  it('maps the drag in picture units, so a wide phone moves the same hours per scene width (CS-3)', async () => {
    await mount(false, 716);
    touch('responderGrant', 100, 50);
    touch('responderMove', 300, 52);
    expect(shown()).toBe(hhmm(hourAtFraction(fractionOfHour(12) + 100 / 358)));
  });

  it('asks the home to stop scrolling while a sideways drag is on (CS-3)', async () => {
    const onDragChange = jest.fn();
    await mount(false, 358, onDragChange);
    touch('responderGrant', 100, 50);
    touch('responderMove', 104, 52);
    expect(onDragChange).not.toHaveBeenCalled();
    touch('responderMove', 160, 52);
    expect(onDragChange).toHaveBeenLastCalledWith(true);
    touch('responderRelease', 160, 52);
    expect(onDragChange).toHaveBeenLastCalledWith(false);
    touch('responderGrant', 100, 50);
    touch('responderMove', 160, 52);
    fireEvent(cover(), 'responderTerminate', { nativeEvent: {} });
    expect(onDragChange).toHaveBeenLastCalledWith(false);
  });

  it('stops moving when the home loses focus, and shows the time now on coming back (CS-3, CS-5)', async () => {
    await mount();
    touch('responderGrant', 100, 50);
    touch('responderMove', 200, 52);
    touch('responderRelease', 200, 52);
    expect(shown()).not.toBe('12:00');
    act(() => mockFocus.blur());
    const a = flowOffset();
    await tick(2_000);
    expect(flowOffset()).toBe(a);
    act(() => mockFocus.focus());
    expect(shown()).toBe('12:00');
    await tick(500);
    expect(flowOffset()).not.toBe(a);
  });
});
