import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * D-82: the v2 UI (src/ui, src/v2 and the /v2 routes) is built only from the
 * new design system. The lint rule must reject old-UI imports there and
 * leave the old screens alone.
 */

const eslint = new ESLint();

async function restricted(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

const OLD = "import { a } from '../components/chrome';\nimport { b } from '@/constants/theme';\nexport const z = [a, b];\n";
const NEW = "import { useTheme } from '../theme';\nimport { useT } from '../i18n';\nexport const z = [useTheme, useT];\n";

describe('v2 import rule (D-82)', () => {
  it.each(['src/ui/probe.tsx', 'src/v2/probe.tsx', 'src/app/v2/probe.tsx'])('%s may not import old UI or old theme', async (f) => {
    const hits = await restricted(f, OLD);
    expect(hits).toHaveLength(2);
  });

  it('src/ui may import tokens and strings', async () => {
    expect(await restricted('src/ui/probe.tsx', NEW)).toEqual([]);
  });

  it('old screens are not affected', async () => {
    expect(await restricted('src/app/probe.tsx', OLD)).toEqual([]);
  });
}, 30_000);
