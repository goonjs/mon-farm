/**
 * "Deleted" — the other half of Soft Delete (E01-S04, SYNC-10, D-27).
 *
 * A deleted sale is hidden from the list, never removed: it lives here until
 * someone restores it, which brings it back exactly as it was. Any owner can
 * restore; there is no "delete forever".
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect, type Href } from 'expo-router';

import { Button, TopBar } from '../components/chrome';
import { projectSale } from '../core/project';
import type { SaleState } from '../core/types';
import { useT } from '../i18n';
import { setDeleted } from '../store/record';
// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { useTheme } from '../theme';

const LIST: Href = '/';

export default function DeletedSalesScreen() {
  const t = useTheme();
  const msg = useT();
  const [sales, setSales] = useState<SaleState[] | null>(null);

  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const states = await Promise.all(ids.map(async (id) => projectSale(await store.load(id), id)));
      setSales(states.filter((s) => s.deleted));
    })();
  }, []);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  const restore = async (id: string) => {
    try {
      await setDeleted(id, false);
    } catch (err) {
      console.error('Restore could not be stored.', err);
    }
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('deleted.title')}
        right={
          <Link href={LIST} asChild>
            <Button testID="deleted-back">{msg('deleted.back')}</Button>
          </Link>
        }
      />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.sm }}>
        {sales === null ? (
          <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
        ) : sales.length === 0 ? (
          <Text
            testID="deleted-empty"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}
          >
            {msg('deleted.empty')}
          </Text>
        ) : (
          sales.map((s) => (
            <View
              key={s.id}
              testID={`deleted-${s.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}
            >
              <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
                {msg('sales.row', {
                  name: s.parties?.farmName || s.parties?.buyer || msg('sales.unnamed'),
                  status: msg(s.status === 'closed' ? 'status.closed' : 'status.open'),
                  zones: s.zones.length,
                })}
              </Text>
              <Button testID={`restore-${s.id}`} variant="primary" onPress={() => void restore(s.id)}>
                {msg('deleted.restore')}
              </Button>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
