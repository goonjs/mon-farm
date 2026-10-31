import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * E01-S19 DS-1: device settings go through `src/store/device-settings`, never
 * `localStorage` directly — React Native has no `localStorage`, so a direct
 * call silently forgets the setting on Android. Allowed: the module itself,
 * the web data stores (`src/store/*.web.ts`, their storage is web-only by
 * design) and tests. Comments are stripped first; only code counts.
 */
const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

function allowed(rel: string): boolean {
  return (
    /\.test\.tsx?$/.test(rel) ||
    rel.startsWith('__tests__/') ||
    /^store\/[^/]+\.web\.ts$/.test(rel) ||
    /^store\/device-settings(\.(web|native))?\.ts$/.test(rel)
  );
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('no direct localStorage outside the device-settings module (DS-1)', () => {
  it('finds none', () => {
    const offenders = files(SRC)
      .map((p) => relative(SRC, p).split('\\').join('/'))
      .filter((rel) => !allowed(rel))
      .filter((rel) => /\blocalStorage\b/.test(stripComments(readFileSync(join(SRC, rel), 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
