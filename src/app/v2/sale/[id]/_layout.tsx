import { Stack, useLocalSearchParams } from 'expo-router';

import { SaleProvider } from '../../../../store/SaleProvider';

/**
 * Every /v2/sale/<id>/… screen shares that sale's log in context (D-82: the
 * provider is logic; no old UI is mounted around it).
 */
export default function V2SaleLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SaleProvider saleId={id}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </SaleProvider>
  );
}
