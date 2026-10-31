/**
 * Money for a summary line, at most 4 digits, k / m for the rest (owner
 * 2026-10-31): 3,250 → "฿ 3,250", 12,540 → "฿ 12.54k", 1,234,567 → "฿ 1.235m".
 * Display only and rounded: a screen that settles money shows the exact
 * figure one tap away, and no sum is ever taken from this text.
 *
 * Integer satang in (callers pass integers; exact up to ~45 billion baht,
 * above that rounding may be off). Half-up rounding done on integers. The
 * 4-digit rule is for farm-sized amounts: above 9,999 m the digits grow. Under 10,000 baht it
 * is whole baht with a comma (under 1,000 it keeps satang while 4 digits
 * allow, trailing zeros dropped). From 10,000 baht the unit carries the
 * scale and the decimals are fixed so a column keeps its width; a value that
 * rounds up past the unit (9,999.60; 999,960) moves to the next one.
 * `compactMoneyParts` gives the unit apart so the UI can stress it.
 */

export interface CompactMoneyParts {
  readonly sign: '' | '−';
  /** Digits with a comma only for whole baht under 10,000, e.g. "3,250", "12.54". */
  readonly digits: string;
  readonly unit: '' | 'k' | 'm';
}

const UNITS = [
  { unit: '', den: 100, maxDecimals: 2 },
  { unit: 'k', den: 100_000, maxDecimals: 3 },
  { unit: 'm', den: 100_000_000, maxDecimals: 3 },
] as const;

/** `num / den` rounded half up, both non-negative integers. */
const roundDiv = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

const withComma = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function compactMoneyParts(satang: number): CompactMoneyParts {
  const sign = satang < 0 ? '−' : '';
  const abs = Math.abs(satang);
  for (let i = 0; i < UNITS.length; i++) {
    const { unit, den, maxDecimals } = UNITS[i];
    const last = i === UNITS.length - 1;
    for (let d: number = maxDecimals; d >= 0; d--) {
      const scaled = roundDiv(abs * 10 ** d, den);
      // k never shows 1000 or more of itself: that is 1 m.
      const fits = String(scaled).length <= 4 && (unit !== 'k' || scaled < 1000 * 10 ** d);
      if (!fits && !(last && d === 0)) continue;
      const text = String(scaled).padStart(d + 1, '0');
      const whole = d ? text.slice(0, -d) : text;
      let frac = d ? text.slice(-d) : '';
      if (unit === '') frac = frac.replace(/0+$/, '');
      return { sign, digits: (unit === '' ? withComma(whole) : whole) + (frac ? `.${frac}` : ''), unit };
    }
  }
  return { sign, digits: '0', unit: '' };
}

export function compactMoney(satang: number): string {
  const p = compactMoneyParts(satang);
  return `${p.sign}฿ ${p.digits}${p.unit}`;
}
