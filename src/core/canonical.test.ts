import { describe, expect, it } from 'vitest';

import { canonicalJson } from './canonical';

describe('canonicalJson — architecture §Local data layer', () => {
  it('sorts keys at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[{"x":2,"y":1}]},"b":1}',
    );
  });

  it('omits undefined optional fields, so they compare equal to absent ones', () => {
    expect(canonicalJson({ a: 1, mono: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('distinguishes different content', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});
