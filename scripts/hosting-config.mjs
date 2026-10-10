/**
 * Writes `firebase.deploy.json`: the committed firebase.json plus one Hosting
 * rewrite per dynamic route in `dist/`. `deploy.sh` runs this right before
 * deploying and points firebase-tools at the result.
 *
 * Why: `expo export` writes one page per route definition, so `/sale/[id]/counter`
 * is the literal file `dist/sale/[id]/counter.html`. `cleanUrls` lets Hosting
 * serve static routes from their own page, but it cannot match `/sale/abc/counter`
 * to a file with brackets in its name. Without a rewrite that request falls
 * through to the fallback page, which renders a different route first and then
 * fails to hydrate (React #418). The routes come from the build, not a
 * hand-kept list, so a new screen can never be forgotten.
 *
 * Rewrites only apply when no file matches, and the first matching rewrite
 * wins. So the generated ones go before the `** → /+not-found.html` fallback, in
 * the order expo-router itself resolves routes.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const isParam = (segment) => /^\[.+\]$/.test(segment);

/** `[...rest]` matches any depth, `[id]` one segment, anything else itself. */
const toGlob = (segment) => (/^\[\.\.\..+\]$/.test(segment) ? '**' : isParam(segment) ? '*' : segment);

/** expo-router's precedence per segment: literal, then `[param]`, then `[...rest]`. */
const rank = (segment) => (/^\[\.\.\./.test(segment) ? 2 : isParam(segment) ? 1 : 0);

/** The route expo-router would pick first sorts first; depth, then name, break ties. */
function byPrecedence(a, b) {
  for (let i = 0; i < Math.min(a.segments.length, b.segments.length); i++) {
    const d = rank(a.segments[i]) - rank(b.segments[i]);
    if (d) return d;
  }
  return b.segments.length - a.segments.length || a.destination.localeCompare(b.destination);
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return entry.endsWith('.html') ? [full] : [];
  });
}

/** One `{ source, destination }` rewrite per page whose route has a parameter. */
export function dynamicRewrites(distDir) {
  return htmlFiles(distDir)
    .map((file) => relative(distDir, file).split(sep))
    .map((parts) => {
      const segments = [...parts.slice(0, -1), parts.at(-1).slice(0, -'.html'.length)];
      // `sale/[id]/index.html` is the page for `/sale/[id]`.
      if (segments.at(-1) === 'index') segments.pop();
      return { segments, destination: '/' + parts.join('/') };
    })
    .filter(({ segments }) => segments.some(isParam))
    .sort(byPrecedence)
    .map(({ segments, destination }) => ({ source: '/' + segments.map(toGlob).join('/'), destination }));
}

/** firebase.json with the generated rewrites ahead of each target's own. */
export function deployConfig(config, distDir) {
  const rewrites = dynamicRewrites(distDir);
  return {
    ...config,
    hosting: config.hosting.map((h) => ({ ...h, rewrites: [...rewrites, ...(h.rewrites ?? [])] })),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const out = deployConfig(config, 'dist');
  writeFileSync('firebase.deploy.json', JSON.stringify(out, null, 2) + '\n');
  const n = out.hosting[0].rewrites.length - (config.hosting[0].rewrites ?? []).length;
  console.log(`firebase.deploy.json: ${n} dynamic route rewrite${n === 1 ? '' : 's'} from dist/`);
}
