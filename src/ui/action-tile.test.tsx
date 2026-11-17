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

  it('a tint paints the frame and ground in that colour without making the tile bigger; a badge floats at the top right (E15-S06 HT-1..3)', () => {
    wrap(
      <>
        <ActionTile testID="plain" label="เตรียมขาย" icon={glyph} tone="cream" />
        <ActionTile testID="tinted" label="เตรียมขาย" icon={glyph} tone="cream" tint="warn" badge={{ text: '2', tone: 'warn', label: 'เหลือ 2 ข้อ' }} />
      </>,
    );
    const plain = flat(screen.getByTestId('plain').props.style);
    const tinted = flat(screen.getByTestId('tinted').props.style);
    expect(tinted).toMatchObject({ borderColor: c.warn, backgroundColor: c.warnSunk, borderWidth: tokens.border.thick });
    // The thicker frame is paid for in padding: the content box does not move.
    expect(tinted.paddingVertical + tinted.borderWidth).toBe(plain.paddingVertical + plain.borderWidth);
    expect(tinted.paddingHorizontal + tinted.borderWidth).toBe(plain.paddingHorizontal + plain.borderWidth);
    expect(tinted.minHeight).toBe(plain.minHeight);
    const badge = screen.getByTestId('tinted-badge');
    expect(flat(badge.props.style)).toMatchObject({ position: 'absolute', top: 6, right: 6, backgroundColor: c.warn });
    expect(badge.props.accessibilityLabel).toBe('เหลือ 2 ข้อ');
    expect(screen.getByTestId('tinted').props.accessibilityLabel).toBe('เตรียมขาย เหลือ 2 ข้อ');
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByTestId('plain-badge')).toBeNull();
  });

  it('a badge can carry an icon instead of a word; the colours follow the meaning (blue, green, red)', () => {
    wrap(
      <>
        <ActionTile testID="icon" label="เริ่มการขาย" icon={glyph} tone="action" tint="action" badge={{ icon: () => <View testID="badge-glyph" />, tone: 'action', label: 'รอเริ่มขาย' }} />
        <ActionTile testID="red" label="เริ่มการขาย" icon={glyph} tone="action" tint="accept" badge={{ text: '3', tone: 'reject', label: 'เงินค้าง 3 กอง' }} />
      </>,
    );
    expect(flat(screen.getByTestId('icon-badge').props.style).backgroundColor).toBe(c.action);
    expect(screen.getByTestId('badge-glyph')).toBeTruthy();
    expect(flat(screen.getByTestId('red').props.style)).toMatchObject({ borderColor: c.accept, backgroundColor: c.acceptSunk });
    expect(flat(screen.getByTestId('red-badge').props.style).backgroundColor).toBe(c.reject);
  });
});
