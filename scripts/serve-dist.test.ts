import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The e2e server should answer like Firebase Hosting does: a folder holding an
// index.html is reachable with or without the trailing slash.
const PORT = 18_765;
let server: ChildProcess;

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'serve-dist-'));
  writeFileSync(join(dist, 'index.html'), 'home');
  writeFileSync(join(dist, 'settings.html'), 'settings');
  mkdirSync(join(dist, 'v2'));
  writeFileSync(join(dist, 'v2', 'index.html'), 'v2 home');
  writeFileSync(join(dist, 'v2', 'farm.html'), 'v2 farm');
  server = spawn(process.execPath, ['scripts/serve-dist.mjs'], {
    env: { ...process.env, PORT: String(PORT), DIST_DIR: dist },
    stdio: 'pipe',
  });
  await new Promise<void>((ok, fail) => {
    server.stdout!.once('data', () => ok());
    server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
});

afterAll(() => {
  server?.kill();
});

const get = async (path: string) => {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return { status: res.status, body: await res.text() };
};

describe('serve-dist', () => {
  it('serves a folder index with and without the trailing slash', async () => {
    expect(await get('/v2/')).toEqual({ status: 200, body: 'v2 home' });
    expect(await get('/v2')).toEqual({ status: 200, body: 'v2 home' });
  });

  it('still serves static routes and 404s the unknown', async () => {
    expect(await get('/settings')).toEqual({ status: 200, body: 'settings' });
    expect(await get('/v2/farm')).toEqual({ status: 200, body: 'v2 farm' });
    expect((await get('/nope')).status).toBe(404);
  });
});
