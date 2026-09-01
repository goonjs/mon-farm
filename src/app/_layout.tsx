import { Stack } from 'expo-router';

import { I18nProvider } from '../i18n';
import { SpeechProvider } from '../speech';
import { ThemeProvider } from '../theme';

/**
 * Root layout. Theme, language, and speech — there is no sale-wide provider
 * here any more.
 *
 * A sale is now something the app navigates TO (`/sale/[id]/...`), not
 * something baked into every screen from launch. `<SaleProvider>` moved to
 * `src/app/sale/[id]/_layout.tsx`, which reads the id from the route. The
 * screens outside that segment (the sale list, this layout) have no current
 * sale and shouldn't pretend to.
 *
 * All three providers here are device preferences rather than sale data,
 * which is exactly why they sit above the sale segment instead of inside it.
 */
export default function RootLayout() {
  return (
    // Light is the default and the field mode — see docs/ux/design-system.md §3.
    // Thai is the default for the same kind of reason: this is an app for a
    // Thai farm, and the device's locale is not evidence about who is holding
    // it (see src/i18n/index.tsx). Speech defaults on — FR-11 is half the
    // cross-check the product exists for.
    <ThemeProvider initial="light">
      <I18nProvider initial="th">
        <SpeechProvider initial>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
        </SpeechProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
