import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * E01-S06 / ADR 0003 path B: the APK is built by GitHub Actions + `expo prebuild` + Gradle, started by
 * hand only (minutes are shared), signed with the owner's keystore from secrets on every build (a
 * debug-signed first APK could never be updated in place, and its data would be lost), and kept a
 * short while (artifact storage is billed past 500 MB).
 */
const file = join(resolve(__dirname, '..'), '.github', 'workflows', 'android-apk.yml');
const yml = readFileSync(file, 'utf8');
const code = yml.replace(/\s+#.*$/gm, '');

describe('android-apk.yml (E01-S06, ADR 0003)', () => {
  it('runs only when started by hand', () => {
    const on = code.split(/\non:\s*\n/)[1].split(/\n\S/)[0];
    expect(on.trim()).toBe('workflow_dispatch:');
  });

  it('has a time limit and reads the repo only', () => {
    expect(code).toMatch(/timeout-minutes:\s*\d+/);
    expect(code).toMatch(/permissions:\s*\n\s+contents:\s*read/);
  });

  it('prebuilds Android and assembles the release APK', () => {
    expect(code).toMatch(/expo prebuild --platform android/);
    expect(code).toMatch(/gradlew assembleRelease/);
  });

  it('signs with the keystore from the four secrets, never printing them', () => {
    for (const s of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
      expect(code).toContain(`secrets.${s}`);
    }
    for (const p of ['store.file', 'store.password', 'key.alias', 'key.password']) {
      expect(code).toContain(`-Pandroid.injected.signing.${p}=`);
    }
    // Secrets reach the steps through env only, never pasted into a command line that a log could show.
    for (const line of code.split('\n').filter((l) => l.includes('secrets.'))) {
      expect(line.trim()).toMatch(/^[A-Z0-9_]+:\s*\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}$/);
    }
  });

  it('fails if the APK came out signed with the public debug key', () => {
    expect(code).toMatch(/apksigner"?\s+verify --print-certs/i);
    expect(code).toContain('Android Debug');
  });

  it('keeps the APK 7 days at most', () => {
    const days = Number(code.match(/retention-days:\s*(\d+)/)?.[1]);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(7);
  });
});
