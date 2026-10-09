import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(join(resolve(__dirname, '..'), '.github', 'workflows', 'ci.yml'), 'utf8');

/** Each `- uses:` / `- name:` step of the workflow, as raw text. */
const steps = ci.split(/\n\s+- (?=name:|uses:)/);

describe('ci.yml artifacts', () => {
  // upload-artifact@v4 drops hidden files and folders unless told otherwise:
  // the Playwright failure report under e2e/.results/ uploaded empty (#45).
  it('every upload of a hidden path keeps hidden files', () => {
    const uploads = steps.filter((s) => s.includes('actions/upload-artifact'));
    expect(uploads.length).toBeGreaterThan(0);
    for (const s of uploads) {
      const path = s.match(/path:\s*(\S+)/)?.[1] ?? '';
      if (/(^|\/)\./.test(path)) expect(s, `upload of ${path}`).toMatch(/include-hidden-files:\s*true/);
    }
  });
});
