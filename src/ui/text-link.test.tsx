import { fireEvent, screen } from '@testing-library/react-native';

import { TextLink } from './text-link';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('TextLink — the underlined word that replaces a round outlined button (owner rule 2026-11-06)', () => {
  it.each([
    ['action', c.action],
    ['reject', c.reject],
  ] as const)('%s tone: underlined, bold, its colour, no box', (tone, ink) => {
    wrap(<TextLink testID="l" tone={tone} onPress={() => undefined}>ลบการคืน</TextLink>);
    const box = flat(screen.getByTestId('l').props.style);
    expect(box.borderWidth ?? 0).toBe(0);
    expect(box.backgroundColor).toBeUndefined();
    expect(flat(screen.getByText('ลบการคืน').props.style)).toMatchObject({ color: ink, textDecorationLine: 'underline', fontWeight: tokens.font.weight.bold });
  });

  it('is a 48 target, left-aligned, a button with its word as the name, and presses', () => {
    const onPress = jest.fn();
    wrap(<TextLink testID="l" tone="action" onPress={onPress}>กู้คืน</TextLink>);
    const l = screen.getByTestId('l');
    expect(flat(l.props.style)).toMatchObject({ minHeight: tokens.target.min, minWidth: tokens.target.min, alignSelf: 'flex-start' });
    expect(l.props.accessibilityRole).toBe('button');
    fireEvent.press(l);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
