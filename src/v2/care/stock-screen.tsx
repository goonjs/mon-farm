/**
 * ปุ๋ยคงเหลือ (E16-S04): the fertilizer stock — no counting, no separate number. In = fertilizer order items
 * received and dated from 2026-10-01 (D-96); out = fertilizings. One row per card (type + price per sack,
 * D-92/D-94): what is left, the same number as "N ในสต็อก" on the fertilizing page (FL-1), and the orders
 * it came from. A card used past what was received carries a worded amber flag that opens the fertilizing
 * to fix (FL-3) — nothing is cut or changed by itself. Orders not received yet are one line apart.
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { orderedSacks, projectFertilizing, type FertilizerCard, type Fertilizing } from '../../core/finance/fertilizing';
import { fullPrice } from '../../core/finance/fertilizing-editor';
import { projectFinance } from '../../core/finance/ledger';
import { formatDate } from '../../core/finance/money';
import type { FinanceEvent } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, ChevronRight, FarmMateArt, ScreenHeader } from '../../ui';
import { fertilizingHref, ORDER_LIST } from './fertilizing/routes';

export function StockScreen() {
  const fin = useFinance();
  const sync = useSyncStatus();
  const msg = useT();
  const t = useTheme();
  if (!fin.events) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <ScreenHeader title={msg('stock.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'stock-back' }} sync={sync} />
        <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('fz.loading')}</AppText>
      </View>
    );
  }
  return <StockView events={fin.events} sync={sync} onOpen={(id) => router.push(fertilizingHref(id))} onOrders={() => router.push(ORDER_LIST)} onBack={leave} />;
}

export function StockView({
  events,
  sync,
  onOpen,
  onOrders,
  onBack,
}: {
  events: readonly FinanceEvent[];
  sync?: ReturnType<typeof useSyncStatus>;
  onOpen: (fertilizingId: string) => void;
  onOrders: () => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const { cards, records, ordered } = useMemo(() => {
    const { expenses } = projectFinance(events);
    const p = projectFertilizing(events, expenses);
    return { ...p, ordered: orderedSacks(expenses) };
  }, [events]);
  const shown = cards.filter((c) => c.leftSacks !== 0);
  // The fertilizing to fix: the latest live one that went past this card's stock.
  const overOn = (c: FertilizerCard): Fertilizing | undefined =>
    records.find((r) => !r.deleted && r.lines.some((l) => l.overSacks > 0 && l.cardKeys.includes(c.key)));

  return (
    <View testID="stock" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('stock.title')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'stock-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {shown.length === 0 ? (
          <View testID="stock-empty" style={{ alignItems: 'center', gap: t.space.sm, padding: t.space.xl, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised }}>
            <FarmMateArt id="materials.stock" size={56} />
            <AppText variant="heading" style={{ textAlign: 'center' }}>{msg('fz.empty.title')}</AppText>
            <AppText variant="bodySm" style={{ textAlign: 'center' }}>{msg('fz.empty.body')}</AppText>
          </View>
        ) : null}
        {shown.map((c, i) => {
          const over = overOn(c);
          return (
            <View key={c.key} testID={`stock-card-${i}`} style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.rule }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
                <View style={{ width: 52, height: 52, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, alignItems: 'center', justifyContent: 'center' }}>
                  <FarmMateArt id="materials.stock" size={40} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{c.formula}{c.brand ? ` ${c.brand}` : ''}</AppText>
                  <AppText variant="bodySm">
                    <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('fz.perSack', { price: fullPrice(c.perSackSatang) })}</Text>
                    {c.sackKg ? ` · ${msg('fz.kg', { kg: c.sackKg })}` : ''}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText testID={`stock-card-${i}-left`} variant="heading" style={{ fontVariant: ['tabular-nums'], color: c.leftSacks < 0 ? t.color.warn : t.color.ink }}>{String(c.leftSacks)}</AppText>
                  <AppText variant="bodySm">{msg('stock.left')}</AppText>
                </View>
              </View>
              <AppText variant="bodySm">{c.items.map((x) => `${x.shop || msg('stock.noShop')} ${formatDate(x.date).split(' ').slice(0, 2).join(' ')}`).join(' · ')}</AppText>
              {c.leftSacks < 0 ? (
                <Pressable
                  testID={`stock-card-${i}-over`}
                  accessibilityRole="button"
                  disabled={!over}
                  onPress={() => over && onOpen(over.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.target.min, paddingHorizontal: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.warnSunk }}
                >
                  <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('fz.over', { n: -c.leftSacks })}</Text>
                  {over ? <ChevronRight color={t.color.warn} /> : null}
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {ordered.length ? (
          <Pressable testID="stock-ordered" accessibilityRole="button" onPress={onOrders} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.rule }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('stock.ordered')}</AppText>
              <AppText variant="bodySm">{ordered.map((o) => `${o.formula} ${o.sacks} ${msg('fz.unit')}`).join(' · ')}</AppText>
            </View>
            <ChevronRight color={t.color.ink} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2');
}
