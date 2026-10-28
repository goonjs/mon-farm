import { describe, expect, it } from 'vitest';

import {
  entryToInt,
  entryToSatang,
  moneyTextStep,
  pressKey,
  startEntry,
  viewEntry,
  type EntryConfig,
  type EntryKey,
  type EntryState,
} from './number-entry';

const INT: EntryConfig = { kind: 'int', maxDigits: 3 };
const MONEY: EntryConfig = { kind: 'money', maxDigits: 9 };

/** Press keys in order from a fresh state opened with `initial`. */
const type = (cfg: EntryConfig, keys: EntryKey[], initial = ''): EntryState =>
  keys.reduce((s, k) => pressKey(s, k, cfg), startEntry(initial));

describe('startEntry', () => {
  it('keeps the initial text as given and starts fresh', () => {
    expect(startEntry('20')).toEqual({ raw: '20', fresh: true, rejected: false });
    expect(startEntry('')).toEqual({ raw: '', fresh: true, rejected: false });
  });
});

describe('pressKey — fresh', () => {
  it('a digit replaces the opened value', () => {
    expect(type(INT, ['5'], '20')).toEqual({ raw: '5', fresh: false, rejected: false });
    expect(type(INT, ['0'], '20').raw).toBe('0');
  });
  it("'.' on money starts 0., on int is ignored", () => {
    expect(type(MONEY, ['.'], '1150').raw).toBe('0.');
    expect(type(MONEY, ['.'], '1150').fresh).toBe(false);
    expect(type(INT, ['.'], '20')).toEqual(startEntry('20'));
  });
  it("'back' clears the whole opened value", () => {
    expect(type(INT, ['back'], '20')).toEqual({ raw: '', fresh: false, rejected: false });
  });
  it("'clear' empties and ends fresh", () => {
    expect(type(MONEY, ['clear'], '1150.5')).toEqual({ raw: '', fresh: false, rejected: false });
  });
  it("'00' and '000' on a fresh value do nothing", () => {
    expect(type(INT, ['00'], '20')).toEqual(startEntry('20'));
    expect(type(INT, ['000'], '20')).toEqual(startEntry('20'));
  });
});

describe('pressKey — typing', () => {
  it('digits append', () => {
    expect(type(INT, ['1', '2']).raw).toBe('12');
  });
  it('leading zeros collapse', () => {
    expect(type(INT, ['0', '5']).raw).toBe('5');
    expect(type(INT, ['0', '0']).raw).toBe('0');
    expect(type(INT, ['0', '00']).raw).toBe('0');
    expect(type(INT, ['clear', '00']).raw).toBe('');
    expect(type(INT, ['clear', '000']).raw).toBe('');
  });
  it("'00' and '000' append zeros otherwise", () => {
    expect(type(MONEY, ['1', '00']).raw).toBe('100');
    expect(type(MONEY, ['1', '000']).raw).toBe('1000');
  });
  it("'back' removes the last char", () => {
    expect(type(MONEY, ['5', 'back']).raw).toBe('');
    expect(type(MONEY, ['0', '.', 'back']).raw).toBe('0');
    expect(type(MONEY, ['1', '2', 'back']).raw).toBe('1');
    expect(type(INT, ['clear', 'back']).raw).toBe('');
  });
  it('money: one dot only, ignored without rejection', () => {
    const s = type(MONEY, ['1', '.', '5', '.']);
    expect(s.raw).toBe('1.5');
    expect(s.rejected).toBe(false);
  });
  it("money: '.' after digits and on empty", () => {
    expect(type(MONEY, ['1', '.']).raw).toBe('1.');
    expect(type(MONEY, ['clear', '.']).raw).toBe('0.');
  });
  it("int: '.' is ignored, not rejected", () => {
    const s = type(INT, ['1', '.']);
    expect(s.raw).toBe('1');
    expect(s.rejected).toBe(false);
  });
});

describe('pressKey — limits', () => {
  it('int stops at maxDigits and rejects', () => {
    const s = type(INT, ['1', '2', '3', '4']);
    expect(s.raw).toBe('123');
    expect(s.rejected).toBe(true);
  });
  it('the next accepted key clears rejected', () => {
    const s = type(INT, ['1', '2', '3', '4', 'back']);
    expect(s.raw).toBe('12');
    expect(s.rejected).toBe(false);
  });
  it('an ignored key keeps rejected as it was', () => {
    expect(type(INT, ['1', '2', '3', '4', '.']).rejected).toBe(true);
  });
  it("'00' that would exceed the limit appends none and rejects", () => {
    const s = type(INT, ['1', '2', '00']);
    expect(s.raw).toBe('12');
    expect(s.rejected).toBe(true);
    expect(type(INT, ['1', '00']).raw).toBe('100');
  });
  it('money: whole digits capped by maxDigits, fraction by 2', () => {
    const cfg: EntryConfig = { kind: 'money', maxDigits: 4 };
    expect(type(cfg, ['1', '2', '3', '4', '5']).rejected).toBe(true);
    expect(type(cfg, ['1', '2', '3', '4', '5']).raw).toBe('1234');
    const f = type(MONEY, ['1', '.', '5', '0', '9']);
    expect(f.raw).toBe('1.50');
    expect(f.rejected).toBe(true);
  });
  it("money: '00' in the fraction fills to two digits and never reads as too big", () => {
    expect(type(MONEY, ['1', '.', '5', '00']).raw).toBe('1.50');
    expect(type(MONEY, ['1', '.', '5', '00']).rejected).toBe(false);
    expect(type(MONEY, ['1', '.', '00']).raw).toBe('1.00');
  });
  it('typing a digit at the cap after a decimal point still works', () => {
    const cfg: EntryConfig = { kind: 'money', maxDigits: 2 };
    expect(type(cfg, ['9', '9', '.', '5']).raw).toBe('99.5');
  });
});

describe('viewEntry', () => {
  it('groups the whole part', () => {
    expect(viewEntry(startEntry('1250000'), MONEY).whole).toBe('1,250,000');
    expect(viewEntry(startEntry('20'), INT).whole).toBe('20');
  });
  it('empty shows 0 and flags empty', () => {
    expect(viewEntry(startEntry(''), INT)).toEqual({ whole: '0', fraction: '', fractionTyped: false, empty: true });
    expect(viewEntry(startEntry(''), MONEY)).toEqual({ whole: '0', fraction: '00', fractionTyped: false, empty: true });
  });
  it('money fraction is padded and flagged once the dot exists', () => {
    expect(viewEntry(startEntry('1150'), MONEY)).toEqual({ whole: '1,150', fraction: '00', fractionTyped: false, empty: false });
    expect(viewEntry(startEntry('1150.'), MONEY)).toMatchObject({ fraction: '00', fractionTyped: true });
    expect(viewEntry(startEntry('1150.5'), MONEY)).toMatchObject({ fraction: '50', fractionTyped: true });
    expect(viewEntry(startEntry('1150.55'), MONEY)).toMatchObject({ fraction: '55', fractionTyped: true });
  });
  it('int has no fraction', () => {
    expect(viewEntry(startEntry('0'), INT)).toEqual({ whole: '0', fraction: '', fractionTyped: false, empty: false });
  });
});

describe('entryToInt', () => {
  it('parses digits only', () => {
    expect(entryToInt('20')).toBe(20);
    expect(entryToInt('0')).toBe(0);
    expect(entryToInt('')).toBeNull();
    expect(entryToInt('1.5')).toBeNull();
    expect(entryToInt('-1')).toBeNull();
    expect(entryToInt('1e3')).toBeNull();
    expect(entryToInt('99999999999999999999')).toBeNull();
  });
});

describe('entryToSatang', () => {
  it('goes through the string', () => {
    expect(entryToSatang('1150.5')).toBe(115050);
    expect(entryToSatang('1150')).toBe(115000);
    expect(entryToSatang('1150.')).toBe(115000);
    expect(entryToSatang('0.05')).toBe(5);
    expect(entryToSatang('1.15')).toBe(115);
    expect(entryToSatang('')).toBeNull();
  });
  it('rejects malformed or unsafe values', () => {
    expect(entryToSatang('1.234')).toBeNull();
    expect(entryToSatang('abc')).toBeNull();
    expect(entryToSatang('.5')).toBeNull();
    expect(entryToSatang('99999999999999999')).toBeNull();
  });
});

describe('moneyTextStep', () => {
  const step = (raw: string) => moneyTextStep(viewEntry(startEntry(raw), MONEY));
  it('shrinks the numeral as the whole part grows', () => {
    expect(step('1150')).toBe('figure');
    expect(step('1250000')).toBe('figure');
    expect(step('12345678')).toBe('displayXl');
    expect(step('123456789')).toBe('displayXl');
    expect(step('1234567890123')).toBe('displayLg');
  });
});

describe('pressKey — 00/000 after the decimal dot', () => {
  const money = { kind: 'money', maxDigits: 8 } as const;
  const type = (keys: string[]) => keys.reduce((s, k) => pressKey(s, k as never, money), startEntry(''));
  it('fills the fraction to two digits and never says too big', () => {
    expect(type(['5', '.', '0', '00']).raw).toBe('5.00');
    expect(type(['5', '.', '000']).raw).toBe('5.00');
    const full = type(['5', '.', '5', '0', '00']);
    expect(full.raw).toBe('5.50');
    expect(full.rejected).toBe(false);
  });
});
