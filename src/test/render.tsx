/**
 * The component tier's render helper.
 *
 * Every component test needs the same providers, and before this each of the
 * eight test files declared its own identical `wrap`. Adding `<I18nProvider>`
 * meant touching all eight — which is the signal that the duplication had
 * started costing something. Providers get added over time (theme, language,
 * whatever comes next); the tree they compose belongs in one place.
 *
 * Defaults match what the app itself starts with: light theme (the field
 * mode, F-15) and Thai (the source locale). A test that cares about the other
 * values passes them, and a test that does not gets the real defaults rather
 * than an arbitrary pairing that only exists in tests.
 */

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { I18nProvider, type Locale } from '../i18n';
import { ThemeProvider } from '../theme';
import type { ColorScheme } from '../../design/tokens';

export function wrap(
  ui: ReactElement,
  { scheme = 'light', locale = 'th' }: { scheme?: ColorScheme; locale?: Locale } = {},
) {
  return render(
    <ThemeProvider initial={scheme}>
      <I18nProvider initial={locale}>{ui}</I18nProvider>
    </ThemeProvider>,
  );
}
