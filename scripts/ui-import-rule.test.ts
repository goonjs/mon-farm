import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * D-82: the v2 UI (src/ui, src/v2 and the /v2 routes) is built only from the
 * new design system. The fence must reject every way of reaching old UI —
 * static import, require(), dynamic import(), relative or `@/` alias — from
 * src/components, src/constants/theme, the old hooks, and old app routes
 * outside src/app/v2. It must leave old screens alone and must not block a
 * future folder that merely happens to be named "components".
 */

const eslint = new ESLint();

/** Messages from the fence rules only (other lint rules are not under test). */
async function fenced(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages
    .filter((m) => ['import/no-restricted-paths', 'no-restricted-imports', 'no-restricted-syntax'].includes(m.ruleId ?? ''))
    .map((m) => m.message);
}

const V2_FILES = ['src/ui/probe.tsx', 'src/v2/probe.tsx', 'src/app/v2/probe.tsx'];

/** From src/ui/probe.tsx (one level under src/). */
const VIOLATIONS: Record<string, string> = {
  'static import of old component': "import { Pill } from '../components/chrome';\nexport const z = Pill;\n",
  'alias import of old component': "import { Pill } from '@/components/chrome';\nexport const z = Pill;\n",
  'old template colours': "import { Colors } from '../constants/theme';\nexport const z = Colors;\n",
  'require of old component': "const { Pill } = require('../components/chrome');\nexport const z = Pill;\n",
  'dynamic import of old component': "export const z = () => import('../components/chrome');\n",
  'old app route': "import Home from '../app/index';\nexport const z = Home;\n",
  'old dynamic app route': "import Counter from '../app/sale/[id]/counter';\nexport const z = Counter;\n",
  'old hook use-theme': "import { useTheme } from '../hooks/use-theme';\nexport const z = useTheme;\n",
  'old hook use-color-scheme': "import { useColorScheme } from '@/hooks/use-color-scheme';\nexport const z = useColorScheme;\n",
};

describe('v2 import fence (D-82)', () => {
  it.each(Object.entries(VIOLATIONS))('rejects %s', async (_kind, source) => {
    expect(await fenced('src/ui/probe.tsx', source)).not.toEqual([]);
  });

  it.each(V2_FILES)('%s is fenced', async (f) => {
    const deep = f.startsWith('src/app/v2') ? '../../components/chrome' : '../components/chrome';
    expect(await fenced(f, `import { Pill } from '${deep}';\nexport const z = Pill;\n`)).not.toEqual([]);
  });

  it('allows tokens, strings, logic, other v2 routes and a folder named components inside src/ui', async () => {
    const ok = [
      "import { useTheme } from '../theme';",
      "import { useT } from '../i18n';",
      "import { syncStatusFrom } from '../sync/status';",
      "import { store } from '../store/store';",
      "import V2Home from '../app/v2/index';",
      "import { X } from './components/x';",
      "const t = require('../theme');",
      "export const lazy = () => import('../i18n');",
      'export const z = [useTheme, useT, syncStatusFrom, store, V2Home, X, t];',
    ].join('\n');
    expect(await fenced('src/ui/probe.tsx', ok)).toEqual([]);
  });

  it('old screens are not affected', async () => {
    expect(await fenced('src/app/probe.tsx', VIOLATIONS['static import of old component'])).toEqual([]);
  });
}, 60_000);
