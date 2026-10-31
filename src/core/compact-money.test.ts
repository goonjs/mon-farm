import { describe, expect, it } from 'vitest';

import { compactMoney, compactMoneyParts } from './compact-money';

const b = (baht: number) => compactMoney(Math.round(baht * 100));

describe('compactMoney — at most 4 digits, k / m for the rest (owner 2026-10-31)', () => {
  it('owner examples', () => {
    expect(b(12_540)).toBe('฿ 12.54k');
    expect(b(3_250)).toBe('฿ 3,250');
    expect(b(24_140)).toBe('฿ 24.14k');
  });

  it('under 10,000 baht shows whole baht with a comma, no unit', () => {
    expect(b(0)).toBe('฿ 0');
    expect(b(999)).toBe('฿ 999');
    expect(b(1_000)).toBe('฿ 1,000');
    expect(b(9_999)).toBe('฿ 9,999');
  });

  it('under 1,000 keeps satang while 4 digits allow, trailing zeros dropped', () => {
    expect(b(640.5)).toBe('฿ 640.5');
    expect(b(850)).toBe('฿ 850');
    expect(b(12.34)).toBe('฿ 12.34');
  });

  it('k: 4 digits in all, fixed decimals', () => {
    expect(b(10_000)).toBe('฿ 10.00k');
    expect(b(125_400)).toBe('฿ 125.4k');
    expect(b(999_900)).toBe('฿ 999.9k');
  });

  it('m: 4 digits in all', () => {
    expect(b(1_234_567)).toBe('฿ 1.235m');
    expect(b(12_345_678)).toBe('฿ 12.35m');
    expect(b(123_456_789)).toBe('฿ 123.5m');
    expect(b(1_234_567_890)).toBe('฿ 1235m');
  });

  it('a value that rounds up into the next unit is shown in that unit', () => {
    expect(compactMoney(999_960)).toBe('฿ 10.00k'); // 9,999.60
    expect(b(999_960)).toBe('฿ 1.000m');
  });

  it('rounds half up on integers', () => {
    expect(compactMoney(1_254_500_00 / 100)).toBe('฿ 12.55k'); // 12,545 baht
  });

  it('negative keeps the true minus sign', () => {
    expect(b(-3_250)).toBe('−฿ 3,250');
    expect(compactMoneyParts(-1_254_000)).toEqual({ sign: '−', digits: '12.54', unit: 'k' });
  });

  it('parts say the unit separately so a screen can stress it', () => {
    expect(compactMoneyParts(1_254_000)).toEqual({ sign: '', digits: '12.54', unit: 'k' });
    expect(compactMoneyParts(325_000)).toEqual({ sign: '', digits: '3,250', unit: '' });
    expect(compactMoneyParts(1_234_567_00)).toEqual({ sign: '', digits: '1.235', unit: 'm' });
  });
});
