import { describe, expect, it } from 'vitest';
import { needsVerify } from './ci-changes.mjs';

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
