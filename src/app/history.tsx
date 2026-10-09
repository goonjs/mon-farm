/**
 * Sale history (E05-S06): every sale on this device, newest first, with its
 * buyer, kg, baskets, price, amount, owner share and status; tapping one
 * opens its settlement (the SET-7 detail) or, if still open, the counter.
 * Deleted sales are left out of the list and the totals, and reachable
 * under "deleted" (SYNC-10). Check/payment statuses (E05-S03/S05) and
 * Cancelled (E04-S11) join when those exist; sync is local-only until E01-S09.
 */

import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../components/chrome';
import { Note } from '../components/finance/parts';
import { saleHistory, type SaleRow } from '../core/finance/history';
import { formatDate, formatSatang } from '../core/finance/money';
import { useT } from '../i18n';
import { store } from '../store/store';
import { useTheme } from '../theme';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const isoOf = (ts: number) => {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function HistoryScreen() {
  const t = useTheme();
  const msg = useT();
  const [h, setH] = useState<ReturnType<typeof saleHistory> | null>(null);

  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      setH(saleHistory(await Promise.all(ids.map(async (id) => ({ id, events: await store.load(id) })))));
    })().catch((err) => console.error('Sales could not be read.', err));
  }, []);
  useFocusEffect(reload);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('hist.title')} right={<Button testID="history-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.sm }}>
        {h === null ? (
          <Note>{msg('counter.loading')}</Note>
        ) : h.visible.length === 0 ? (
          <Note testID="history-empty">{msg('hist.empty')}</Note>
        ) : (
          <>
            <Note testID="history-total">
              {msg('hist.total', { n: h.visible.length, kg: kg(h.totalNetG), amount: formatSatang(h.totalSatang) })}
            </Note>
            {h.visible.map((r) => (
              <Row key={r.saleId} r={r} />
            ))}
          </>
        )}
        {h && h.deletedCount > 0 ? (
          <Link href="/deleted" asChild>
            <Button testID="history-deleted">{msg('hist.deleted', { n: h.deletedCount })}</Button>
          </Link>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ r }: { r: SaleRow }) {
  const t = useTheme();
  const msg = useT();
  const open = () =>
    router.push(
      r.status === 'closed'
        ? { pathname: '/sale/[id]/settlement', params: { id: r.saleId } }
        : { pathname: '/sale/[id]/counter', params: { id: r.saleId } },
    );
  return (
    <Pressable
      testID={`history-${r.saleId}`}
      accessibilityRole="button"
      onPress={open}
      style={{ padding: t.space.md, gap: 2, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.rule, backgroundColor: t.color.surfaceRaised }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {[r.startedTs ? formatDate(isoOf(r.startedTs)) : null, r.buyer || r.farmName].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {r.grossSatang === null ? '—' : formatSatang(r.grossSatang)}
        </Text>
      </View>
      <Note>
        {[
          msg('hist.row.kg', { kg: kg(r.netG), baskets: r.baskets }),
          r.satangPerKg === null ? msg('hist.row.noPrice') : msg('hist.row.price', { price: formatSatang(r.satangPerKg) }),
          r.ownerSatang === null ? null : msg('hist.row.owner', { amount: formatSatang(r.ownerSatang) }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Note>
      <Note>{`${msg(r.status === 'closed' ? 'hist.status.closed' : 'hist.status.open')} · ${msg('hist.row.local')}`}</Note>
    </Pressable>
  );
}
