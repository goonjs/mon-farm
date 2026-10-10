import { screen } from '@testing-library/react-native';

import { Chip } from './chip';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('Chip — status in icon + word, never colour alone', () => {
  it.each([
    ['accept', c.acceptSunk, c.accept],
    ['warn', c.warnSunk, c.warn],
    ['reject', c.rejectSunk, c.reject],
    ['neutral', c.surfaceSunk, c.inkSoft],
  ] as const)('%s tone: sunk ground, matching ink, a drawn icon and the word', (tone, bg, fg) => {
    wrap(<Chip testID="chip" tone={tone} label="ยืนยันแล้ว" />);
    expect(flat(screen.getByTestId('chip').props.style).backgroundColor).toBe(bg);
    expect(flat(screen.getByText('ยืนยันแล้ว').props.style)).toMatchObject({ color: fg, fontFamily: tokens.font.family.sans });
    expect(screen.getByTestId(`chip-icon-${tone}`, { includeHiddenElements: true })).toBeTruthy();
  });

  it('is announced by its word', () => {
    wrap(<Chip testID="chip" tone="warn" label="รอส่ง" />);
    expect(screen.getByTestId('chip').props.accessibilityLabel).toBe('รอส่ง');
  });
});
