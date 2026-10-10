import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(resolve(__dirname, '..'), '.github', 'workflows');
const workflows = readdirSync(dir).filter((f) => f.endsWith('.yml'));

/** Each step of a workflow as raw text, comments removed. */
function steps(file: string): string[] {
  const text = readFileSync(join(dir, file), 'utf8').replace(/\s+#.*$/gm, '');
  return text.split(/\n\s+- (?=[\w-]+:)/);
}

describe('workflow artifacts', () => {
  // upload-artifact@v4 drops hidden files and folders unless told otherwise:
  // the Playwright report under e2e/.results/ uploaded empty (#45), and the
  // web build carries _expo/.routes.json. Every upload states it explicitly,
  // so nobody has to remember which paths hide something.
  it.each(workflows)('%s: every upload-artifact step sets include-hidden-files', (file) => {
    for (const s of steps(file).filter((x) => x.includes('actions/upload-artifact'))) {
      expect(s, s.split('\n')[0]).toMatch(/include-hidden-files:\s*true/);
    }
  });
});
