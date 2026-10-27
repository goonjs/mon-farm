/**
 * Number entry engine (E11-S11 UI-2): the pure rules behind NumberPad,
 * QuantityField and MoneyField. No React, no storage — keys in, text out.
 *
 * STUB: the contract is fixed (other files import it); the bodies are being
 * written test-first in `number-entry.test.ts`.
 */

export type EntryKind = 'int' | 'money';

/** int: `maxDigits` = most digits allowed. money: `maxDigits` = most WHOLE digits (the fraction is always ≤ 2). */
export interface EntryConfig {
  readonly kind: EntryKind;
  readonly maxDigits: number;
}

export type EntryKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '000' | '.' | 'back' | 'clear';

export interface EntryState {
  /** Digits only, plus one '.' for money: "", "20", "1150", "1150.5". No grouping, no leading zeros ("0" and "0.5" are fine). */
  readonly raw: string;
  /** The value was opened with, and nothing typed yet: the first digit REPLACES it (no select-and-delete). */
  readonly fresh: boolean;
  /** The last key was ignored because it would pass the limit — the UI says "ใหญ่เกินไป". Cleared by the next accepted key. */
  readonly rejected: boolean;
}

/** What to draw: `whole` is grouped with commas ("1,250,000"); `fraction` is two digits without the dot ("50"). */
export interface EntryView {
  readonly whole: string;
  readonly fraction: string;
  /** false = the fraction is a faint "00" placeholder; true = the user typed the dot (or digits after it). */
  readonly fractionTyped: boolean;
  readonly empty: boolean;
}

export const startEntry = (_initial: string): EntryState => {
  throw new Error('not implemented');
};

export const pressKey = (_s: EntryState, _key: EntryKey, _cfg: EntryConfig): EntryState => {
  throw new Error('not implemented');
};

export const viewEntry = (_s: EntryState, _cfg: EntryConfig): EntryView => {
  throw new Error('not implemented');
};

/** "20" → 20; "" → null. */
export const entryToInt = (_raw: string): number | null => {
  throw new Error('not implemented');
};

/** "1150.5" → 115050; "" → null. Goes through the string, never `Number(x) * 100` (see finance/money.ts). */
export const entryToSatang = (_raw: string): number | null => {
  throw new Error('not implemented');
};

/** Type-scale step for the money numeral so a long amount never overflows: ≤ 9 chars of the whole part "figure", ≤ 12 "displayXl", else "displayLg". */
export const moneyTextStep = (_view: EntryView): 'figure' | 'displayXl' | 'displayLg' => {
  throw new Error('not implemented');
};
