/**
 * Verifies every foreground/background pairing the design system actually uses
 * against its required WCAG ratio.
 *
 *   node scripts/check-contrast.mjs           # report
 *   node scripts/check-contrast.mjs --strict  # exit 1 on any failure (CI)
 *
 * This exists because "high contrast" is a claim, and a claim about a palette
 * is checkable. A colour tweak that quietly drops the count below its floor
 * should turn the pipeline red, not ship to a yard in direct sun.
 *
 * Thresholds follow WCAG 2.2:
 *   4.5  normal text (AA)
 *   3.0  large text (AA), and UI component / graphical boundaries (1.4.11)
 *   7.0  normal text (AAA)
 */

import { tokens } from '../design/tokens.ts';

const srgb = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255)
  );
};

const ratio = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/**
 * [foreground, background, required, what it is]
 *
 * `required` is the floor this pairing must clear, chosen per use — not a blanket
 * AAA, which would be dishonest for a divider and pointless for a placeholder.
 */
const PAIRINGS = [
  // The public register. This is the number two parties are trusting; it gets
  // the highest floor in the system and is checked first.
  ['numeral', 'stage', 7, 'THE COUNT — public numeral on stage (AAA)'],

  // Operator register, primary.
  ['ink', 'stage', 7, 'primary text on stage / white screens'],
  ['ink', 'surface', 7, 'operator body text'],
  ['ink', 'surfaceSunk', 7, 'text in wells and inputs'],
  ['ink', 'surfaceRaised', 7, 'text on cards'],

  // Operator register, secondary.
  ['inkSoft', 'surface', 4.5, 'mono labels, secondary text'],
  ['inkSoft', 'stage', 4.5, 'the expected-reading chip'],

  // Signal hues as text.
  ['action', 'stage', 4.5, 'links and controls on stage'],
  ['action', 'surface', 4.5, 'links and controls on panels'],
  ['accept', 'surface', 4.5, 'counted-basket log rows'],
  ['accept', 'acceptSunk', 4.5, 'accept chip'],
  ['reject', 'surface', 4.5, 'rejected/voided log rows'],
  ['reject', 'rejectSunk', 4.5, 'reject chip'],
  ['warn', 'surface', 4.5, 'flag text'],
  ['warn', 'warnSunk', 4.5, 'flag chip'],

  // Signal hues as fills, with inverse text on them.
  ['inkInverse', 'action', 4.5, 'primary button label'],
  ['inkInverse', 'accept', 4.5, 'accept confirmation label'],
  ['inkInverse', 'reject', 4.5, 'destructive button label'],
  ['inkInverse', 'warn', 4.5, 'flag banner label'],

  // Sync status as text (SYNC-3) — always paired with a shape and a word.
  ['statusSynced', 'surface', 4.5, 'synced status text'],
  ['statusPending', 'surface', 4.5, 'pending-sync status text'],
  ['statusConflict', 'surface', 4.5, 'conflict status text'],
  ['statusConflict', 'rejectSunk', 4.5, 'conflict chip'],
  ['statusPending', 'warnSunk', 4.5, 'pending chip'],

  // Text on cards and on the selected-row wash.
  ['inkSoft', 'surfaceRaised', 4.5, 'secondary text on cards'],
  ['inkSoft', 'surfaceSunk', 4.5, 'secondary text in wells'],
  ['ink', 'actionSunk', 7, 'text on selected rows'],
  ['ink', 'warnSunk', 7, 'text on highlight (yellow) cards'],
  ['ink', 'acceptSunk', 7, 'text on green-tint cards'],

  // Non-text: boundaries that define where a control is (WCAG 1.4.11).
  ['ruleStrong', 'surface', 3, 'input and control borders'],
  ['ruleStrong', 'stage', 3, 'the dial track'],
  ['action', 'stage', 3, 'focus ring on stage'],
  ['action', 'surface', 3, 'focus ring on panels'],
  ['accept', 'stage', 3, 'the dial fill against the stage'],
  ['inkInverse', 'brandStrong', 3, 'glyph on a filled brand control (FAB)'],
  ['ruleStrong', 'surfaceRaised', 3, 'control borders on cards'],
];

const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? '3:1' : '—');

let failures = 0;
const strict = process.argv.includes('--strict');

for (const scheme of ['light', 'dark']) {
  const c = tokens.color[scheme];
  console.log(`\n  ${scheme.toUpperCase()}${scheme === 'light' ? '  (default — field mode)' : '  (opt-in)'}`);
  console.log('  ' + '─'.repeat(76));

  for (const [fg, bg, required, what] of PAIRINGS) {
    const r = ratio(c[fg], c[bg]);
    const ok = r >= required;
    if (!ok) failures++;
    const mark = ok ? '✓' : '✗';
    console.log(
      `  ${mark} ${r.toFixed(2).padStart(5)}:1  need ${String(required).padStart(3)}  ` +
        `${grade(r).padEnd(4)} ${what}`,
    );
  }
}

console.log('');
if (failures) {
  console.error(`  ✗ ${failures} pairing(s) below their required ratio.\n`);
  if (strict) process.exit(1);
} else {
  console.log(`  ✓ all ${PAIRINGS.length * 2} pairings clear their required ratio.\n`);
}
