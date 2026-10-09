/**
 * The sale list — the app's front door.
 *
 * Replaces a seeded demo sale (removed in S17). This screen shows whatever
 * sales genuinely exist in the store — nothing here is fabricated — and lets
 * one be resumed, or a new one started. A brand-new sale writes no event and
 * therefore doesn't appear in this list until setup actually records
 * something; an entry that started and was abandoned mid-setup is exactly as
 * real as one that's mid-count, so both show up the same way.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect, type Href } from 'expo-router';

import { Button } from '../components/chrome';
import { projectSale } from '../core/project';
import type { SaleState } from '../core/types';
import { newId } from '../lib/id';
import { setDeleted } from '../store/record';
// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export default function SaleListScreen() {
  const t = useTheme();
  const msg = useT();
  const [sales, setSales] = useState<SaleState[] | null>(null); // null = loading
  // Soft-deleted sales (E01-S04) are hidden here and listed under "deleted".
  const [deletedCount, setDeletedCount] = useState(0);

  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const states = await Promise.all(
        ids.map(async (id) => projectSale(await store.load(id), id)),
      );
      setSales(states.filter((s) => !s.deleted));
      setDeletedCount(states.filter((s) => s.deleted).length);
    })();
  }, []);

  const remove = async (id: string) => {
    try {
      await setDeleted(id, true);
    } catch (err) {
      console.error('Delete could not be stored.', err);
    }
    reload();
  };

  useEffect(reload, [reload]);
  // Coming back from setting up or counting a sale should refresh the list —
  // its status or figures may have changed while this screen was off-screen.
  useFocusEffect(reload);

  const newSaleHref = { pathname: '/sale/[id]/setup', params: { id: newId('sale-') } } as const;
  // Settings live off the front door rather than off a working screen — see
  // the header comment in src/app/settings.tsx.
  const SETTINGS = '/settings' as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          padding: t.space.md,
          borderBottomWidth: t.border.hair,
          borderBottomColor: t.color.rule,
        }}
      >
        <Text
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.title,
            fontWeight: t.font.weight.black,
            color: t.color.ink,
          }}
        >
          mon-farm
        </Text>
        <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
          {msg('sales.title')}
        </Text>
        <View style={{ flex: 1 }} />
        {/* D-74 F5: "all expenses" is reachable from the front door and the menu (settings). */}
        <Link href="/finance/expenses" asChild>
          <Button testID="open-expenses">{msg('fin.open')}</Button>
        </Link>
        <Link href={SETTINGS} asChild>
          <Button testID="open-settings">{msg('settings.open')}</Button>
        </Link>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, gap: t.space.sm }}>
        {sales === null ? (
          <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
        ) : sales.length === 0 ? (
          <Text
            testID="empty-state"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}
          >
            {msg('sales.empty')}
          </Text>
        ) : (
          sales.map((s) => <SaleRow key={s.id} sale={s} onDelete={() => void remove(s.id)} />)
        )}
        {deletedCount > 0 && (
          <Link href="/deleted" asChild>
            <Button testID="open-deleted">{msg('sales.deletedLink', { n: deletedCount })}</Button>
          </Link>
        )}
      </ScrollView>

      <View
        style={{
          padding: t.space.sm,
          borderTopWidth: t.border.hair,
          borderTopColor: t.color.rule,
        }}
      >
        <Link href={newSaleHref} asChild>
          <Button testID="new-sale" variant="primary">{msg('sales.new')}</Button>
        </Link>
      </View>
    </View>
  );
}

function SaleRow({ sale, onDelete }: { sale: SaleState; onDelete: () => void }) {
  const t = useTheme();
  const msg = useT();
  // Two steps, like every destructive action here; keeping it is the default.
  const [confirming, setConfirming] = useState(false);
  const href: Href = sale.status === 'closed'
    ? { pathname: '/sale/[id]/settlement', params: { id: sale.id } }
    : { pathname: '/sale/[id]/counter', params: { id: sale.id } };

  const label = sale.parties?.farmName || sale.parties?.buyer || msg('sales.unnamed');

  return (
    <View style={{ gap: t.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Link href={href} asChild>
            <Button testID={`sale-${sale.id}`}>
              {msg('sales.row', {
                name: label,
                status: msg(sale.status === 'closed' ? 'status.closed' : 'status.open'),
                zones: sale.zones.length,
              })}
            </Button>
          </Link>
        </View>
        {!confirming && (
          <Button
            testID={`delete-${sale.id}`}
            variant="destructive"
            accessibilityLabel={msg('sales.deleteLabel', { name: label })}
            onPress={() => setConfirming(true)}
          >
            {msg('sales.delete')}
          </Button>
        )}
      </View>
      {confirming && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
            {msg('sales.deleteHint')}
          </Text>
          <Button testID={`delete-cancel-${sale.id}`} onPress={() => setConfirming(false)}>
            {msg('sales.deleteCancel')}
          </Button>
          <Button
            testID={`delete-confirm-${sale.id}`}
            variant="destructive"
            accessibilityLabel={`${msg('sales.deleteConfirm')} — ${label}`}
            onPress={onDelete}
          >
            {msg('sales.deleteConfirm')}
          </Button>
        </View>
      )}
    </View>
  );
}
