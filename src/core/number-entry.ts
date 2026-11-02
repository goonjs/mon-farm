/**
 * Number entry engine (E11-S11 UI-2): the pure rules behind NumberPad,
 * QuantityField and MoneyField. No React, no storage — keys in, text out.
 */

export type EntryKind = 'int' | 'money' | 'decimal';

/**
 * int: `maxDigits` = most digits allowed. money: `maxDigits` = most WHOLE digits (the fraction is always ≤ 2).
 * decimal (E01-S20, ไร่ / กก.): `maxDigits` whole digits and at most `decimals` after the dot; no 00 / 000.
 */
export interface EntryConfig {
  readonly kind: EntryKind;
  readonly maxDigits: number;
  readonly decimals?: number;
}

const fractionMax = (cfg: EntryConfig): number => (cfg.kind === 'money' ? 2 : cfg.kind === 'decimal' ? (cfg.decimals ?? 0) : 0);

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

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const startEntry = (initial: string): EntryState => ({ raw: initial, fresh: true, rejected: false });

/** Does `raw` fit the limits? int: digits; money: whole digits and ≤ 2 fraction digits. */
const fits = (raw: string, cfg: EntryConfig): boolean => {
  const [whole = '', fraction = ''] = raw.split('.');
  return whole.length <= cfg.maxDigits && fraction.length <= fractionMax(cfg);
};

const typed = (raw: string): EntryState => ({ raw, fresh: false, rejected: false });

export const pressKey = (s: EntryState, key: EntryKey, cfg: EntryConfig): EntryState => {
  if (key === 'clear') return typed('');
  if (key === 'back') return typed(s.fresh ? '' : s.raw.slice(0, -1));
  if (key === '.') {
    if (fractionMax(cfg) === 0) return s; // meaningless, not a rejection
    // Like a digit, a first "." starts over, even when the old value had a dot.
    if (s.fresh || s.raw === '') return typed('0.');
    return s.raw.includes('.') ? s : typed(`${s.raw}.`);
  }
  // Digits. A fresh value is replaced, so build on an empty base.
  const base = s.fresh ? '' : s.raw;
  if (base === '' || base === '0') {
    if (key === '00' || key === '000' || (key === '0' && base === '0')) return s; // leading zeros collapse
    return typed(key);
  }
  // "00"/"000" after the dot only fill the fraction up to two digits (5.0 → 5.00); at two digits they do nothing, no "too big".
  if ((key === '00' || key === '000') && base.includes('.')) {
    const room = 2 - (base.split('.')[1] ?? '').length;
    return room > 0 ? typed(`${base}${'0'.repeat(Math.min(room, key.length))}`) : s;
  }
  const next = `${base}${key}`;
  return fits(next, cfg) ? typed(next) : { ...s, rejected: true };
};

export const viewEntry = (s: EntryState, cfg: EntryConfig): EntryView => {
  const [whole = '', fraction = ''] = s.raw.split('.');
  const money = cfg.kind === 'money';
  return {
    whole: group(whole === '' ? '0' : whole),
    fraction: money ? fraction.padEnd(2, '0') : cfg.kind === 'decimal' ? fraction : '',
    fractionTyped: cfg.kind !== 'int' && s.raw.includes('.'),
    empty: s.raw === '',
  };
};

/** "20" → 20; "" → null. */
export const entryToInt = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
};

/** "1150.5" → 115050; "" → null. Goes through the string, never `Number(x) * 100` (see finance/money.ts). */
export const entryToSatang = (raw: string): number | null => {
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(raw);
  if (!m) return null;
  const satang = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(satang) ? satang : null;
};

/** A decimal entry in its smallest stored unit, through the string: ("12.5", 2) → 1250 (0.01 ไร่); ("23.5", 3) → 23500 (กรัม). */
export const entryToScaled = (raw: string, decimals: number): number | null => {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(raw);
  if (!m || (m[2] ?? '').length > decimals) return null;
  const n = Number(m[1]) * 10 ** decimals + Number((m[2] ?? '').padEnd(decimals, '0') || '0');
  return Number.isSafeInteger(n) ? n : null;
};

/** The inverse of `entryToScaled`, without trailing zeros: (1250, 2) → "12.5"; null → "". */
export const scaledToEntry = (n: number | null, decimals: number): string => {
  if (n == null) return '';
  const unit = 10 ** decimals;
  const fraction = String(n % unit).padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${Math.floor(n / unit)}.${fraction}` : String(Math.floor(n / unit));
};

/** Type-scale step for the money numeral so a long amount never overflows: ≤ 9 chars of the whole part "figure", ≤ 12 "displayXl", else "displayLg". */
export const moneyTextStep = (view: EntryView): 'figure' | 'displayXl' | 'displayLg' =>
  view.whole.length <= 9 ? 'figure' : view.whole.length <= 12 ? 'displayXl' : 'displayLg';
