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

// Same subject as CI's `git log --format=%s`: the first paragraph, lines joined
// by spaces. Only git's own editor template (and the `commit -v` diff after the
// scissors line) is cut; a "#" line from `-m` is real text, as it is for CI.
const TEMPLATE_START = /^# (?:Please enter the commit message|-{10,} >8 -{10,})/m;

export function commitMessageErrors(text) {
  const cut = text.search(TEMPLATE_START);
  const lines = (cut === -1 ? text : text.slice(0, cut)).replace(/\r\n/g, '\n').trim().split('\n');
  const blank = lines.findIndex((l) => l.trim() === '');
  const subject = (blank === -1 ? lines : lines.slice(0, blank)).map((l) => l.trim()).join(' ');
  if (!subject) return ['empty commit message'];
  const body = blank === -1 ? '' : lines.slice(blank + 1).join('\n').trim();
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

// Branch pushes only (deletes and tags carry nothing to check): the local sha
// being pushed and the branch it goes to.
export function pushedBranches(stdin) {
  return stdin
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(' '))
    .filter(([, sha, remote]) => sha && !ZEROS.test(sha) && remote?.startsWith('refs/heads/'))
    .map(([, sha, remote]) => ({ sha, branch: remote.slice('refs/heads/'.length) }));
}

const git = (...args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' });
// No shell: a path with a space stays one argument. On Windows npm/npx are .cmd shims.
const bin = (cmd) => (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx') ? `${cmd}.cmd` : cmd);
const run = (cmd, args) => spawnSync(bin(cmd), args, { stdio: 'inherit' }).status ?? 1;

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
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    // unreadable stdin (some Windows pipes): treat as a normal push
  }
  if (isDeleteOnlyPush(stdin)) return;
  const pushed = pushedBranches(stdin);
  if (stdin && pushed.length === 0) return; // tags only
  // A hotfix branch is cut from main; everything else from dev (process.md).
  const heads = pushed.length ? pushed : [{ sha: 'HEAD', branch: '' }];
  let needsTypecheck = false;
  for (const { sha, branch } of heads) {
    const base = branch.startsWith('hotfix/') ? 'origin/main' : 'origin/dev';
    try {
      git('rev-parse', '--verify', '--quiet', base);
    } catch {
      console.error(`pre-push: ${base} not found, skipping local checks (CI still runs).`);
      continue;
    }
    if (run('node', ['scripts/release.mjs', 'lint', `${base}..${sha}`]) !== 0) {
      fail('pre-push', `commit messages in ${base}..${branch || sha} break the rules`);
    }
    try {
      const files = git('diff', '--no-renames', '--name-only', `${base}...${sha}`).split('\n').filter(Boolean);
      needsTypecheck ||= needsVerify(files);
    } catch {
      needsTypecheck = true; // no merge base (shallow clone): any doubt means check, like CI
    }
  }
  if (needsTypecheck && run('npm', ['run', '--silent', 'typecheck']) !== 0) fail('pre-push', 'typecheck failed');
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
