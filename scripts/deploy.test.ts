import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const script = join(root, 'scripts', 'deploy.sh');

let work: string;
let log: string;

// A throwaway repo root with a fake `firebase` that records its argv, so the
// script is exercised end to end without ever touching Google.
function setup({ dist = true, firebaseExit = 0 } = {}) {
  work = mkdtempSync(join(tmpdir(), 'deploy-'));
  log = join(work, 'firebase.log');
  if (dist) {
    mkdirSync(join(work, 'dist'));
    writeFileSync(join(work, 'dist', 'index.html'), '<html></html>');
  }
  const bin = join(work, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'firebase'),
    `#!/usr/bin/env bash\necho "$@" >> "${log}"\nexit ${firebaseExit}\n`,
  );
  chmodSync(join(bin, 'firebase'), 0o755);
  return bin;
}

function run(args: string[], env: Record<string, string> = {}) {
  const bin = join(work, 'bin');
  return spawnSync('bash', [script, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: work, ...env },
  });
}

describe('deploy.sh', () => {
  beforeEach(() => {
    setup();
  });

  it('deploys dev to the dev hosting target', () => {
    const r = run(['dev']);
    expect(r.status).toBe(0);
    expect(readFileSync(log, 'utf8')).toMatch(/deploy --only hosting:dev/);
  });

  it('deploys prod to the prod hosting target', () => {
    const r = run(['prod']);
    expect(r.status).toBe(0);
    expect(readFileSync(log, 'utf8')).toMatch(/deploy --only hosting:prod/);
  });

  it('rejects a missing or unknown environment without deploying', () => {
    expect(run([]).status).not.toBe(0);
    expect(run(['staging']).status).not.toBe(0);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('fails closed when dist/ was not built', () => {
    setup({ dist: false });
    const r = run(['prod']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/dist/);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('fails non-zero when firebase fails', () => {
    setup({ firebaseExit: 3 });
    expect(run(['prod']).status).not.toBe(0);
  });

  it('in CI, refuses to deploy without a service credential', () => {
    const r = run(['prod'], { CI: 'true' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('in CI, deploys when a service credential is present', () => {
    const r = run(['dev'], { CI: 'true', GOOGLE_APPLICATION_CREDENTIALS: '/dev/null' });
    expect(r.status).toBe(0);
  });
});

describe('deploy.sh preview', () => {
  beforeEach(() => {
    setup();
  });

  it('deploys a named preview channel on the dev site, expiring in 7 days', () => {
    const r = run(['preview', 'pr-12']);
    expect(r.status).toBe(0);
    expect(readFileSync(log, 'utf8')).toMatch(/hosting:channel:deploy pr-12 --only dev --expires 7d/);
  });

  it('requires a safe channel name', () => {
    expect(run(['preview']).status).not.toBe(0);
    expect(run(['preview', 'bad name;rm']).status).not.toBe(0);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });
});

describe('firebase config', () => {
  const firebase = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
  const rc = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8'));
  const sites: any[] = firebase.hosting;

  it('maps dev and prod targets to separate sites', () => {
    const targets = Object.values(rc.targets)[0] as any;
    expect(targets.hosting.dev).toEqual(['mon-farm-dev']);
    expect(targets.hosting.prod).toEqual(['mon-farm-prod']);
    expect(sites.map((s) => s.target).sort()).toEqual(['dev', 'prod']);
  });

  it.each(['dev', 'prod'])('%s serves dist/ as an SPA', (t) => {
    const site = sites.find((s) => s.target === t);
    expect(site.public).toBe('dist');
    expect(site.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
  });

  it.each(['dev', 'prod'])('%s caches hashed assets long and index.html short', (t) => {
    const site = sites.find((s) => s.target === t);
    const cc = (src: string) =>
      site.headers.find((h: any) => h.source === src)?.headers.find((h: any) => h.key === 'Cache-Control')?.value;
    expect(cc('/_expo/static/**')).toMatch(/max-age=31536000.*immutable/);
    expect(cc('/index.html')).toMatch(/no-cache|max-age=0/);
  });
});
