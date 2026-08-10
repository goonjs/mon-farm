import { Stack, useLocalSearchParams } from 'expo-router';

import { SaleProvider } from '../../../store/SaleProvider';

/**
 * Everything under `/sale/[id]/` shares one sale in context, keyed by the
 * route param — not by a hardcoded id, and not seeded with anything. A sale
 * with no events yet is a legitimate, empty state: `useSale()` resolves it to
 * `projectSale([])`, and the setup screen is where it gets its first events.
 */
export default function SaleLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SaleProvider saleId={id}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </SaleProvider>
  );
}
