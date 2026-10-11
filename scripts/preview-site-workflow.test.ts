import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const text = readFileSync(join(resolve(__dirname, '..'), '.github', 'workflows', 'preview-site.yml'), 'utf8');

describe('preview-site workflow', () => {
  it('runs only when started by hand, with a required pr number', () => {
    expect(text).toMatch(/on:\s+workflow_dispatch:/);
    expect(text).not.toMatch(/pull_request|push:|schedule:/);
    expect(text).toMatch(/inputs:\s+pr:[\s\S]*?required:\s*true/);
  });

  it('queues runs so two picks never deploy at once', () => {
    expect(text).toMatch(/concurrency:\s+group: preview-site\s+cancel-in-progress: false/);
  });

  it('refuses closed and fork PRs and builds the PR head commit', () => {
    expect(text).toMatch(/state/);
    expect(text).toMatch(/head\.repo\.full_name/);
    expect(text).toMatch(/ref: \$\{\{ steps\.pr\.outputs\.sha \}\}/);
  });

  it('builds with the public web config and deploys the preview site', () => {
    expect(text).toContain('EXPO_PUBLIC_FIREBASE_PROJECT_ID: mon-farmmate');
    expect(text).toContain('./scripts/deploy.sh preview-site');
  });
});
