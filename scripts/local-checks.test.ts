import { describe, expect, it } from 'vitest';
import {
  commitMessageErrors,
  eslintTargets,
  isDeleteOnlyPush,
  pushedBranches,
  skipRequested,
  tokenCheckNeeded,
} from './local-checks.mjs';

describe('commitMessageErrors', () => {
  it('accepts a valid message with body and git comment lines', () => {
    const msg = 'fix: stop double tap on hold\n\nwhy it happened\n# Please enter the commit message\n';
    expect(commitMessageErrors(msg)).toEqual([]);
  });
  it('rejects the 51-character subject that CI caught', () => {
    const subject = 'chore: ' + 'x'.repeat(44);
    expect(subject.length).toBe(51);
    expect(commitMessageErrors(subject + '\n').join()).toMatch(/51 chars, max 50/);
  });
  it('rejects a non-conventional subject', () => {
    expect(commitMessageErrors('Fix stuff\n').length).toBe(1);
  });
  it('lets merge commits through, like CI', () => {
    expect(commitMessageErrors("Merge branch 'dev' into chore/x\n")).toEqual([]);
  });
  it('rejects an empty message (only the git template)', () => {
    expect(commitMessageErrors('\n# Please enter the commit message for your changes.\n').length).toBe(1);
  });
  it('ignores the editor template and the commit -v diff', () => {
    expect(commitMessageErrors('feat: add thing\n\n# ------------------------ >8 ------------------------\ndiff --git a b\n')).toEqual([]);
  });
  it('keeps a # line that came from -m, like CI does', () => {
    expect(commitMessageErrors('# x\n\nfeat: a\n').length).toBe(1);
  });
  it('joins the first paragraph like git %s, so CI and local agree', () => {
    expect(commitMessageErrors('feat: ' + 'a'.repeat(30) + '\n' + 'b'.repeat(30) + '\n').join()).toMatch(/max 50/);
  });
  it('rejects an uppercase description', () => {
    expect(commitMessageErrors('feat: Add thing\n').length).toBe(1);
  });
});

describe('eslintTargets', () => {
  it('keeps lintable source files only', () => {
    expect(
      eslintTargets(['src/a.ts', 'src/b.tsx', 'scripts/c.mjs', 'x.js', 'README.md', 'a.json', 'img.png']),
    ).toEqual(['src/a.ts', 'src/b.tsx', 'scripts/c.mjs', 'x.js']);
  });
  it('returns nothing for a docs-only commit', () => {
    expect(eslintTargets(['docs/prd.md', 'docs/x.html'])).toEqual([]);
  });
});

describe('tokenCheckNeeded', () => {
  it('fires on the token source and generated css', () => {
    expect(tokenCheckNeeded(['design/tokens.ts'])).toBe(true);
    expect(tokenCheckNeeded(['docs/ux/tokens.css'])).toBe(true);
  });
  it('does not fire otherwise', () => {
    expect(tokenCheckNeeded(['src/a.ts'])).toBe(false);
  });
});

describe('skipRequested', () => {
  it('needs the explicit env var set to 1', () => {
    expect(skipRequested({ SKIP_LOCAL_CHECKS: '1' })).toBe(true);
    expect(skipRequested({ SKIP_LOCAL_CHECKS: '0' })).toBe(false);
    expect(skipRequested({})).toBe(false);
  });
});

describe('isDeleteOnlyPush', () => {
  const zero = '0'.repeat(40);
  const sha = 'a'.repeat(40);
  it('is true when every ref line deletes', () => {
    expect(isDeleteOnlyPush(`(delete) ${zero} refs/heads/x ${sha}\n`)).toBe(true);
  });
  it('is false for a normal push or empty input', () => {
    expect(isDeleteOnlyPush(`refs/heads/x ${sha} refs/heads/x ${zero}\n`)).toBe(false);
    expect(isDeleteOnlyPush('')).toBe(false);
  });
});

describe('pushedBranches', () => {
  const sha = 'a'.repeat(40);
  const zero = '0'.repeat(40);
  it('returns local sha and target branch of each branch push', () => {
    expect(pushedBranches(`refs/heads/x ${sha} refs/heads/chore/x ${zero}\n`)).toEqual([
      { sha, branch: 'chore/x' },
    ]);
  });
  it('ignores deletes and tags', () => {
    const input = `(delete) ${zero} refs/heads/y ${sha}\nrefs/tags/v1 ${sha} refs/tags/v1 ${zero}\n`;
    expect(pushedBranches(input)).toEqual([]);
  });
});
