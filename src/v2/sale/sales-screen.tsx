/**
 * /v2/sales — การขายทั้งหมด (sale mockup v1.1.0 page 4): every started sale,
 * newest first, read from the local event log (offline). Each row: the date
 * (พ.ศ., tap to switch era), the buyer, baskets, total kg and its state; under
 * it each tapper's kg, one per line, adding up to the row (D-78). No per-row
 * sync badge — only "ขัดกัน" would show, and v2 has no conflict check yet.
 */

import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatThaiDate, type MasterState } from '../../core/master';
import { currentPoint, saleListRows, type SaleListRow } from '../../core/sale-list';
import { useI18n, useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { store } from '../../store/store';
import { useTheme } from '../../theme';
import { AppText, BasketIcon, Chip, CTA, IconTile, LeafIcon, TapperIcon, toneColours, UsersIcon } from '../../ui';
import { FarmScreen, RowCard } from '../farm/pieces';
import { saleHref } from '../routes';
import { Banner, clearClosing, IconLine, kgText, tapperTone } from './pieces';

interface Loaded {
  readonly master: MasterState;
  readonly rows: readonly (SaleListRow & { point: string | null })[];
}

function useSales(): Loaded | null {
  const [data, setData] = useState<Loaded | null>(null);
  const reload = useCallback(() => {
    (async () => {
      const master = await peopleStore.state();
      const ids = await store.listSales();
      const sales = await Promise.all(ids.map(async (id) => ({ id, events: await store.load(id) })));
      const points = new Map(sales.map((s) => [s.id, currentPoint(s.events)]));
      setData({ master, rows: saleListRows(sales, master).map((r) => ({ ...r, point: points.get(r.id) ?? null })) });
    })().catch((err) => console.error('Sales could not be read.', err));
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);
  return data;
}

export function SalesScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { era, toggleEra } = useI18n();
  const data = useSales();
  // A sale closed on the way here is done closing.
  useEffect(clearClosing, []);

  const open = (r: SaleListRow & { point: string | null }) => router.push(saleHref(r.id, r));

  return (
    <FarmScreen
      title={msg('v2.sales')}
      fallback={'/v2' as Href}
      testID="sales"
      footer={
        data && data.rows.length === 0 ? (
          <CTA testID="sales-start" onPress={() => router.push('/v2/sale/start' as Href)}>
            {msg('v2.saleStart')}
          </CTA>
        ) : null
      }
    >
      {data && data.rows.length ? <AppText variant="bodySm">{msg('sales.hint')}</AppText> : null}
      {data && data.rows.length === 0 ? <AppText variant="bodySm">{msg('v2s.empty')}</AppText> : null}
      {data && data.rows.length ? (
        <RowCard testID="sale-rows">
          {data.rows.map((r) => (
            <Pressable key={r.id} testID={`sale-row-${r.id}`} accessibilityRole="button" onPress={() => open(r)} style={{ paddingVertical: t.space.md, gap: t.space.sm }}>
              <View style={{ flexDirection: 'row', gap: t.space.md }}>
                <IconTile tone="accept" icon={(c) => <BasketIcon color={c} size={22} />} />
                <View style={{ flex: 1, gap: t.space.xxs }}>
                  <Pressable accessibilityRole="button" testID={`sale-date-${r.id}`} onPress={toggleEra} hitSlop={8}>
                    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                      {r.startedTs ? formatThaiDate(r.startedTs, era) : ''}
                    </Text>
                  </Pressable>
                  {r.buyer ? <IconLine icon={(c) => <UsersIcon color={c} size={13} />}>{r.buyer}</IconLine> : null}
                  <IconLine icon={(c) => <BasketIcon color={c} size={13} />}>{msg('sales.baskets', { n: r.baskets })}</IconLine>
                </View>
                <View style={{ alignItems: 'flex-end', gap: t.space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                    <LeafIcon color={t.color.inkSoft} size={14} />
                    <Text testID={`sale-kg-${r.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
                      {msg('v2f.kg', { n: kgText(r.netG) })}
                    </Text>
                  </View>
                  <Chip tone={r.closed ? 'accept' : 'warn'} label={msg(r.closed ? 'status.closed' : 'sales.weighing')} testID={`sale-status-${r.id}`} />
                </View>
              </View>
              {r.tappers.length || r.unassignedG ? (
                <View style={{ marginLeft: t.target.min + t.space.md, borderLeftWidth: t.border.thick, borderLeftColor: t.color.ruleFaint, paddingLeft: t.space.md, gap: t.space.xxs }}>
                  {[...r.tappers, ...(r.unassignedG ? [{ id: '', name: msg('rec.noTapper'), netG: r.unassignedG }] : [])].map((tp) => (
                    <View key={tp.id || 'none'} testID={`sale-tapper-${r.id}-${tp.id || 'none'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                      <TapperIcon color={toneColours(t, tapperTone(data.master, tp.id || null)).fg} size={14} />
                      <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.ink }}>{tp.name}</Text>
                      <LeafIcon color={t.color.inkSoft} size={12} />
                      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
                        {msg('v2f.kg', { n: kgText(tp.netG) })}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          ))}
        </RowCard>
      ) : null}
      {data && data.rows.length ? (
        <Banner lines={[msg('v2s.listInfo1'), msg('v2s.listInfo2'), msg(era === 'be' ? 'v2s.listInfoBe' : 'v2s.listInfoCe')]} />
      ) : null}
    </FarmScreen>
  );
}
