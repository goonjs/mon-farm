import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { ActionTile } from './action-tile';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;
const glyph = (colour: string) => <View testID="glyph" style={{ backgroundColor: colour }} />;

describe('ActionTile — the home action cards (farm mockup screen 1/9, review S6)', () => {
  it('is a card-shaped button: icon tile over a bold word, at least a 48pt target', () => {
    const onPress = jest.fn();
    wrap(<ActionTile testID="act-expense" label="บันทึกค่าใช้จ่าย" icon={glyph} tone="accept" onPress={onPress} />);
    const tile = screen.getByTestId('act-expense');
    expect(tile.props.accessibilityRole).toBe('button');
    expect(tile.props.accessibilityLabel).toBe('บันทึกค่าใช้จ่าย');
    const style = flat(tile.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(tokens.target.min);
    expect(style).toMatchObject({ backgroundColor: c.surfaceRaised, borderColor: c.ruleFaint, borderWidth: tokens.border.hair });
    expect(flat(screen.getByText('บันทึกค่าใช้จ่าย').props.style)).toMatchObject({
      color: c.ink,
      fontWeight: tokens.font.weight.bold,
      fontFamily: tokens.font.family.sans,
    });
    expect(flat(screen.getByTestId('glyph', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.accept);
    fireEvent.press(tile);
    expect(onPress).toHaveBeenCalled();
  });

  it('the main action gets a thick action-coloured edge, not colour alone', () => {
    wrap(<ActionTile testID="act-main" label="เริ่มการขาย" icon={glyph} tone="action" main />);
    expect(flat(screen.getByTestId('act-main').props.style)).toMatchObject({
      borderColor: c.action,
      borderWidth: tokens.border.thick,
    });
  });

  it('cream tone paints the warn ink on the cream ground (mockup t-cream)', () => {
    wrap(<ActionTile testID="act-prep" label="เตรียมขาย" icon={glyph} tone="cream" />);
    expect(flat(screen.getByTestId('glyph', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.warn);
  });
});
