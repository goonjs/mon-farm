import { fireEvent, screen } from '@testing-library/react-native';

import { FieldError, FieldLabel, RadioCard, SegmentedControl } from './form';
import { wrap } from '../../test/render';
import { tokens } from '../../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('form primitives (E01-S17 X6, v1.1.0 mockups)', () => {
  it('segmented control: sunk pill track, selected segment navy, 48pt, reports the choice', () => {
    const onChange = jest.fn();
    wrap(
      <SegmentedControl
        testID="theme"
        value="light"
        onChange={onChange}
        options={[
          { value: 'light', label: 'สว่าง' },
          { value: 'dark', label: 'มืด' },
        ]}
      />,
    );
    expect(flat(screen.getByTestId('theme').props.style)).toMatchObject({
      backgroundColor: c.surfaceSunk,
      borderRadius: tokens.radius.pill,
    });
    const on = screen.getByTestId('theme-light');
    expect(on.props.accessibilityState).toMatchObject({ selected: true });
    expect(flat(on.props.style)).toMatchObject({ backgroundColor: c.action, minHeight: tokens.target.min });
    expect(flat(screen.getByText('สว่าง').props.style).color).toBe(c.inkInverse);
    expect(flat(screen.getByText('มืด').props.style).color).toBe(c.inkSoft);
    fireEvent.press(screen.getByTestId('theme-dark'));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('radio card: selected = navy 2px edge on the selected wash; a ring that fills', () => {
    wrap(<RadioCard testID="r" selected title="นับต่อเนื่อง" detail="เข่ง 1 ถึง 20" onPress={() => {}} />);
    const card = screen.getByTestId('r');
    expect(card.props.accessibilityRole).toBe('radio');
    expect(card.props.accessibilityState).toMatchObject({ checked: true });
    expect(flat(card.props.style)).toMatchObject({
      borderColor: c.action,
      borderWidth: tokens.border.thick,
      backgroundColor: c.actionSunk,
    });
    expect(screen.getByText('เข่ง 1 ถึง 20')).toBeTruthy();
  });

  it('radio card unselected / disabled: control border, or dashed on the disabled fill', () => {
    wrap(
      <>
        <RadioCard testID="off" selected={false} title="ก" onPress={() => {}} />
        <RadioCard testID="dis" selected={false} disabled title="ข" onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getByTestId('off').props.style)).toMatchObject({ borderColor: c.ruleStrong, backgroundColor: c.surfaceRaised });
    expect(flat(screen.getByTestId('dis').props.style)).toMatchObject({
      borderStyle: 'dashed',
      backgroundColor: c.disabledFill,
    });
    expect(flat(screen.getByText('ข').props.style).color).toBe(c.disabledInk);
  });

  it('required label: red * that screen readers hear as "จำเป็น"', () => {
    wrap(<FieldLabel required>ชื่อสวน</FieldLabel>);
    const star = screen.getByTestId('required-mark');
    expect(flat(star.props.style).color).toBe(c.reject);
    expect(star.props.accessibilityLabel).toBe('จำเป็น');
  });

  it('inline field error: red text with a shape, announced', () => {
    wrap(<FieldError testID="err">ต้องใส่ชื่อ</FieldError>);
    const err = screen.getByTestId('err');
    expect(err.props.accessibilityLiveRegion).toBe('polite');
    expect(flat(screen.getByText('ต้องใส่ชื่อ').props.style)).toMatchObject({ color: c.reject, fontSize: tokens.font.size.bodySm });
  });
});
