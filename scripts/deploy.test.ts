import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const script = join(root, 'scripts', 'deploy.sh');

let work: string;
let log: string;

// A throwaway repo root with a fake `firebase` that records its argv, so the
// script is exercised end to end without ever touching Google.
function setup({ dist = true, firebaseExit = 0, firebaseOut = '' } = {}) {
  work = mkdtempSync(join(tmpdir(), 'deploy-'));
  log = join(work, 'firebase.log');
  if (dist) {
    mkdirSync(join(work, 'dist', 'sale', '[id]'), { recursive: true });
    writeFileSync(join(work, 'dist', 'index.html'), '<html></html>');
    writeFileSync(join(work, 'dist', 'sale', '[id]', 'counter.html'), '<html></html>');
  }
  writeFileSync(join(work, 'firebase.json'), readFileSync(join(root, 'firebase.json')));
  const bin = join(work, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'firebase'),
    `#!/usr/bin/env bash\necho "$@" >> "${log}"\ncat <<'OUT'\n${firebaseOut}\nOUT\nexit ${firebaseExit}\n`,
  );
  chmodSync(join(bin, 'firebase'), 0o755);
  return bin;
}

function run(args: string[], env: Record<string, string> = {}) {
  const bin = join(work, 'bin');
  return spawnSync('bash', [script, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: work, ...env } as unknown as NodeJS.ProcessEnv,
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

  it('deploys with a config that routes each dynamic page before the SPA fallback', () => {
    const r = run(['prod']);
    expect(r.status).toBe(0);
    expect(readFileSync(log, 'utf8')).toMatch(/--config firebase\.deploy\.json/);
    const deployed = JSON.parse(readFileSync(join(work, 'firebase.deploy.json'), 'utf8'));
    for (const site of deployed.hosting) {
      expect(site.rewrites).toEqual([
        { source: '/sale/*/counter', destination: '/sale/[id]/counter.html' },
        { source: '**', destination: '/index.html' },
      ]);
    }
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

describe('deploy.sh preview-delete', () => {
  const channels = (...names: string[]) =>
    JSON.stringify({
      status: 'success',
      result: {
        channels: names.map((n) => ({ name: `projects/1/sites/mon-farm-dev/channels/${n}` })),
      },
    });

  it('deletes an existing channel from the dev site', () => {
    setup({ dist: false, firebaseOut: channels('live', 'pr-12') });
    const r = run(['preview-delete', 'pr-12']);
    expect(r.status).toBe(0);
    const calls = readFileSync(log, 'utf8');
    expect(calls).toMatch(/hosting:channel:list --site mon-farm-dev --json/);
    expect(calls).toMatch(/hosting:channel:delete pr-12 --site mon-farm-dev --force/);
  });

  // Docs-only PRs never get a channel, and Firebase may already have expired
  // it: closing such a PR must not go red.
  it('succeeds without deleting when the channel does not exist', () => {
    setup({ dist: false, firebaseOut: channels('live', 'pr-120') });
    const r = run(['preview-delete', 'pr-12']);
    expect(r.status).toBe(0);
    expect(readFileSync(log, 'utf8')).not.toMatch(/channel:delete/);
  });

  it('never deletes the live channel', () => {
    setup({ dist: false, firebaseOut: channels('live') });
    expect(run(['preview-delete', 'live']).status).not.toBe(0);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('requires a safe channel name', () => {
    setup({ dist: false });
    expect(run(['preview-delete']).status).not.toBe(0);
    expect(run(['preview-delete', 'x;rm -rf']).status).not.toBe(0);
    expect(() => readFileSync(log, 'utf8')).toThrow();
  });

  it('fails when the channel list cannot be read', () => {
    setup({ dist: false, firebaseExit: 1 });
    expect(run(['preview-delete', 'pr-12']).status).not.toBe(0);
  });

  it('in CI, refuses without a service credential', () => {
    setup({ dist: false, firebaseOut: channels('pr-12') });
    expect(run(['preview-delete', 'pr-12'], { CI: 'true' }).status).not.toBe(0);
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

  // preview-delete has to name the site (channel commands take no target).
  it('deploy.sh deletes previews on the site the dev target maps to', () => {
    const targets = Object.values(rc.targets)[0] as any;
    expect(readFileSync(script, 'utf8')).toContain(`dev_site=${targets.hosting.dev[0]}`);
  });

  it.each(['dev', 'prod'])('%s serves dist/ as an SPA', (t) => {
    const site = sites.find((s) => s.target === t);
    expect(site.public).toBe('dist');
    expect(site.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
  });

  it.each(['dev', 'prod'])('%s caches hashed assets long and every page short', (t) => {
    const site = sites.find((s) => s.target === t);
    const cc = (src: string) =>
      site.headers.find((h: any) => h.source === src)?.headers.find((h: any) => h.key === 'Cache-Control')?.value;
    expect(cc('/_expo/static/**')).toMatch(/max-age=31536000.*immutable/);
    // A page is the root, a clean URL (no extension) or an .html file.
    for (const page of ['/', '**/!(*.*)', '**/*.html']) expect(cc(page)).toMatch(/no-cache|max-age=0/);
  });
});
