import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * E01-S23 PW-1: the web app can be installed — a manifest the build serves from `public/`, with the
 * กรีดยาง icon at the two sizes Chrome asks for. The offline reload (PW-2) is checked on the real build
 * in e2e `pwa.spec.ts`.
 */
const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p));
const pngSize = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

describe('web app manifest (E01-S23 PW-1)', () => {
  const m = JSON.parse(read('public/manifest.webmanifest').toString('utf8'));

  it('opens the home as a standalone app, portrait', () => {
    expect(m).toMatchObject({ name: 'mon-farm', short_name: 'mon-farm', start_url: '/v2', scope: '/', display: 'standalone', orientation: 'portrait' });
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('has the 192 and 512 icons, and the files are those sizes', () => {
    for (const size of [192, 512]) {
      const icon = m.icons.find((i: { sizes: string }) => i.sizes === `${size}x${size}`);
      expect(icon).toMatchObject({ type: 'image/png', purpose: 'any maskable' });
      expect(pngSize(read(join('public', icon.src)))).toEqual({ w: size, h: size });
    }
  });
});
