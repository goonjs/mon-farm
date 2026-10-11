import { Stack } from 'expo-router';
import { View } from 'react-native';

import { I18nProvider } from '../i18n';
import { SpeechProvider } from '../speech';
import { ThemeProvider } from '../theme';
import { StorageWarning } from '../v2/storage-warning';

/**
 * Root layout. Theme, language, and speech — device preferences, not sale
 * data, so they sit above every route. The app opens on the splash at `/`,
 * which hands over to the v2 home (`/v2`); the storage warning (E01-S03)
 * sits above whatever screen is showing.
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
          <View style={{ flex: 1 }}>
            <StorageWarning />
            <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
          </View>
        </SpeechProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
