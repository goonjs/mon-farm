import { describe, expect, it } from 'vitest';
import { diffArgs, needsRulesTests, needsVerify } from './ci-changes.mjs';

describe('needsVerify', () => {
  it('skips a change made only of docs and markdown', () => {
    expect(needsVerify(['docs/prd.md', 'docs/ux/mvp-screens.html', 'CLAUDE.md', '.claude/agents/x.md'])).toBe(false);
  });

  it('runs when any code file changed', () => {
    expect(needsVerify(['docs/prd.md', 'src/core/money.ts'])).toBe(true);
  });

  it('runs when the workflow itself changed', () => {
    expect(needsVerify(['.github/workflows/ci.yml'])).toBe(true);
  });

  // tokens:check compares the generated file against design/tokens.ts, so a
  // hand edit there must still reach the verify job.
  it('treats the generated tokens.css under docs as code', () => {
    expect(needsVerify(['docs/ux/tokens.css'])).toBe(true);
  });

  it('only matches markdown by extension, not by name', () => {
    expect(needsVerify(['scripts/md-helper.mjs'])).toBe(true);
    expect(needsVerify(['docsite/index.ts'])).toBe(true);
  });

  // An empty list means the diff could not be read; fail safe and verify.
  it('runs when the changed list is empty', () => {
    expect(needsVerify([])).toBe(true);
  });
});

describe('diffArgs', () => {
  // With rename detection a `git mv src/x.ts docs/x.md` lists only the new,
  // docs-looking path and would skip verify.
  it('lists both sides of a rename', () => {
    expect(diffArgs('a', 'b')).toContain('--no-renames');
  });

  // A quoted "docs/\340..." path would not start with docs/.
  it('prints non-ASCII paths unquoted', () => {
    expect(diffArgs('a', 'b').join(' ')).toContain('core.quotePath=false');
  });

  it('diffs from the merge base', () => {
    expect(diffArgs('a', 'b').at(-1)).toBe('a...b');
  });
});

// The Firestore rules job needs a JDK and the emulator; a PR that cannot have
// changed a rule or the tooling around it should not pay for it.
describe('needsRulesTests', () => {
  it('skips an app-only change', () => {
    expect(needsRulesTests(['src/core/money.ts', 'e2e/counter.spec.ts', 'docs/prd.md'])).toBe(false);
  });

  it('runs when rules, indexes or their tests changed', () => {
    expect(needsRulesTests(['firestore.rules'])).toBe(true);
    expect(needsRulesTests(['firestore.indexes.json'])).toBe(true);
    expect(needsRulesTests(['firestore/rules.test.ts'])).toBe(true);
    expect(needsRulesTests(['vitest.rules.config.ts'])).toBe(true);
    expect(needsRulesTests(['firebase.json'])).toBe(true);
  });

  // A dependency bump can change firebase-tools or the emulator itself.
  it('runs when dependencies or the workflow changed', () => {
    expect(needsRulesTests(['package-lock.json'])).toBe(true);
    expect(needsRulesTests(['package.json'])).toBe(true);
    expect(needsRulesTests(['.github/workflows/ci.yml'])).toBe(true);
  });

  it('runs when the changed list is empty', () => {
    expect(needsRulesTests([])).toBe(true);
  });

  // A path that merely contains the word is not the rules directory.
  it('matches paths exactly, not by substring', () => {
    expect(needsRulesTests(['src/firestore-helpers.ts'])).toBe(false);
  });
});
