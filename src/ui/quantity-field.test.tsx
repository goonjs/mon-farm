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

describe('QuantityField — E01-S20 additions', () => {
  it('decimals: decimal pad (no ✓ key), value in the smallest unit, ตกลง commits (NP-7)', () => {
    const onChange = jest.fn();
    wrap(<QuantityField testID="q" label="พื้นที่" unit="ไร่" value={1250} decimals={2} maxDigits={5} onChange={onChange} />);
    expect(screen.getByText('12.5')).toBeTruthy();
    fireEvent.press(screen.getByTestId('q'));
    expect(screen.queryByTestId('q-pad-key-done')).toBeNull();
    expect(screen.queryByTestId('q-pad-key-00')).toBeNull();
    press('3', '.', '2', '5', '9');
    expect(shown()).toBe('3.25');
    expect(screen.getByText('ใหญ่เกินไป')).toBeTruthy();
    press('back', '5');
    fireEvent.press(screen.getByTestId('q-done'));
    expect(onChange).toHaveBeenCalledWith(325);
  });

  it('decimals: a whole number keeps no dot; 0.01 ไร่ round-trips', () => {
    const onChange = jest.fn();
    wrap(<QuantityField testID="q" label="พื้นที่" unit="ไร่" value={1} decimals={2} onChange={onChange} />);
    expect(screen.getByText('0.01')).toBeTruthy();
    fireEvent.press(screen.getByTestId('q'));
    press('7');
    fireEvent.press(screen.getByTestId('q-done'));
    expect(onChange).toHaveBeenCalledWith(700);
  });

  it('empty: shows `emptyText`; the clear link commits null and closes (NP-6)', () => {
    const onClear = jest.fn();
    wrap(<QuantityField testID="q" label="ปีที่ปลูก" unit="พ.ศ." value={null} emptyText="ไม่ทราบ" clear={{ label: 'เว้นว่าง (ไม่ทราบ)', onClear }} onChange={() => {}} />);
    expect(screen.getByText('ไม่ทราบ')).toBeTruthy();
    fireEvent.press(screen.getByTestId('q'));
    fireEvent.press(screen.getByTestId('q-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('q-sheet')).toBeNull();
  });

  it('validate: the old parser rule closes ✓ and says why (NP-5)', () => {
    const onChange = jest.fn();
    wrap(<QuantityField testID="q" label="ปีที่ปลูก" unit="พ.ศ." value={null} maxDigits={4} validate={(n) => (String(n).length !== 4 ? 'ปีไม่ถูกต้อง' : undefined)} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('q'));
    press('9', '9', '9');
    expect(screen.getByText('ปีไม่ถูกต้อง')).toBeTruthy();
    expect(screen.getByTestId('q-pad-key-done').props.accessibilityState.disabled).toBe(true);
    press('9', 'done');
    expect(onChange).toHaveBeenCalledWith(9999);
  });

  it('long-press ⌫ clears the field (NP-16)', () => {
    wrap(<Harness />);
    fireEvent.press(screen.getByTestId('q'));
    press('4', '5');
    fireEvent(screen.getByTestId('q-pad-key-back'), 'longPress');
    expect(shown()).toBe('–');
  });

  it('controlled open: the parent opens it (NP-15) and hears it close', () => {
    const onOpenChange = jest.fn();
    wrap(<QuantityField testID="q" label="เข่งไม่เต็ม" unit="กก." value={null} decimals={3} open onOpenChange={onOpenChange} onChange={() => {}} />);
    expect(screen.getByTestId('q-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('q-sheet-scrim'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('grouping={false}: a year reads 2554, not 2,554', () => {
    wrap(<QuantityField testID="q" label="ปีที่ปลูก" unit="พ.ศ." value={2554} grouping={false} onChange={() => {}} />);
    expect(screen.getByText('2554')).toBeTruthy();
    fireEvent.press(screen.getByTestId('q'));
    press('2', '5', '6', '0');
    expect(shown()).toBe('2560');
  });
});
