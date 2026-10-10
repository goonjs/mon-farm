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

import { Button, cardStyle } from '../components/chrome';
import { Drawer, MenuItem, MenuSection } from '../components/ui/drawer';
import { ScreenHeader } from '../components/ui/screen-header';
import { useSyncStatus } from '../sync/use-sync-status';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const sync = useSyncStatus();

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
      <ScreenHeader
        title="mon-farm"
        subtitle={msg('sales.title')}
        menu={{ onPress: () => setMenuOpen(true) }}
        sync={sync}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.lg, gap: t.space.md }}>
        {sales === null ? (
          <Text style={{ fontFamily: t.font.family.sans, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
        ) : sales.length === 0 ? (
          <Text
            testID="empty-state"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft }}
          >
            {msg('sales.empty')}
          </Text>
        ) : (
          <View testID="home-sales" style={{ ...cardStyle(t), paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}>
            {sales.map((s, i) => (
              <SaleRow key={s.id} sale={s} first={i === 0} onDelete={() => void remove(s.id)} />
            ))}
          </View>
        )}
        <Link href="/history" asChild>
          <Button testID="open-history">{msg('hist.open')}</Button>
        </Link>
        {deletedCount > 0 && (
          <Link href="/deleted" asChild>
            <Button testID="open-deleted">{msg('sales.deletedLink', { n: deletedCount })}</Button>
          </Link>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.md }}>
        <Link href={newSaleHref} asChild>
          <Button testID="new-sale" variant="primary">{msg('sales.new')}</Button>
        </Link>
        {/* D-74 F5: "all expenses" is reachable from the front door and the menu. */}
        <View style={{ height: t.space.sm }} />
        <Link href="/finance/expenses" asChild>
          <Button testID="open-expenses">{msg('fin.open')}</Button>
        </Link>
      </View>

      {/* ☰ menu (v1.1.0 farm screen 1). Settings moved here off the front
          door; the sale list stays the home screen's main card. */}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <MenuSection title={msg('menu.shared')}>
          <MenuItem
            testID="menu-farm-profile"
            label={msg('settings.farmProfile')}
            href="/farm-profile"
            onPress={() => setMenuOpen(false)}
          />
          <MenuItem testID="menu-sales" label={msg('menu.sales')} onPress={() => setMenuOpen(false)} />
          <MenuItem testID="menu-expenses" label={msg('fin.open')} href="/finance/expenses" onPress={() => setMenuOpen(false)} />
          <MenuItem testID="menu-history" label={msg('hist.open')} href="/history" onPress={() => setMenuOpen(false)} />
        </MenuSection>
        <MenuSection title={msg('menu.device')}>
          <MenuItem
            testID="open-settings"
            label={msg('settings.open')}
            href={SETTINGS}
            onPress={() => setMenuOpen(false)}
          />
        </MenuSection>
      </Drawer>
    </View>
  );
}

function SaleRow({ sale, first, onDelete }: { sale: SaleState; first: boolean; onDelete: () => void }) {
  const t = useTheme();
  const msg = useT();
  // Two steps, like every destructive action here; keeping it is the default.
  const [confirming, setConfirming] = useState(false);
  const href: Href = sale.status === 'closed'
    ? { pathname: '/sale/[id]/settlement', params: { id: sale.id } }
    : { pathname: '/sale/[id]/counter', params: { id: sale.id } };

  const label = sale.parties?.farmName || sale.parties?.buyer || msg('sales.unnamed');

  return (
    <View
      style={{
        gap: t.space.xs,
        paddingVertical: t.space.sm,
        // Rows inside the list card are split by a hairline, as in the mockups.
        borderTopWidth: first ? 0 : t.border.hair,
        borderTopColor: t.color.ruleFaint,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Link href={href} asChild>
            <Button testID={`sale-${sale.id}`} variant="row">
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
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.inkSoft }}>
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
