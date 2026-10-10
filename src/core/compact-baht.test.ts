import { describe, expect, it } from 'vitest';

import { compactBaht } from './compact-baht';

const b = (baht: number) => compactBaht(baht * 100);

describe('compactBaht — E04-S05, D-41', () => {
  it('the owner examples: at most 3 significant digits + พัน / หมื่น / แสน', () => {
    expect(b(2_450)).toBe('2.45 พัน');
    expect(b(53_350)).toBe('5.34 หมื่น');
    expect(b(134_250)).toBe('1.34 แสน');
  });

  it('under 1,000 shows in full', () => {
    expect(b(0)).toBe('0');
    expect(b(850)).toBe('850');
    expect(b(999)).toBe('999');
    expect(compactBaht(99_950)).toBe('999.50');
  });

  it('rounds half up on integers, never through floating point', () => {
    expect(b(5_335)).toBe('5.34 พัน');
    expect(b(5_334)).toBe('5.33 พัน');
    expect(b(1_000)).toBe('1.00 พัน');
  });

  it('a value that rounds up to 10 of a unit is shown in the next unit', () => {
    expect(b(9_996)).toBe('1.00 หมื่น');
    expect(b(999_960)).toBe('1.00 ล้าน');
  });

  it('ล้าน is the largest unit: 3 significant digits above it', () => {
    expect(b(2_345_000)).toBe('2.35 ล้าน');
    expect(b(12_345_000)).toBe('12.3 ล้าน');
    expect(b(123_456_000)).toBe('123 ล้าน');
  });
});
