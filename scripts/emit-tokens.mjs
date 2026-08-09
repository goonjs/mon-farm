/**
 * Emits `docs/ux/tokens.css` from `design/tokens.ts`.
 *
 *   node scripts/emit-tokens.mjs           # write
 *   node scripts/emit-tokens.mjs --check   # verify on disk matches, exit 1 if not
 *
 * Node 22 strips TypeScript types natively, so this imports the token source
 * directly — there is no build step and no second copy of the values.
 *
 * CI runs `--check`. A token changed without regenerating turns the pipeline
 * red, which is the entire reason the generated file is safe to rely on.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { tokens } from '../design/tokens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/ux/tokens.css');

/**
 * Unit by token path. Longest matching prefix wins, so a specific path can
 * override its group. Anything unmatched is emitted raw — which is correct for
 * colours, font families, weights, ratios and opacities.
 */
const UNITS = [
  ['space', 'px'],
  ['radius', 'px'],
  ['border', 'px'],
  ['font.size', 'px'],
  ['font.tracking', 'em'],
  ['dial.tickLength', 'px'],
  ['dial.tickLengthMajor', 'px'],
  ['duration', 'ms'],
  ['target', 'px'],
  ['viewport', 'px'],
];

function unitFor(path) {
  let best = '';
  let unit = '';
  for (const [prefix, u] of UNITS) {
    if ((path === prefix || path.startsWith(prefix + '.')) && prefix.length > best.length) {
      best = prefix;
      unit = u;
    }
  }
  return unit;
}

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Walks a nested plain object into `[cssVarName, value]` pairs. */
function flatten(obj, path = [], out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const next = [...path, key];
    if (value && typeof value === 'object') {
      flatten(value, next, out);
    } else {
      const dotted = next.join('.');
      const name = '--' + next.map(kebab).join('-');
      const unit = typeof value === 'number' ? unitFor(dotted) : '';
      // A zero with a unit is still zero, but `0px` reads clearer in devtools
      // than a bare `0` when the neighbouring values carry units.
      out.push([name, `${value}${unit}`]);
    }
  }
  return out;
}

function block(pairs, indent = '  ') {
  const width = Math.max(...pairs.map(([n]) => n.length));
  return pairs.map(([n, v]) => `${indent}${n.padEnd(width)}: ${v};`).join('\n');
}

// Colours are emitted per scheme without their `light.`/`dark.` segment, so the
// same variable name resolves differently depending on the active theme.
const { color, ...rest } = tokens;
const lightColors = flatten(color.light, ['color']);
const darkColors = flatten(color.dark, ['color']);
const structural = flatten(rest);

const css = `/* ============================================================================
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source:    design/tokens.ts
 * Regenerate: node scripts/emit-tokens.mjs
 *
 * CI fails if this file is out of date with its source. Edit the source.
 * ==========================================================================*/

:root {
  color-scheme: light dark;

  /* ---- structural: identical in both themes ---- */
${block(structural)}

  /* ---- colour: light (default — the field mode, see F-15) ---- */
${block(lightColors)}
}

/* Dark is opt-in for evening and indoor weighing at the ล้ง. Two selectors:
   the media query is the signal, the data-theme attribute is the override, and
   the attribute must win in both directions. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${block(darkColors, '    ')}
  }
}

:root[data-theme='dark'] {
${block(darkColors)}
}

:root[data-theme='light'] {
${block(lightColors)}
}
`;

const check = process.argv.includes('--check');

if (check) {
  if (!existsSync(OUT)) {
    console.error(`✗ ${OUT} does not exist. Run: node scripts/emit-tokens.mjs`);
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf8') !== css) {
    console.error(
      `✗ docs/ux/tokens.css is out of date with design/tokens.ts.\n` +
        `  Run: node scripts/emit-tokens.mjs`,
    );
    process.exit(1);
  }
  console.log('✓ tokens.css is up to date');
} else {
  writeFileSync(OUT, css);
  console.log(
    `✓ wrote docs/ux/tokens.css — ` +
      `${lightColors.length} colours × 2 themes, ${structural.length} structural`,
  );
}
