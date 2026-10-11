/**
 * Decides whether a change needs the verify/e2e jobs (E01-S05).
 *
 *   node scripts/ci-changes.mjs <base> <head>   prints `code=true|false`
 *
 * Stdout is `KEY=value` lines (`code`, `rules`) so CI can append them to
 * $GITHUB_OUTPUT. Any
 * doubt -- an unreadable range, a first push whose base is all zeros, an
 * empty diff -- answers `code=true`: a wasted run is cheaper than a skipped
 * gate.
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Generated from design/tokens.ts and compared by tokens:check, so it is code
// even though it lives under docs/.
const CODE_UNDER_DOCS = new Set(['docs/ux/tokens.css']);

const isDoc = (path) =>
  !CODE_UNDER_DOCS.has(path) && (path.startsWith('docs/') || path.endsWith('.md'));

export const needsVerify = (files) => files.length === 0 || !files.every(isDoc);

// Files whose change can alter the outcome of the Firestore rules tests: the
// rules, indexes and tests themselves, the emulator config, and anything that
// moves firebase-tools or the runner recipe. Exact paths, no substring match.
const RULES_FILES = new Set([
  'firestore.rules',
  'firestore.indexes.json',
  'firebase.json',
  'vitest.rules.config.ts',
  'package.json',
  'package-lock.json',
  '.github/workflows/ci.yml',
]);

export const needsRulesTests = (files) =>
  files.length === 0 || files.some((f) => RULES_FILES.has(f) || f.startsWith('firestore/'));

// --no-renames: a rename otherwise lists only its new path, so moving code
// into docs/ would look docs-only. quotePath=false: Thai doc names stay plain.
export const diffArgs = (base, head) => [
  '-c', 'core.quotePath=false', 'diff', '--no-renames', '--name-only', `${base}...${head}`,
];

function changedFiles(base, head) {
  try {
    const out = execFileSync('git', diffArgs(base, head), { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head] = process.argv.slice(2);
  const files = base && head ? changedFiles(base, head) : [];
  console.log(`code=${needsVerify(files)}`);
  console.log(`rules=${needsRulesTests(files)}`);
}
