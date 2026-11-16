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

function load(net: (url: string) => Promise<Response>, opts: { putFails?: boolean } = {}) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Response>();
  const key = (r: string | Req) => (typeof r === 'string' ? abs(r) : r.url);
  const cache = {
    match: async (r: string | Req) => store.get(key(r))?.clone(),
    put: async (r: string | Req, v: Response) => {
      // A phone with full storage refuses the write (QuotaExceededError).
      if (opts.putFails) throw new DOMException('quota', 'QuotaExceededError');
      store.set(key(r), v);
    },
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
    // A navigation's waitUntil can hold a network answer that never comes; only install and message are awaited.
    if (type !== 'fetch') await Promise.all(waits);
    // Wrapped: an async function returning a promise would wait for the answer itself.
    return { answer, waits };
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

  it('keeps what the page hands over and survives a bad URL (N4)', async () => {
    const { store, run } = load(async (u) => res(`file ${u}`));
    await run('message', { data: { keep: [abs('/_expo/static/js/web/new-222.js'), 'not a url', 'https://elsewhere.test/x.js'] } });
    expect(store.has(abs('/_expo/static/js/web/new-222.js'))).toBe(true);
    expect(store.has('https://elsewhere.test/x.js')).toBe(false);
  });

  it('on a weak signal, a page it kept opens from the cache after 30 s instead of waiting on (N3; owner 2026-11-16 "ซัก 30 วินาที")', async () => {
    let hang = false;
    const { run } = load((u) => (hang ? new Promise<Response>(() => undefined) : Promise.resolve(res(`page ${u}`))));
    await run('install', {});
    hang = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const answer = (await run('fetch', { request: req('/v2/', 'navigate') })).answer!;
      let done = false;
      void answer.then(() => (done = true));
      await vi.advanceTimersByTimeAsync(29_000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1_100);
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

  it('after a new build, never drops a bundle that a kept page from the old build still needs (review of PR 195 B2)', async () => {
    const page = (build: string) => `<script src="/_expo/static/js/web/entry-${build}.js" defer></script>`;
    let build = 'A';
    let online = true;
    const { store, run } = load(async (u) => {
      if (!online) return offline();
      if (u.includes('/_expo/static/')) return res(`bundle ${u}`);
      return res(page(build));
    });
    // Build A: the home is opened online and hands over its bundle.
    await run('install', {});
    await run('message', { data: { keep: [abs('/v2/'), abs('/_expo/static/js/web/entry-A.js')] } });
    // Build B is deployed; a deep page is opened online and hands over the new bundle.
    build = 'B';
    await run('fetch', { request: req('/v2/care', 'navigate') });
    await settle();
    await run('message', { data: { keep: [abs('/v2/care'), abs('/_expo/static/js/web/entry-B.js')] } });
    // Offline, the icon opens the kept home from build A: the bundle it names must still be there.
    online = false;
    const { answer } = await run('fetch', { request: req('/v2/', 'navigate') });
    const html = await (await answer!).text();
    expect(html).toContain('entry-A.js');
    expect(store.has(abs('/_expo/static/js/web/entry-A.js'))).toBe(true);
    expect(store.has(abs('/_expo/static/js/web/entry-B.js'))).toBe(true);
  });

  it('never deletes a build file: some kept page may still need it (lead: no pruning, KISS · review of PR 195 F1)', async () => {
    const { store, run } = load(async (u) => res(u.includes('/_expo/static/') ? 'bundle' : '<script src="/_expo/static/js/web/entry-B.js"></script>'));
    await run('install', {});
    store.set(abs('/_expo/static/js/web/entry-old.js'), res('old'));
    await run('message', { data: { keep: [abs('/_expo/static/js/web/entry-B.js')] } });
    expect(store.has(abs('/_expo/static/js/web/entry-old.js'))).toBe(true);
    expect(store.has(abs('/_expo/static/js/web/entry-B.js'))).toBe(true);
  });

  it('a full phone that cannot store the copy still gets the page from the network (review of PR 195 F2)', async () => {
    const { run } = load(async (u) => res(`page ${u}`), { putFails: true });
    await run('install', {});
    const { answer } = await run('fetch', { request: req('/v2/x', 'navigate') });
    const r = await answer!;
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(`page ${abs('/v2/x')}`);
  });

  it('a navigation keeps the worker alive until its network answer is stored (review of PR 195 N3-a)', async () => {
    const { run } = load(async (u) => res(`page ${u}`));
    await run('install', {});
    const { waits } = await run('fetch', { request: req('/v2/', 'navigate') });
    expect(waits.length).toBe(1);
    await waits[0];
  });

  it('leaves Firebase\'s reserved /__/ paths alone (N2)', async () => {
    const { run } = load(async (u) => res(`page ${u}`));
    expect((await run('fetch', { request: req('/__/auth/handler?code=x', 'navigate') })).answer).toBeUndefined();
  });
});
