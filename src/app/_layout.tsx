import { Stack } from 'expo-router';

import { ThemeProvider } from '../theme';

/**
 * Root layout. Theme only — there is no sale-wide provider here any more.
 *
 * A sale is now something the app navigates TO (`/sale/[id]/...`), not
 * something baked into every screen from launch. `<SaleProvider>` moved to
 * `src/app/sale/[id]/_layout.tsx`, which reads the id from the route. The
 * screens outside that segment (the sale list, this layout) have no current
 * sale and shouldn't pretend to.
 */
export default function RootLayout() {
  // Light is the default and the field mode — see docs/ux/design-system.md §3.
  return (
    <ThemeProvider initial="light">
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </ThemeProvider>
  );
}
