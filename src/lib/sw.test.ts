import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * public/sw.js (E01-S23) run against fake caches and fetch, for what the local e2e server cannot show:
 * Firebase Hosting answers `/v2` with a redirect to `/v2/`, and Chrome refuses a redirected response for a
 * navigation (review of PR 195 B1), so the app opened from its icon offline would not open.
 */
const code = readFileSync(join(resolve(__dirname, '..', '..'), 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://farm.test';
const abs = (u: string) => new URL(u, ORIGIN).href;

type Req = { url: string; method: string; mode: string };
const req = (path: string, mode = 'no-cors'): Req => ({ url: abs(path), method: 'GET', mode });

/** A same-origin ("basic") response; `redirected` as a browser would set it after following a redirect. */
function res(body: string, redirected = false): Response {
  const r = new Response(body, { status: 200 });
  Object.defineProperty(r, 'type', { value: 'basic' });
  Object.defineProperty(r, 'redirected', { value: redirected });
  return r;
}

function load(net: (url: string) => Promise<Response>) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Response>();
  const key = (r: string | Req) => (typeof r === 'string' ? abs(r) : r.url);
  const cache = {
    match: async (r: string | Req) => store.get(key(r))?.clone(),
    put: async (r: string | Req, v: Response) => void store.set(key(r), v),
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (r: string | Req) => store.delete(key(r)),
  };
  const caches = { open: async () => cache, match: cache.match, keys: async () => ['mon-farm-v1'], delete: async () => true };
  const self = { location: new URL('/sw.js', ORIGIN), addEventListener: (t: string, f: (e: unknown) => void) => (handlers[t] = f), skipWaiting: async () => undefined, clients: { claim: async () => undefined } };
  const fetch = (r: string | Req) => net(key(r));
  new Function('self', 'caches', 'fetch', code)(self, caches, fetch);
  const run = async (type: string, extra: object) => {
    const waits: Promise<unknown>[] = [];
    let answer: Promise<Response> | undefined;
    handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => (answer = p) });
    await Promise.all(waits);
    // Wrapped: an async function returning a promise would wait for the answer itself.
    return { answer };
  };
  return { store, run };
}

const offline = async () => {
  throw new TypeError('Failed to fetch');
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('service worker (E01-S23)', () => {
  it('opens at /v2/: the shell it keeps is "/" and "/v2/", never the redirecting "/v2"', async () => {
    const { store, run } = load(async (u) => res(`page ${u}`));
    await run('install', {});
    expect([...store.keys()].sort()).toEqual([abs('/'), abs('/v2/')]);
  });

  it('never keeps a redirected response, so a navigation can always use what it kept (review of PR 195 B1)', async () => {
    const { store, run } = load(async (u) => res(`page ${u}`, true));
    await run('install', {});
    await run('fetch', { request: req('/v2/care', 'navigate') });
    await settle();
    expect(store.size).toBeGreaterThan(0);
    for (const v of store.values()) expect(v.redirected).toBe(false);
  });

  it('offline, a page it never kept opens the home it kept at /v2/', async () => {
    let online = true;
    const { run } = load(async (u) => (online ? res(`page ${u}`) : offline()));
    await run('install', {});
    online = false;
    const { answer } = await run('fetch', { request: req('/v2/stock', 'navigate') });
    expect(await (await answer!).text()).toBe(`page ${abs('/v2/')}`);
  });

  it('keeps what the page hands over, drops bundles of older builds, and survives a bad URL (N1, N4)', async () => {
    const { store, run } = load(async (u) => res(`file ${u}`));
    store.set(abs('/_expo/static/js/web/old-111.js'), res('old'));
    await run('message', { data: { keep: [abs('/_expo/static/js/web/new-222.js'), 'not a url', 'https://elsewhere.test/x.js'] } });
    expect(store.has(abs('/_expo/static/js/web/new-222.js'))).toBe(true);
    expect(store.has(abs('/_expo/static/js/web/old-111.js'))).toBe(false);
    expect(store.has('https://elsewhere.test/x.js')).toBe(false);
  });

  it('on a weak signal, a page it kept opens from the cache after 3.5 s instead of waiting on (N3)', async () => {
    let hang = false;
    const { run } = load((u) => (hang ? new Promise<Response>(() => undefined) : Promise.resolve(res(`page ${u}`))));
    await run('install', {});
    hang = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const answer = (await run('fetch', { request: req('/v2/', 'navigate') })).answer!;
      let done = false;
      void answer.then(() => (done = true));
      await vi.advanceTimersByTimeAsync(3_000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(600);
      expect(await (await answer).text()).toBe(`page ${abs('/v2/')}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a slow page it never kept still waits for the network (nothing better to show)', async () => {
    let finish: (r: Response) => void = () => undefined;
    const { run } = load((u) => (u === abs('/v2/new-page') ? new Promise<Response>((r) => (finish = r)) : Promise.resolve(res(`page ${u}`))));
    await run('install', {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const answer = (await run('fetch', { request: req('/v2/new-page', 'navigate') })).answer!;
      await vi.advanceTimersByTimeAsync(5_000);
      finish(res('fresh'));
      expect(await (await answer).text()).toBe('fresh');
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves Firebase\'s reserved /__/ paths alone (N2)', async () => {
    const { run } = load(async (u) => res(`page ${u}`));
    expect((await run('fetch', { request: req('/__/auth/handler?code=x', 'navigate') })).answer).toBeUndefined();
  });
});
