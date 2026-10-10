import { fireEvent, screen } from '@testing-library/react-native';

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
