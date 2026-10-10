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
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect, type Href } from 'expo-router';

import { Button } from '../components/chrome';
import { projectSale } from '../core/project';
import { formatThaiDate, todayIso, type MasterState } from '../core/master';
import { saleRollup } from '../core/sale-points';
import { formatKg } from '../core/settle';
import { saleTotals } from '../core/totals';
import type { SaleEvent, SaleState } from '../core/types';
import { newId } from '../lib/id';
import { setDeleted } from '../store/record';
// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { peopleStore } from '../store/people';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export default function SaleListScreen() {
  const t = useTheme();
  const msg = useT();
  const [sales, setSales] = useState<SaleCard[] | null>(null); // null = loading
  // Soft-deleted sales (E01-S04) are hidden here and listed under "deleted".
  const [deletedCount, setDeletedCount] = useState(0);

  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const master = await peopleStore.state();
      const cards = await Promise.all(
        ids.map(async (id) => {
          const events = await store.load(id);
          return saleCard(projectSale(events, id), events, master);
        }),
      );
      setSales(cards.filter((c) => !c.sale.deleted));
      setDeletedCount(cards.filter((c) => c.sale.deleted).length);
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

  // E04-S02: a new sale starts from master data; the old setup screen stays reachable by URL.
  const newSaleHref = { pathname: '/sale/[id]/start', params: { id: newId('sale-') } } as const;
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
        <Link href={'/farm-data' as Href} asChild>
          <Button testID="open-farm-data">{msg('farmData.open')}</Button>
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
          <>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('sales.hint')}</Text>
            {sales.map((c) => (
              <SaleRow key={c.sale.id} card={c} onDelete={() => void remove(c.sale.id)} />
            ))}
          </>
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

interface SaleCard {
  readonly sale: SaleState;
  readonly baskets: number;
  readonly netG: number;
  /** Per tapper on the sale day, by name (mockup v1.1.0 sale-00). */
  readonly tappers: readonly { name: string; netG: number }[];
}

function saleCard(sale: SaleState, events: readonly SaleEvent[], master: MasterState): SaleCard {
  const totals = saleTotals(events);
  const rollup = saleRollup(events, master, todayIso(sale.startedTs ?? 0));
  const tappers = [...rollup.byTapper].map(([id, tt]) => ({
    name: master.people.find((p) => p.id === id)?.name ?? '',
    netG: tt.netG,
  }));
  return { sale, baskets: totals.baskets, netG: totals.netG, tappers };
}

/** A sale as a card (mockup v1.1.0 sale-00): date, buyer, baskets, kg, status, kg per tapper. */
function SaleRow({ card, onDelete }: { card: SaleCard; onDelete: () => void }) {
  const t = useTheme();
  const msg = useT();
  const sale = card.sale;
  // Two steps, like every destructive action here; keeping it is the default.
  const [confirming, setConfirming] = useState(false);
  const href: Href = sale.status === 'closed'
    ? { pathname: '/sale/[id]/settlement', params: { id: sale.id } }
    : { pathname: '/sale/[id]/counter', params: { id: sale.id } };
  const label = sale.parties?.farmName || sale.parties?.buyer || msg('sales.unnamed');
  // A finished sale says its business status (E04-S11); else closed, or still weighing.
  const status =
    sale.saleStatus !== 'draft' ? msg(`status.${sale.saleStatus}`) : sale.status === 'closed' ? msg('status.closed') : msg('sales.weighing');
  const done = sale.saleStatus === 'completed' || (sale.saleStatus === 'draft' && sale.status === 'closed');
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };
  const bold = { fontFamily: t.font.family.sans, fontWeight: t.font.weight.bold, color: t.color.ink };

  return (
    <View
      style={{
        backgroundColor: t.color.surfaceRaised,
        borderRadius: t.radius.lg,
        borderWidth: t.border.hair,
        borderColor: t.color.ruleFaint,
        padding: t.space.md,
        gap: t.space.xs,
      }}
    >
      <Link href={href} asChild>
        <Pressable testID={`sale-${sale.id}`} accessibilityRole="button" style={{ gap: t.space.xs, minHeight: t.target.min }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...bold, fontSize: t.font.size.headingMd }}>
                {sale.startedTs ? formatThaiDate(sale.startedTs, 'be') : label}
              </Text>
              {sale.parties?.farmName ? <Text style={small}>{sale.parties.farmName}</Text> : null}
              {sale.parties?.buyer ? <Text style={small}>{sale.parties.buyer}</Text> : null}
              <Text style={small}>{msg('sales.baskets', { n: card.baskets })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: t.space.xs }}>
              <Text style={{ ...bold, fontSize: t.font.size.headingMd }}>{`${formatKg(card.netG)} ${msg('rec.kgUnit')}`}</Text>
              <Text
                style={{
                  ...small,
                  fontWeight: t.font.weight.bold,
                  color: sale.saleStatus === 'cancelled' ? t.color.reject : done ? t.color.accept : t.color.warn,
                  backgroundColor: sale.saleStatus === 'cancelled' ? t.color.rejectSunk : done ? t.color.acceptSunk : t.color.warnSunk,
                  paddingHorizontal: t.space.sm,
                  paddingVertical: 2,
                  borderRadius: t.radius.pill,
                  overflow: 'hidden',
                }}
              >
                {done ? `✓ ${status}` : status}
              </Text>
            </View>
          </View>
          {card.tappers.length > 0 ? (
            <View style={{ borderLeftWidth: t.border.thick, borderLeftColor: t.color.rule, paddingLeft: t.space.sm, gap: 2 }}>
              {card.tappers.map((tp) => (
                <View key={tp.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...bold, fontSize: t.font.size.body }}>{tp.name}</Text>
                  <Text style={{ ...bold, fontSize: t.font.size.body }}>{`${formatKg(tp.netG)} ${msg('rec.kgUnit')}`}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Link>
      {!confirming ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            testID={`delete-${sale.id}`}
            variant="destructive"
            accessibilityLabel={msg('sales.deleteLabel', { name: label })}
            onPress={() => setConfirming(true)}
          >
            {msg('sales.delete')}
          </Button>
        </View>
      ) : (
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
