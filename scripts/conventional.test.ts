import { describe, expect, it } from 'vitest';
import { bumpFor, changelog, lintCommit, nextVersion, parseSubject } from './conventional.mjs';

describe('parseSubject', () => {
  it('parses type, scope and description', () => {
    expect(parseSubject('feat(sale): add basket total')).toEqual({
      type: 'feat', scope: 'sale', breaking: false, description: 'add basket total',
    });
  });
  it('detects the ! breaking marker', () => {
    expect(parseSubject('refactor!: drop v1 log format')?.breaking).toBe(true);
  });
  it('rejects free-form and unknown types', () => {
    expect(parseSubject('Add basket total')).toBeNull();
    expect(parseSubject('wip: stuff')).toBeNull();
    expect(parseSubject('feat:no space')).toBeNull();
  });
});

describe('lintCommit', () => {
  it('accepts a valid commit', () => {
    expect(lintCommit({ subject: 'fix: stop double tap on hold', body: '' })).toEqual([]);
  });
  it('rejects a subject over 50 characters', () => {
    const errs = lintCommit({ subject: 'feat: ' + 'x'.repeat(50), body: '' });
    expect(errs.join()).toMatch(/50/);
  });
  it('rejects non-conventional subjects', () => {
    expect(lintCommit({ subject: 'Fix stuff', body: '' }).length).toBe(1);
  });
  it('skips merge commits', () => {
    expect(lintCommit({ subject: 'Merge branch main into dev', body: '' })).toEqual([]);
  });
  it('rejects an uppercase first letter of the description', () => {
    expect(lintCommit({ subject: 'feat: Add thing', body: '' }).length).toBe(1);
  });
});

describe('bumpFor', () => {
  const c = (subject: string, body = '') => ({ subject, body });
  it('is null with no commits', () => expect(bumpFor([])).toBeNull());
  it('is patch for fix, chore, docs', () => {
    expect(bumpFor([c('fix: a'), c('chore: b')])).toBe('patch');
    expect(bumpFor([c('docs: a')])).toBe('patch');
  });
  it('is minor when any feat is present', () => {
    expect(bumpFor([c('fix: a'), c('feat: b')])).toBe('minor');
  });
  it('is major for ! or a BREAKING CHANGE footer', () => {
    expect(bumpFor([c('feat!: a')])).toBe('major');
    expect(bumpFor([c('fix: a', 'why\n\nBREAKING CHANGE: log format')])).toBe('major');
  });
});

describe('nextVersion', () => {
  it('bumps each level and resets lower ones', () => {
    expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
  });
});

describe('changelog', () => {
  it('groups by type, lists breaking first, omits merge commits', () => {
    const md = changelog('0.2.0', '2026-10-03', [
      { subject: 'feat(sale): add total', body: '' },
      { subject: 'fix: stop double tap', body: '' },
      { subject: 'feat!: new log format', body: '' },
      { subject: 'Merge branch x', body: '' },
    ]);
    expect(md).toMatch(/^## 0\.2\.0 \(2026-10-03\)/);
    expect(md.indexOf('Breaking')).toBeLessThan(md.indexOf('Features'));
    expect(md).toContain('- **sale:** add total');
    expect(md).toContain('### Fixes');
    expect(md).not.toContain('Merge');
  });
});
