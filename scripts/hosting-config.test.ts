import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deployConfig, dynamicRewrites } from './hosting-config.mjs';

const root = resolve(__dirname, '..');

/** A fake `expo export` output: static, folder-index and dynamic routes. */
function fakeDist() {
  const dist = mkdtempSync(join(tmpdir(), 'hosting-dist-'));
  const file = (path: string, body = path) => {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), body);
  };
  file('index.html', 'home');
  file('settings.html', 'settings');
  file('v2/index.html', 'v2 home');
  file('v2/farm.html', 'v2 farm');
  file('v2/[section].html', 'v2 section');
  file('v2/sale/[step].html', 'v2 sale step');
  file('sale/[id]/counter.html', 'counter');
  file('sale/[id]/index.html', 'sale home');
  file('_expo/static/js/web/entry-abc.js', 'js');
  return dist;
}

describe('dynamicRewrites', () => {
  it('maps each dynamic route file to a glob, most literal first', () => {
    expect(dynamicRewrites(fakeDist())).toEqual([
      { source: '/v2/sale/*', destination: '/v2/sale/[step].html' },
      { source: '/sale/*/counter', destination: '/sale/[id]/counter.html' },
      { source: '/sale/*', destination: '/sale/[id]/index.html' },
      { source: '/v2/*', destination: '/v2/[section].html' },
    ]);
  });

  it('orders like expo-router: segment by segment, literal before [param] before [...rest]', () => {
    const dist = mkdtempSync(join(tmpdir(), 'hosting-dist-'));
    for (const page of ['sale/[...rest].html', 'sale/[id].html', '[a]/x.html', 'sale/new.html']) {
      mkdirSync(dirname(join(dist, page)), { recursive: true });
      writeFileSync(join(dist, page), page);
    }
    expect(dynamicRewrites(dist).map((r: { source: string }) => r.source)).toEqual(['/sale/*', '/sale/**', '/*/x']);
  });

  it('turns a catch-all [...rest] into **', () => {
    const dist = mkdtempSync(join(tmpdir(), 'hosting-dist-'));
    mkdirSync(join(dist, 'docs'));
    writeFileSync(join(dist, 'docs', '[...rest].html'), 'docs');
    expect(dynamicRewrites(dist)).toEqual([{ source: '/docs/**', destination: '/docs/[...rest].html' }]);
  });
});

describe('the committed firebase.json', () => {
  const config = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));

  it('serves clean URLs and keeps the SPA fallback last, on every hosting target', () => {
    for (const h of config.hosting) {
      expect(h.cleanUrls).toBe(true);
      expect(h.rewrites.at(-1)).toEqual({ source: '**', destination: '/index.html' });
    }
  });

  it('deployConfig puts the generated rewrites before the fallback, on every target', () => {
    const out = deployConfig(config, fakeDist());
    for (const h of out.hosting) {
      expect(h.rewrites[0]).toEqual({ source: '/v2/sale/*', destination: '/v2/sale/[step].html' });
      expect(h.rewrites.at(-1)).toEqual({ source: '**', destination: '/index.html' });
    }
    expect(out.firestore).toEqual(config.firestore);
  });
});

// Superstatic is the server Firebase Hosting is built on (it also backs the
// hosting emulator), so this checks the real matching rules, not a guess.
describe('served through superstatic', () => {
  let PORT = 0;
  let server: ChildProcess;

  beforeAll(async () => {
    // A port the OS says is free, so a stray server can't answer for us.
    PORT = await new Promise<number>((ok) => {
      const probe = createServer().listen(0, () => {
        const { port } = probe.address() as AddressInfo;
        probe.close(() => ok(port));
      });
    });
    const dist = fakeDist();
    const config = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
    const hosting = deployConfig(config, dist).hosting[0];
    const cfg = join(mkdtempSync(join(tmpdir(), 'hosting-cfg-')), 'superstatic.json');
    writeFileSync(cfg, JSON.stringify({ ...hosting, public: '.' }));
    server = spawn(join(root, 'node_modules/.bin/superstatic'), ['serve', '.', '-p', String(PORT), '-c', cfg], {
      cwd: dist,
      stdio: 'pipe',
    });
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`http://localhost:${PORT}/`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('superstatic did not start');
  });

  afterAll(() => {
    server?.kill();
  });

  const get = async (path: string) => {
    const res = await fetch(`http://localhost:${PORT}${path}`, { redirect: 'manual' });
    return { status: res.status, body: await res.text(), cache: res.headers.get('cache-control'), location: res.headers.get('location') };
  };

  it('a static route gets its own page, not the root page', async () => {
    expect(await get('/settings')).toMatchObject({ status: 200, body: 'settings' });
    expect(await get('/v2/farm')).toMatchObject({ status: 200, body: 'v2 farm' });
  });

  it('a dynamic route gets its own page', async () => {
    expect(await get('/sale/abc/counter')).toMatchObject({ status: 200, body: 'counter' });
    expect(await get('/v2/sale/weigh')).toMatchObject({ status: 200, body: 'v2 sale step' });
    expect(await get('/v2/people')).toMatchObject({ status: 200, body: 'v2 section' });
  });

  it('a folder index works with or without the slash', async () => {
    expect(await get('/v2/')).toMatchObject({ status: 200, body: 'v2 home' });
    const bare = await get('/v2');
    expect(bare.status === 200 ? bare.body : bare.location).toMatch(/v2 home|\/v2\/?$/);
  });

  it('anything else still falls back to the app shell', async () => {
    expect(await get('/no/such/page')).toMatchObject({ status: 200, body: 'home' });
  });

  it('pages are never cached; hashed bundles are cached for good', async () => {
    for (const path of ['/', '/settings', '/v2/', '/sale/abc/counter', '/index.html']) {
      expect((await get(path)).cache, path).toBe('no-cache');
    }
    expect((await get('/_expo/static/js/web/entry-abc.js')).cache).toBe('public, max-age=31536000, immutable');
  });
});
