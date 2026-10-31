/**
 * Local git hooks (see .githooks/ and docs/process.md "Local checks").
 *
 *   node scripts/local-checks.mjs commit-msg <file>   Conventional Commits, subject <= 50
 *   node scripts/local-checks.mjs pre-commit          eslint on staged files (+ tokens:check)
 *   node scripts/local-checks.mjs pre-push            commit lint of origin/dev..HEAD + typecheck
 *
 * These only catch early what CI would catch later; CI stays the authority.
 * The rules are the ones CI runs (conventional.mjs, ci-changes.mjs), not copies.
 * Skip all of them for one command with SKIP_LOCAL_CHECKS=1.
 *
 * No dependencies on purpose (same reason as conventional.mjs).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { lintCommit } from './conventional.mjs';
import { needsVerify } from './ci-changes.mjs';

const LINTABLE = /\.(?:[cm]?[jt]sx?)$/;
const ZEROS = /^0+$/;

export function commitMessageErrors(text) {
  const lines = text.split('\n').filter((l) => !l.startsWith('#'));
  const subject = (lines.find((l) => l.trim() !== '') ?? '').trim();
  if (!subject) return ['empty commit message'];
  const body = lines.slice(lines.indexOf(subject) + 1).join('\n').trim();
  return lintCommit({ subject, body });
}

export const eslintTargets = (files) => files.filter((f) => LINTABLE.test(f));

export const tokenCheckNeeded = (files) =>
  files.some((f) => f === 'design/tokens.ts' || f === 'docs/ux/tokens.css');

export const skipRequested = (env) => env.SKIP_LOCAL_CHECKS === '1';

// git feeds pre-push "<local ref> <local sha> <remote ref> <remote sha>" lines;
// a deletion has an all-zero local sha.
export function isDeleteOnlyPush(stdin) {
  const lines = stdin.split('\n').filter(Boolean);
  return lines.length > 0 && lines.every((l) => ZEROS.test(l.split(' ')[1] ?? ''));
}

const git = (...args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' });
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }).status ?? 1;

const fail = (hook, what) => {
  console.error(`\n${hook}: ${what}\nFix it, or skip once with SKIP_LOCAL_CHECKS=1 (CI still checks).`);
  process.exit(1);
};

function preCommit() {
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);
  const targets = eslintTargets(staged);
  if (targets.length && run('npx', ['eslint', '--no-warn-ignored', '--max-warnings=0', ...targets]) !== 0) {
    fail('pre-commit', 'eslint failed on staged files');
  }
  if (tokenCheckNeeded(staged) && run('npm', ['run', '--silent', 'tokens:check']) !== 0) {
    fail('pre-commit', 'tokens:check failed (run `npm run tokens`)');
  }
}

function prePush() {
  if (isDeleteOnlyPush(readFileSync(0, 'utf8'))) return;
  try {
    git('rev-parse', '--verify', '--quiet', 'origin/dev');
  } catch {
    console.error('pre-push: origin/dev not found, skipping local checks (CI still runs).');
    return;
  }
  if (run('node', ['scripts/release.mjs', 'lint', 'origin/dev..HEAD']) !== 0) {
    fail('pre-push', 'commit messages in origin/dev..HEAD break the rules');
  }
  const files = git('diff', '--no-renames', '--name-only', 'origin/dev...HEAD').split('\n').filter(Boolean);
  if (!needsVerify(files)) return;
  if (run('npm', ['run', '--silent', 'typecheck']) !== 0) fail('pre-push', 'typecheck failed');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [hook, arg] = process.argv.slice(2);
  if (skipRequested(process.env)) {
    console.error(`${hook}: skipped (SKIP_LOCAL_CHECKS=1)`);
    process.exit(0);
  }
  if (hook === 'commit-msg') {
    const errors = commitMessageErrors(readFileSync(arg, 'utf8'));
    errors.forEach((e) => console.error(`commit-msg: ${e}`));
    if (errors.length) fail('commit-msg', 'message rejected');
  } else if (hook === 'pre-commit') preCommit();
  else if (hook === 'pre-push') prePush();
  else {
    console.error('usage: local-checks.mjs commit-msg <file> | pre-commit | pre-push');
    process.exit(2);
  }
}
