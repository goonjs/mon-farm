/** E01-S20 row 21 review: TypedReading on the in-sheet pad, edge cases outside the counter flow. */
import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TypedReading } from '../v2/sale/short-reading';
import { wrap } from '../test/render';

jest.mock('expo-router', () => ({ Link: ({ children }: { children: ReactNode }) => children, useRouter: () => ({}) }));

const press = (...keys: string[]) => keys.forEach((k) => fireEvent.press(screen.getByTestId(`reading-pad-key-${k}`)));

describe('TypedReading (E01-S20 row 21)', () => {
  it('a negative computed net never opens as the value to edit: switching to it starts empty', () => {
    const onChange = jest.fn();
    wrap(<TypedReading startKg={37} offsetKg={2.35} onChange={onChange} />);
    press('1');
    expect(screen.getByTestId('reading-net-value')).toHaveTextContent('-1.35');
    fireEvent.press(screen.getByTestId('reading-net'));
    expect(screen.getByTestId('reading-net-value')).toHaveTextContent('–');
    press('3', '0');
    expect(screen.getByTestId('reading-net-value')).toHaveTextContent('30');
    expect(onChange).toHaveBeenLastCalledWith(32.35);
  });

  it('the card says its state to a screen reader and the value is announced', () => {
    wrap(<TypedReading startKg={37} offsetKg={2} onChange={() => {}} />);
    expect(screen.getByTestId('reading-scale').props.accessibilityLabel).toContain('ค่าเดา · พิมพ์ทับ');
    expect(screen.getByTestId('reading-net').props.accessibilityLabel).toContain('คำนวณให้');
    expect(screen.getByTestId('reading-scale-value').props.accessibilityLiveRegion).toBe('polite');
  });
});
