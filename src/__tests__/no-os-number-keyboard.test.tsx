/**
 * E01-S20 NP-2: no numeric field in the v2 app opens the phone's own keyboard.
 * Every number is typed on the app's NumberPad (MoneyField / QuantityField).
 * A source scan, so a new screen cannot bring the OS number keyboard back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['src/v2', 'src/app/v2'];
const NUMERIC = /keyboardType=\{?\s*["'`]?(?:numeric|number-pad|decimal-pad|phone-pad)|inputMode=\{?\s*["'`]?(?:numeric|decimal|tel)/;

/**
 * Not switched yet, each with its reason (remove the line when it is):
 * - debt screens: wait for E06-S08 to merge (story rows 9–11);
 * - the counter's short-basket typing: its own last PR (story row 21, Q1).
 */
const PENDING = new Set(['src/v2/money/debt-forms.tsx', 'src/v2/money/debts-screens.tsx', 'src/v2/sale/short-reading.tsx']);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });

describe('no OS number keyboard (E01-S20 NP-2)', () => {
  const all = DIRS.flatMap((d) => files(join(ROOT, d))).map((p) => relative(ROOT, p));

  it('the pattern catches every way of writing it (review N5)', () => {
    for (const src of ['keyboardType="decimal-pad"', "keyboardType='numeric'", "keyboardType={'number-pad'}", 'keyboardType={"phone-pad"}', 'inputMode="decimal"', 'inputMode={"numeric"}', "inputMode={ 'tel' }"]) {
      expect(NUMERIC.test(src)).toBe(true);
    }
    for (const src of ['keyboardType="default"', 'inputMode="text"', 'keyboardType="email-address"']) expect(NUMERIC.test(src)).toBe(false);
  });

  it('finds the app screens', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it('no screen asks for a numeric keyboard', () => {
    const offenders = all.filter((f) => !PENDING.has(f) && NUMERIC.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('every pending file is still pending (drop it from the list once switched)', () => {
    for (const f of PENDING) expect(NUMERIC.test(readFileSync(join(ROOT, f), 'utf8'))).toBe(true);
  });
});
