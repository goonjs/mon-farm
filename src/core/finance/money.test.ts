import { describe, expect, it } from 'vitest';

import { formatSatang, parseBahtToSatang, formatDate } from './money';

describe('parseBahtToSatang — exact, no float', () => {
  it.each([
    ['640', 64000],
    ['640.00', 64000],
    ['640.5', 64050],
    ['0.01', 1],
    ['1,234.56', 123456],
    ['15000', 1500000],
    [' 26.50 ', 2650],
    // 0.1 + 0.2 territory: string arithmetic must not drift.
    ['0.29', 29],
    ['1.15', 115],
  ])('%s → %i satang', (input, satang) => {
    expect(parseBahtToSatang(input)).toBe(satang);
  });

  it.each(['', 'abc', '1.234', '-5', '1.2.3', '.', '1e3'])('rejects %j', (input) => {
    expect(parseBahtToSatang(input)).toBeNull();
  });
});

describe('formatSatang', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [64000, '640.00'],
    [123456, '1,234.56'],
    [1500000, '15,000.00'],
    [-20000, '−200.00'],
  ])('%i → %s', (satang, out) => {
    expect(formatSatang(satang)).toBe(out);
  });
});

describe('formatDate — พ.ศ. by default, ค.ศ. on tap (D-65)', () => {
  it('Buddhist era', () => {
    expect(formatDate('2026-09-28', 'be')).toBe('28 ก.ย. 2569');
  });
  it('Common era', () => {
    expect(formatDate('2026-09-28', 'ce')).toBe('28 ก.ย. 2026');
  });
});
