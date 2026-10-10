import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { FactRow, IconTile } from './icon-tile';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('IconTile and FactRow (E01-S17 X4, D-70)', () => {
  it.each([
    ['accept', c.acceptSunk, c.accept],
    ['warn', c.warnSunk, c.warn],
    ['neutral', c.surfaceSunk, c.inkSoft],
    ['category3', c.category3Sunk, c.category3],
  ] as const)('%s tile: tinted ground, icon in the matching ink', (tone, bg, fg) => {
    wrap(<IconTile testID="tile" tone={tone} icon={(colour) => <View testID="glyph" style={{ backgroundColor: colour }} />} />);
    expect(flat(screen.getByTestId('tile', { includeHiddenElements: true }).props.style)).toMatchObject({
      backgroundColor: bg,
      borderRadius: tokens.radius.md,
      width: tokens.target.min,
      height: tokens.target.min,
    });
    expect(flat(screen.getByTestId('glyph', { includeHiddenElements: true }).props.style).backgroundColor).toBe(fg);
  });

  it('fact row: one fact per line, small icon + secondary text', () => {
    wrap(
      <FactRow icon={(colour) => <View testID="fact-icon" style={{ backgroundColor: colour }} />}>4 จุดชั่ง</FactRow>,
    );
    expect(flat(screen.getByText('4 จุดชั่ง').props.style)).toMatchObject({
      color: c.inkSoft,
      fontSize: tokens.font.size.bodySm,
      fontFamily: tokens.font.family.sans,
    });
    expect(screen.getByText('4 จุดชั่ง').props.numberOfLines).toBe(1);
    expect(flat(screen.getByTestId('fact-icon', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.inkSoft);
  });
});
