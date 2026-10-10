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
    // theme tokens) but never
    // the old UI in src/components or the template colours in
    // src/constants/theme.
    files: ['src/ui/**', 'src/v2/**', 'src/app/v2/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/components', '**/components/**', '@/components', '@/components/**'],
              message: 'v2 UI (D-82): build from src/ui, never import old UI from src/components.',
            },
            {
              group: ['**/constants/theme', '@/constants/theme'],
              message: 'v2 UI (D-82): read tokens via src/theme, not the old src/constants/theme.',
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
