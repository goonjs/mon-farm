/**
 * Serves the exported web build for Playwright.
 *
 * Deliberately a static server over `dist/`, not `expo start`. A dev server
 * never exits, races the HMR websocket, and turns a bundling failure into a
 * blank white screenshot; the export terminates and fails loudly before a
 * browser ever opens.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    // Block traversal: resolve, then confirm the result is still inside dist/.
    let path = join(ROOT, normalize(url));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    if (url.endsWith('/')) path = join(path, 'index.html');

    let body;
    try {
      body = await readFile(path);
    } catch {
      // expo-router static export writes a file per route; fall back to the
      // route's .html sibling before giving up.
      body = await readFile(path + '.html');
      path += '.html';
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, () => console.log(`serving dist/ on http://127.0.0.1:${PORT}`));
