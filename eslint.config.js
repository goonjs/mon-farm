const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: [
      'dist/**',
      'e2e/.results/**',
      'node_modules/**',
      'docs/**',
      '.expo/**',
      // Unused Expo template leftovers. Nothing the app renders imports them.
      // They are kept rather than deleted because CLAUDE.md requires per-file
      // confirmation to delete; the full list is in
      // docs/stories/s1-tech-stack-and-ci.md under "Template files kept".
      'src/hooks/**',
      'src/constants/**',
      'src/components/animated-icon*',
      'src/components/app-tabs*',
      'src/components/web-badge.tsx',
      'src/components/hint-row.tsx',
      'src/components/external-link.tsx',
      'src/components/themed-*.tsx',
      'src/components/ui/**',
      'src/app/explore.tsx',
    ],
  },
  {
    // D-82: the v2 UI (src/ui, src/v2 and the /v2 routes) is built only from
    // the new design system. It may reuse logic (core, store, sync, i18n,
    // theme tokens) but never old UI: src/components, the template colours
    // in src/constants/theme, the template hooks, or old screens in src/app
    // outside src/app/v2. Matched by RESOLVED path (relative or `@/` alias),
    // so a folder that is merely named "components" elsewhere is not
    // blocked. The plugin checks import, export-from, require() and
    // dynamic import(). Tested in scripts/ui-import-rule.test.ts.
    files: ['src/ui/**', 'src/v2/**', 'src/app/v2/**'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: ['./src/ui', './src/v2', './src/app/v2'],
              from: [
                './src/components',
                './src/constants/theme.ts',
                './src/hooks/use-theme.ts',
                './src/hooks/use-color-scheme.ts',
                './src/hooks/use-color-scheme.web.ts',
              ],
              message: 'v2 UI (D-82): build from src/ui; old UI, template colours and hooks are off limits.',
            },
            {
              target: ['./src/ui', './src/v2', './src/app/v2'],
              from: './src/app',
              except: ['./v2'],
              message: 'v2 UI (D-82): do not import old screens; only src/app/v2 routes.',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      // The log is append-only and the projection is a fold; unused catch
      // bindings are common where a failure is deliberately swallowed (storage
      // quota must never block counting).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
