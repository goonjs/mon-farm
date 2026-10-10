import { describe, expect, it } from 'vitest';

import { TEXT_SCALE, scaleSizes } from './text-scale';

describe('text size S / M / L (E03-S08, design-system §12.10 #5)', () => {
  const sizes = { small: 13, body: 16, title: 24 };

  it('M is the identity; S and L scale every size by 0.875 / 1.125, rounded to whole px', () => {
    expect(scaleSizes(sizes, 'm')).toEqual(sizes);
    expect(scaleSizes(sizes, 's')).toEqual({ small: 11, body: 14, title: 21 });
    expect(scaleSizes(sizes, 'l')).toEqual({ small: 15, body: 18, title: 27 });
  });

  it('body reads 14 / 16 / 18 as the story names them', () => {
    expect((['s', 'm', 'l'] as const).map((k) => scaleSizes(sizes, k).body)).toEqual([14, 16, 18]);
  });

  it('matches the design tokens', () => {
    expect(TEXT_SCALE).toEqual({ s: 0.875, m: 1, l: 1.125 });
  });
});
