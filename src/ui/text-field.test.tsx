import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { TextField } from './text-field';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('TextField — label, required *, helper, inline error', () => {
  it('labels the input for screen readers and reports changes', () => {
    const onChangeText = jest.fn();
    wrap(<TextField testID="f" label="ชื่อสวน" value="" onChangeText={onChangeText} />);
    const input = screen.getByTestId('f');
    expect(input.props.accessibilityLabel).toBe('ชื่อสวน');
    expect(flat(input.props.style)).toMatchObject({ minHeight: tokens.target.min, color: c.ink, fontFamily: tokens.font.family.sans });
    fireEvent.changeText(input, 'สวนบน');
    expect(onChangeText).toHaveBeenCalledWith('สวนบน');
  });

  it('required: a red * named "จำเป็น", and the input says it is required', () => {
    wrap(<TextField testID="f" label="ชื่อสวน" required value="" onChangeText={() => {}} />);
    expect(flat(screen.getByTestId('required-mark').props.style).color).toBe(c.reject);
    expect(screen.getByTestId('required-mark').props.accessibilityLabel).toBe('จำเป็น');
    expect(screen.getByTestId('f').props.accessibilityLabel).toBe('ชื่อสวน, จำเป็น');
  });

  it('a short hint sits beside the label (mockup: "พื้นที่ (ไร่) ไม่บังคับ") and joins the accessible name', () => {
    wrap(<TextField testID="f" label="พื้นที่ (ไร่)" hint="ไม่บังคับ" value="" onChangeText={() => {}} />);
    expect(flat(screen.getByText('ไม่บังคับ').props.style).color).toBe(c.inkSoft);
    expect(screen.getByTestId('f').props.accessibilityLabel).toBe('พื้นที่ (ไร่), ไม่บังคับ');
  });

  it('takes something beside the input, e.g. a unit or a "ไม่ทราบ" label', () => {
    const { Text } = jest.requireActual('react-native');
    wrap(<TextField testID="f" label="ส่วนแบ่ง" aside={<Text testID="aside">%</Text>} value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('aside')).toBeTruthy();
  });

  it('keeps the same input when the aside comes and goes, so typing never drops focus', () => {
    const { Text } = jest.requireActual('react-native');
    function Area() {
      const [v, setV] = useState('');
      return <TextField testID="f" label="พื้นที่" aside={v.trim() ? undefined : <Text>ไม่ทราบ</Text>} value={v} onChangeText={setV} />;
    }
    wrap(<Area />);
    const before = screen.getByTestId('f');
    fireEvent.changeText(before, '1');
    expect(screen.queryByText('ไม่ทราบ')).toBeNull();
    expect(screen.getByTestId('f')).toBe(before);
    fireEvent.changeText(before, '');
    expect(screen.getByText('ไม่ทราบ')).toBeTruthy();
    expect(screen.getByTestId('f')).toBe(before);
  });

  it('helper text shows in soft ink and is the hint', () => {
    wrap(<TextField testID="f" label="เบอร์" helper="ไม่บังคับ" value="" onChangeText={() => {}} />);
    expect(flat(screen.getByText('ไม่บังคับ').props.style).color).toBe(c.inkSoft);
    expect(screen.getByTestId('f').props.accessibilityHint).toBe('ไม่บังคับ');
  });

  it('error replaces the helper, outlines the input red and becomes the hint', () => {
    wrap(<TextField testID="f" label="ชื่อ" helper="ช่วย" error="ต้องใส่ชื่อ" value="" onChangeText={() => {}} />);
    expect(screen.queryByText('ช่วย')).toBeNull();
    expect(flat(screen.getByText('ต้องใส่ชื่อ').props.style).color).toBe(c.reject);
    expect(screen.getByTestId('f-error')).toBeTruthy();
    expect(flat(screen.getByTestId('f').props.style)).toMatchObject({ borderColor: c.reject, borderWidth: tokens.border.thick });
    expect(screen.getByTestId('f').props.accessibilityHint).toBe('ต้องใส่ชื่อ');
  });
});
