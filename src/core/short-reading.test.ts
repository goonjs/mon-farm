import { describe, expect, it } from 'vitest';

import { fieldKg, netFromReading, parseKg, readingFromNet } from './short-reading';

describe('short basket: scale reading ↔ net rubber (E04-S16)', () => {
  it('net is the reading minus everything that is not new rubber', () => {
    expect(netFromReading(37, 2)).toBe(35);
    expect(netFromReading(49, 2)).toBe(47);
    // basket 2 + skew 0.5 + 10 already in the basket on a top-up
    expect(netFromReading(30, 12.5)).toBe(17.5);
  });

  it('reading from net is the exact inverse', () => {
    expect(readingFromNet(35, 2)).toBe(37);
    expect(readingFromNet(17.5, 12.5)).toBe(30);
    for (const n of [1, 7, 47.5]) expect(netFromReading(readingFromNet(n, 2.3), 2.3)).toBe(n);
  });

  it('does not leak float noise', () => {
    expect(readingFromNet(0.1, 0.2)).toBe(0.3);
    expect(netFromReading(0.3, 0.2)).toBe(0.1);
  });
});

describe('typed kg (E04-S16)', () => {
  it('reads whole and one-point decimals, nothing else', () => {
    expect(parseKg('49')).toBe(49);
    expect(parseKg('47.5')).toBe(47.5);
    expect(parseKg('.5')).toBe(0.5);
    expect(parseKg('')).toBeNull();
    expect(parseKg('.')).toBeNull();
    expect(parseKg('1.2.3')).toBeNull();
    expect(parseKg('-4')).toBeNull();
    expect(parseKg('4a')).toBeNull();
  });

  it('shows a computed value as plain text a person would type', () => {
    expect(fieldKg(47)).toBe('47');
    expect(fieldKg(47.5)).toBe('47.5');
    expect(fieldKg(-3)).toBe('-3');
  });
});
