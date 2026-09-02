/**
 * Spells a non-negative integer as Thai number words, for the spoken count
 * (FR-11.3, FR-11.8).
 *
 * Thai numerals are irregular in exactly two places, and both are silent
 * failures if missed — the count still displays fine, it just sounds wrong,
 * which is worse than not speaking at all for a feature that exists to be
 * trusted by ear:
 *
 *   - The tens digit 2 is ยี่สิบ, never สองสิบ.
 *   - The units digit 1 is เอ็ด, never หนึ่ง, whenever the number has more
 *     than one digit (11 is สิบเอ็ด; 1 alone is หนึ่ง).
 *
 * Deliberately separate from `say.count` in `src/i18n/messages.ts`, which
 * stays `'{n}'` — FR-11.12 keeps on-screen numerals as Arabic digits (the log
 * and settlement are documents two parties check by hand); only the spoken
 * string is spelled out.
 *
 * No import from react/react-native/expo, same rule as the rest of `src/core`.
 */

const DIGIT: readonly string[] = [
  'ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า',
];

/** Index = place value (0 = units). Units and tens are handled as special
 * cases below, so index 0 and 1 here are never read. */
const PLACE: readonly string[] = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

const MAX_SUPPORTED = 999_999;

export function thaiNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`thaiNumber: expected a non-negative integer, got ${n}`);
  }
  if (n > MAX_SUPPORTED) {
    throw new RangeError(`thaiNumber: ${n} is beyond the supported range (0–${MAX_SUPPORTED})`);
  }
  if (n === 0) return DIGIT[0];

  const digits = String(n).split('').map(Number);
  const last = digits.length - 1;

  return digits
    .map((d, i) => {
      if (d === 0) return '';
      const place = last - i;
      if (place === 0) return d === 1 && n > 9 ? 'เอ็ด' : DIGIT[d];
      if (place === 1) return d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : `${DIGIT[d]}สิบ`;
      return `${DIGIT[d]}${PLACE[place]}`;
    })
    .join('');
}
