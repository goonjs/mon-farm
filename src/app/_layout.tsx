import { Stack } from 'expo-router';

import { DEMO_SALE_ID, demoSeed } from '../demo';
import { SaleProvider } from '../store/SaleProvider';
import { ThemeProvider } from '../theme';

export default function RootLayout() {
  return (
    // Light is the default and the field mode — see docs/ux/design-system.md §3.
    <ThemeProvider initial="light">
      <SaleProvider saleId={DEMO_SALE_ID} seed={demoSeed()}>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </SaleProvider>
    </ThemeProvider>
  );
}
