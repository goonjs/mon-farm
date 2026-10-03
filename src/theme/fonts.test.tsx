import { tokens } from '../../design/tokens';
import { FONT_FACES, fontAssets, face, faceFor } from './fonts';

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

  // Guards the mapping only; that the bundle really carries just these five
  // files is checked on the built output (story Dev notes: `dist/` font list).
  test('embeds only the weights the tokens use (AC: no unused weights)', () => {
    expect(Object.keys(fontAssets).sort()).toEqual([...new Set(weights.map((w) => FONT_FACES[w]))].sort());
  });

  test('face() names the weight family and sets no fontWeight (no faux bold)', () => {
    expect(face(tokens.font.weight.bold)).toEqual({ fontFamily: FONT_FACES['700'] });
    expect(face(tokens.font.weight.regular)).toEqual({ fontFamily: FONT_FACES['400'] });
  });

  test('on web the system sans follows, so a failed load is not a serif fallback', () => {
    expect(faceFor('700', 'web').fontFamily).toBe(`${FONT_FACES['700']}, ${tokens.font.family.sans}`);
    expect(faceFor('700', 'android').fontFamily).toBe(FONT_FACES['700']);
  });
});
