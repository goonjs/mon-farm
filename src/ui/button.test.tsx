import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Button, PinnedActions } from './button';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('Button / CTA (v1.1.0 pill buttons)', () => {
  it('primary: navy pill at the 48pt floor, white bold sans label', () => {
    const onPress = jest.fn();
    wrap(<Button testID="b" variant="primary" onPress={onPress}>บันทึก</Button>);
    const s = flat(screen.getByTestId('b').props.style);
    expect(s).toMatchObject({ backgroundColor: c.action, borderRadius: tokens.radius.pill, minHeight: tokens.target.min });
    expect(flat(screen.getByText('บันทึก').props.style)).toMatchObject({
      color: c.inkInverse,
      fontWeight: tokens.font.weight.bold,
      fontFamily: tokens.font.family.sans,
    });
    fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ghost: raised fill, navy outline and label', () => {
    wrap(<Button testID="b">ตั้งค่า</Button>);
    expect(flat(screen.getByTestId('b').props.style)).toMatchObject({
      backgroundColor: c.surfaceRaised,
      borderColor: c.action,
      borderWidth: tokens.border.thick,
    });
    expect(flat(screen.getByText('ตั้งค่า').props.style).color).toBe(c.action);
  });

  it('destructive: red outline and label', () => {
    wrap(<Button testID="b" variant="destructive">ลบ</Button>);
    expect(flat(screen.getByTestId('b').props.style).borderColor).toBe(c.reject);
    expect(flat(screen.getByText('ลบ').props.style).color).toBe(c.reject);
  });

  it('disabled: own fill, readable label, dashed border, not faded', () => {
    wrap(<Button testID="b" variant="primary" disabled>บันทึก</Button>);
    const s = flat(screen.getByTestId('b').props.style);
    expect(s).toMatchObject({ backgroundColor: c.disabledFill, borderColor: c.ruleStrong, borderStyle: 'dashed' });
    expect(s.opacity ?? 1).toBe(1);
    expect(screen.getByTestId('b').props.accessibilityState).toMatchObject({ disabled: true });
    expect(flat(screen.getByText('บันทึก').props.style).color).toBe(c.disabledInk);
  });

  it('row: borderless left-aligned row with a drawn chevron, no › glyph', () => {
    wrap(<Button testID="r" variant="row">ไร่คุณพ่อ</Button>);
    expect(flat(screen.getByTestId('r').props.style)).toMatchObject({ borderWidth: 0, minHeight: tokens.target.min });
    expect(flat(screen.getByText('ไร่คุณพ่อ').props.style)).toMatchObject({ color: c.ink, textAlign: 'left' });
    expect(screen.queryByText('›', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('r-chevron', { includeHiddenElements: true })).toBeTruthy();
  });

  it('large CTA: 56pt pill, leading icon painted in the label colour', () => {
    wrap(
      <Button testID="cta" variant="primary" size="large" icon={(colour) => <View testID="cta-icon" style={{ backgroundColor: colour }} />}>
        เริ่มการขายใหม่
      </Button>,
    );
    expect(flat(screen.getByTestId('cta').props.style)).toMatchObject({ minHeight: tokens.target.comfortable });
    expect(flat(screen.getByTestId('cta-icon', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.inkInverse);
  });

  it('PinnedActions: bottom bar on the screen ground, children share the width', () => {
    wrap(
      <PinnedActions testID="pinned">
        <Button>หนึ่ง</Button>
        <Button>สอง</Button>
      </PinnedActions>,
    );
    expect(flat(screen.getByTestId('pinned').props.style)).toMatchObject({
      backgroundColor: c.surface,
      paddingHorizontal: tokens.layout.screenPaddingX,
    });
    expect(screen.getByText('หนึ่ง')).toBeTruthy();
    expect(screen.getByText('สอง')).toBeTruthy();
  });
});
