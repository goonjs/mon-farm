import { useCallback } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { DeletedSaleGate } from '../../../components/DeletedSaleGate';
import { SaleProvider, useSale } from '../../../store/SaleProvider';

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
      <RefreshOnFocus />
      <DeletedSaleGate>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </DeletedSaleGate>
    </SaleProvider>
  );
}

/**
 * This provider can stay mounted under the sale list (settlement links back
 * to `/`), so coming back re-reads the log: the sale may have been deleted
 * or restored from another screen in the meantime (E01-S04).
 */
function RefreshOnFocus() {
  const { refresh } = useSale();
  useFocusEffect(
    useCallback(() => {
      void refresh().catch((err) => console.error('Could not re-read the sale.', err));
    }, [refresh]),
  );
  return null;
}
