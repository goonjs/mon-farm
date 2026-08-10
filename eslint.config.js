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
    rules: {
      // The log is append-only and the projection is a fold; unused catch
      // bindings are common where a failure is deliberately swallowed (storage
      // quota must never block counting).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
