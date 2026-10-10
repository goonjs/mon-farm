import { Stack } from 'expo-router';

/**
 * The v2 shell (D-82), mounted at /v2 beside the old UI so the old screens
 * and their e2e suite stay untouched until the owner switches the default.
 * Providers (theme, language, speech) come from the root layout.
 */
export default function V2Layout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
