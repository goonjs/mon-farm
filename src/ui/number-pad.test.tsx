import { act, fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { NumberPad, keyFromKeyboard } from './number-pad';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('NumberPad int', () => {
  it('1-9, back, 0, done; every key ≥ 56 tall; Thai labels', () => {
    const onKey = jest.fn();
    const onDone = jest.fn();
    wrap(<NumberPad variant="int" onKey={onKey} onDone={onDone} />);
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'back', 'done']) {
      expect(flat(screen.getByTestId(`numpad-key-${k}`).props.style).minHeight).toBeGreaterThanOrEqual(56);
    }
    expect(screen.queryByTestId('numpad-key-.')).toBeNull();
    expect(screen.getByTestId('numpad-key-back').props.accessibilityLabel).toBe('ลบหนึ่งตัว');
    fireEvent.press(screen.getByTestId('numpad-key-5'));
    fireEvent.press(screen.getByTestId('numpad-key-back'));
    fireEvent.press(screen.getByTestId('numpad-key-done'));
    expect(onKey.mock.calls).toEqual([['5'], ['back']]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('done disabled: no press', () => {
    const onDone = jest.fn();
    wrap(<NumberPad variant="int" onKey={() => {}} onDone={onDone} doneDisabled />);
    fireEvent.press(screen.getByTestId('numpad-key-done'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('numpad-key-done').props.accessibilityState.disabled).toBe(true);
  });
});

describe('NumberPad money', () => {
  it('has . 00 000 and no done key; 0 spans three columns', () => {
    const onKey = jest.fn();
    wrap(<NumberPad variant="money" onKey={onKey} onDone={() => {}} />);
    expect(screen.queryByTestId('numpad-key-done')).toBeNull();
    for (const k of ['.', '00', '000']) fireEvent.press(screen.getByTestId(`numpad-key-${k}`));
    expect(onKey.mock.calls).toEqual([['.'], ['00'], ['000']]);
    expect(flat(screen.getByTestId('numpad-key-0').props.style).flex).toBe(3);
    expect(screen.getByTestId('numpad-key-00').props.accessibilityLabel).toBe('ศูนย์ศูนย์');
    expect(flat(screen.getByTestId('numpad-key-5').props.style).backgroundColor).toBe(tokens.color.light.surfaceRaised);
  });
});

describe('keyFromKeyboard', () => {
  it('maps digits, dot, Backspace, Enter; ignores shortcuts and other keys', () => {
    expect(keyFromKeyboard({ key: '7' })).toBe('7');
    expect(keyFromKeyboard({ key: '.' })).toBe('.');
    expect(keyFromKeyboard({ key: 'Backspace' })).toBe('back');
    expect(keyFromKeyboard({ key: 'Enter' })).toBe('done');
    expect(keyFromKeyboard({ key: 'c', ctrlKey: true })).toBeNull();
    expect(keyFromKeyboard({ key: '1', metaKey: true })).toBeNull();
    expect(keyFromKeyboard({ key: 'a' })).toBeNull();
  });
});

describe('NumberPad hardware keyboard (web)', () => {
  const original = Platform.OS;
  const g = globalThis as unknown as { document?: unknown };
  const had = g.document;
  afterEach(() => {
    Platform.OS = original;
    g.document = had;
  });

  it('on web, keydown drives onKey/onDone while mounted, and stops after unmount', () => {
    Platform.OS = 'web';
    const listeners = new Set<(e: unknown) => void>();
    g.document = {
      addEventListener: (_: string, fn: (e: unknown) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: unknown) => void) => listeners.delete(fn),
    };
    const fire = (e: object) => listeners.forEach((fn) => fn(e));
    const onKey = jest.fn();
    const onDone = jest.fn();
    const view = wrap(<NumberPad variant="money" onKey={onKey} onDone={onDone} />);
    act(() => {
      fire({ key: '4' });
      fire({ key: 'Backspace' });
      fire({ key: 'Enter' });
      fire({ key: 'v', ctrlKey: true });
    });
    expect(onKey.mock.calls).toEqual([['4'], ['back']]);
    expect(onDone).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it('on native, no listener is added', () => {
    const add = jest.fn();
    g.document = { addEventListener: add, removeEventListener: jest.fn() };
    wrap(<NumberPad variant="int" onKey={() => {}} onDone={() => {}} />);
    expect(add).not.toHaveBeenCalled();
  });
});
