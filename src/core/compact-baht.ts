/**
 * A sale's money total, short enough for a counter card (E04-S05, D-41):
 * at most 3 significant digits + พัน / หมื่น / แสน / ล้าน — 2,450 → "2.45 พัน",
 * 53,350 → "5.34 หมื่น", 134,250 → "1.34 แสน". Under 1,000 it shows in full.
 *
 * Integer satang in, half-up rounding done on integers (5.335 is not exactly
 * representable as a float). A value that rounds up to 10 of a unit moves to
 * the next unit ("1.00 หมื่น", not "10.0 พัน"); above ล้าน the digits grow.
 */

const UNITS: readonly { size: number; name: string }[] = [
  { size: 1_000_000, name: 'ล้าน' },
  { size: 100_000, name: 'แสน' },
  { size: 10_000, name: 'หมื่น' },
  { size: 1_000, name: 'พัน' },
];

/** `num / den` rounded half up, both non-negative integers. */
const roundDiv = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

export function compactBaht(satang: number): string {
  if (satang < 100_000) return satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2);
  let i = UNITS.findIndex((u) => satang >= u.size * 100);
  for (;;) {
    const den = UNITS[i].size * 100;
    const whole = Math.floor(satang / den);
    const decimals = Math.max(0, 3 - String(whole).length);
    const scaled = roundDiv(satang * 10 ** decimals, den);
    // Rounded up to 10 of this unit: say it in the next one up.
    if (i > 0 && scaled >= 10 * 10 ** decimals) {
      i -= 1;
      continue;
    }
    return `${(scaled / 10 ** decimals).toFixed(decimals)} ${UNITS[i].name}`;
  }
}
