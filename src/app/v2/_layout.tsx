import { Stack } from 'expo-router';

/**
 * The v2 shell (D-82): the app since D-83 — `/` shows the splash and hands
 * over here, and unknown paths redirect here (+not-found). Providers (theme,
 * language, speech) come from the root layout.
 */
export default function V2Layout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
