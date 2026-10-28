import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { QuantityField } from './quantity-field';
import { tokens } from '../../design/tokens';
import { wrap } from '../test/render';

const press = (...keys: string[]) => keys.forEach((k) => fireEvent.press(screen.getByTestId(`q-pad-key-${k}`)));
const shown = () => screen.getByTestId('q-display').props.children;

function Harness({ initial = 20, ...rest }: { initial?: number | null } & Partial<React.ComponentProps<typeof QuantityField>>) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <QuantityField
      testID="q"
      label="กี่กระสอบ"
      unit="กระสอบ"
      value={v}
      onChange={setV}
      caption={(n) => (n == null ? undefined : `รวม ${(n * 50).toLocaleString('en-US')} กก.`)}
      {...rest}
    />
  );
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('QuantityField', () => {
  it('closed card is slim (56-72), numeral one step below the open one, tappable', () => {
    wrap(<Harness />);
    const st = flat(screen.getByTestId('q').props.style);
    expect(st.minHeight).toBeGreaterThanOrEqual(56);
    expect(st.minHeight).toBeLessThanOrEqual(72);
    expect(st.paddingVertical).toBeLessThanOrEqual(8);
    expect(flat(screen.getByText('20').props.style).fontSize).toBeLessThan(tokens.font.size.figure);
    expect(screen.getByText('รวม 1,000 กก.')).toBeTruthy();
    expect(screen.getByText('กี่กระสอบ')).toBeTruthy();
  });

  it('closed: big number, unit and caption, tappable at ≥ 56', () => {
    wrap(<Harness />);
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('กระสอบ')).toBeTruthy();
    expect(screen.getByText('รวม 1,000 กก.')).toBeTruthy();
    expect(screen.queryByTestId('q-sheet')).toBeNull();
  });

  it('first key replaces the old value; ✓ commits and closes', () => {
    wrap(<Harness />);
    fireEvent.press(screen.getByTestId('q'));
    expect(screen.getByText('กำลังกรอก')).toBeTruthy();
    expect(shown()).toBe('20');
    press('3', '5');
    expect(shown()).toBe('35');
    expect(screen.getByText('รวม 1,750 กก.')).toBeTruthy();
    press('done');
    expect(screen.queryByTestId('q-sheet')).toBeNull();
    expect(screen.getByText('35')).toBeTruthy();
  });

  it('closing the sheet cancels without change', () => {
    wrap(<Harness />);
    fireEvent.press(screen.getByTestId('q'));
    press('9');
    fireEvent.press(screen.getByTestId('q-sheet-scrim'));
    expect(screen.queryByTestId('q-sheet')).toBeNull();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('empty or below min: ✓ disabled, short Thai message', () => {
    const onChange = jest.fn();
    wrap(<QuantityField testID="q" label="กี่กระสอบ" unit="กระสอบ" value={20} min={5} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('q'));
    press('back', 'back');
    expect(screen.getByTestId('q-pad-key-done').props.accessibilityState.disabled).toBe(true);
    press('3');
    expect(screen.getByText('ต้องไม่น้อยกว่า 5')).toBeTruthy();
    press('done');
    expect(onChange).not.toHaveBeenCalled();
    press('back', '7');
    press('done');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('above max: message and disabled', () => {
    wrap(<Harness max={100} />);
    fireEvent.press(screen.getByTestId('q'));
    press('5', '0', '0');
    expect(screen.getByText('ต้องไม่เกิน 100')).toBeTruthy();
    expect(screen.getByTestId('q-pad-key-done').props.accessibilityState.disabled).toBe(true);
  });

  it('past maxDigits: "ใหญ่เกินไป" and the number stays', () => {
    wrap(<Harness maxDigits={3} />);
    fireEvent.press(screen.getByTestId('q'));
    press('1', '2', '3', '4');
    expect(shown()).toBe('123');
    expect(screen.getByText('ใหญ่เกินไป')).toBeTruthy();
  });
});
