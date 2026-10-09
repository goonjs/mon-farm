import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button } from './chrome';
import { useT } from '../i18n';
import { setDeleted } from '../store/record';
import { useSale } from '../store/SaleProvider';
import { useTheme } from '../theme';

/**
 * A soft-deleted sale (E01-S04) is hidden, not gone — but it must not take
 * new records while hidden, or baskets would be counted into a sale nobody
 * can see. Its screens are replaced by this notice until it is restored.
 */
export function DeletedSaleGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const msg = useT();
  const { saleId, state, ready, refresh } = useSale();
  const [busy, setBusy] = useState(false);

  if (!ready || !state.deleted) return <>{children}</>;

  const restore = async () => {
    setBusy(true);
    try {
      await setDeleted(saleId, false);
      await refresh();
    } catch (err) {
      console.error('Restore could not be stored.', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="deleted-sale-notice" style={{ flex: 1, padding: t.space.md, gap: t.space.md, backgroundColor: t.color.surface }}>
      <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.body, color: t.color.ink }}>
        {msg('deleted.saleNotice')}
      </Text>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button testID="deleted-sale-restore" variant="primary" disabled={busy} onPress={() => void restore()}>
          {msg('deleted.restore')}
        </Button>
        <Link href="/" asChild>
          <Button testID="deleted-sale-back">{msg('deleted.back')}</Button>
        </Link>
      </View>
    </View>
  );
}
