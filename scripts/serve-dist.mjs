/**
 * Serves the exported web build for Playwright.
 *
 * Deliberately a static server over `dist/`, not `expo start`. A dev server
 * never exits, races the HMR websocket, and turns a bundling failure into a
 * blank white screenshot; the export terminates and fails loudly before a
 * browser ever opens.
 *
 * ── Dynamic routes ───────────────────────────────────────────────────────────
 *
 * `expo export --platform web` with static output writes ONE file per route
 * definition, not one per possible value — `/sale/[id]/counter` becomes the
 * literal file `dist/sale/[id]/counter.html`, brackets and all. A real static
 * host (Vercel, Netlify, an S3+CloudFront rewrite rule) resolves an incoming
 * request like `/sale/abc123/counter` against that pattern at request time;
 * this server has to do the same thing, or every dynamic route 404s and every
 * e2e test that seeds a fresh sale id times out waiting for a page that never
 * loaded. This bit exactly once — worth the paragraph.
 *
 * The routes are discovered once at startup by walking `dist/` for `.html`
 * files and turning each disk path into a matcher: a literal segment matches
 * itself, a `[name]` segment matches anything.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, relative } from 'node:path';

// DIST_DIR lets the server's own test point it at a fixture folder.
const ROOT = process.env.DIST_DIR ? join(process.env.DIST_DIR, '/') : new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** Every `.html` file under `dist/`, as `/route/segments` (no extension). */
function findHtmlRoutes(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...findHtmlRoutes(full, `${base}/${entry}`));
    } else if (entry.endsWith('.html')) {
      out.push(`${base}/${entry.slice(0, -'.html'.length)}`);
    }
  }
  return out;
}

/** A route pattern's segments, `[name]` marked as a wildcard. */
function toMatcher(routePath) {
  const segments = routePath.split('/').filter(Boolean);
  return {
    segments,
    file: join(ROOT, routePath.slice(1) + '.html'),
  };
}

const routes = findHtmlRoutes(ROOT).map(toMatcher);

/** First route whose segments match the request path, literal or `[wildcard]`. */
function resolveDynamic(urlPath) {
  const reqSegments = urlPath.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.segments.length !== reqSegments.length) continue;
    const isMatch = route.segments.every(
      (seg, i) => seg.startsWith('[') || seg === reqSegments[i],
    );
    if (isMatch) return route.file;
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    // Block traversal: resolve, then confirm the result is still inside dist/.
    let path = join(ROOT, normalize(url));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    if (url.endsWith('/')) path = join(path, 'index.html');

    // The path itself, its literal `.html` sibling (static routes), or a
    // folder's index without the trailing slash (`/v2` → v2/index.html, which
    // Firebase Hosting answers by redirecting to `/v2/`).
    let body;
    for (const candidate of [path, path + '.html', join(path, 'index.html')]) {
      try {
        body = await readFile(candidate);
        path = candidate;
        break;
      } catch {
        // next candidate
      }
    }
    if (body === undefined) {
      // A dynamic route ([id], etc) — match by pattern instead of by path.
      const matched = resolveDynamic(url);
      if (!matched) throw new Error('no route matched');
      body = await readFile(matched);
      path = matched;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // The app's own +not-found page (it sends old v1 links to /v2), as a 404.
    try {
      const page = await readFile(join(ROOT, '+not-found.html'));
      res.writeHead(404, { 'content-type': TYPES['.html'] }).end(page);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  }
}).listen(PORT, () =>
  console.log(
    `serving dist/ on http://127.0.0.1:${PORT} (${routes.length} route${routes.length === 1 ? '' : 's'}: ` +
      `${routes.map((r) => '/' + relative(ROOT, r.file).replace(/\.html$/, '')).join(', ')})`,
  ),
);
