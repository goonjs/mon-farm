import { tokens } from '../../design/tokens';
import { FONT_FACES, fontAssets, face } from './fonts';

/**
 * E01-S13. Noto Sans Thai is embedded per weight, and a weight only renders
 * correctly if a face for it was both declared and loaded. On Android a
 * `fontFamily` names one file, so `fontWeight` cannot pick a heavier cut — the
 * style must name the weight's own family instead.
 */
describe('fonts', () => {
  const weights = Object.values(tokens.font.weight);

  test.each(weights)('weight %s has a face that is also loaded', (w) => {
    const family = FONT_FACES[w];
    expect(family).toMatch(/^NotoSansThai_/);
    expect(fontAssets).toHaveProperty(family);
  });

  test('embeds only the weights the tokens use (AC: no unused weights)', () => {
    expect(Object.keys(fontAssets).sort()).toEqual([...new Set(weights.map((w) => FONT_FACES[w]))].sort());
  });

  test('face() names the weight family and sets no fontWeight (no faux bold)', () => {
    expect(face(tokens.font.weight.bold)).toEqual({ fontFamily: FONT_FACES['700'] });
    expect(face(tokens.font.weight.regular)).toEqual({ fontFamily: FONT_FACES['400'] });
  });
});
