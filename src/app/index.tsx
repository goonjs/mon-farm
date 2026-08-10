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
// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { useTheme } from '../theme';

export default function SaleListScreen() {
  const t = useTheme();
  const [sales, setSales] = useState<SaleState[] | null>(null); // null = loading

  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const states = await Promise.all(
        ids.map(async (id) => projectSale(await store.load(id), id)),
      );
      setSales(states);
    })();
  }, []);

  useEffect(reload, [reload]);
  // Coming back from setting up or counting a sale should refresh the list —
  // its status or figures may have changed while this screen was off-screen.
  useFocusEffect(reload);

  const newSaleHref = { pathname: '/sale/[id]/setup', params: { id: newId('sale-') } } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View
        style={{
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
          การขาย · sales
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, gap: t.space.sm }}>
        {sales === null ? (
          <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>กำลังโหลด…</Text>
        ) : sales.length === 0 ? (
          <Text
            testID="empty-state"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}
          >
            ยังไม่มีการขาย · no sales yet — start one below.
          </Text>
        ) : (
          sales.map((s) => <SaleRow key={s.id} sale={s} />)
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
          <Button testID="new-sale" variant="primary">+ เริ่มการขายใหม่ · start a new sale</Button>
        </Link>
      </View>
    </View>
  );
}

function SaleRow({ sale }: { sale: SaleState }) {
  const href: Href = sale.status === 'closed'
    ? { pathname: '/sale/[id]/settlement', params: { id: sale.id } }
    : { pathname: '/sale/[id]/counter', params: { id: sale.id } };

  const label = sale.parties?.farmName || sale.parties?.buyer || 'ยังไม่ได้ตั้งค่า · not set up yet';

  return (
    <Link href={href} asChild>
      <Button testID={`sale-${sale.id}`}>
        {`${label} · ${sale.status === 'closed' ? 'ปิดแล้ว' : 'เปิดอยู่'} · ${sale.zones.length} โซน`}
      </Button>
    </Link>
  );
}
