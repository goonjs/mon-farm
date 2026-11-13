/** One item of the order: name, qty, net amount, optional "ลด x" (E11-S17: the tell-later buttons moved to fertilizing). */

import { Pressable, Text, View } from 'react-native';

import { FERTILIZER_CATEGORY } from '../../../core/finance/fert-order';
import type { Expense } from '../../../core/finance/ledger';
import { formatSatang } from '../../../core/finance/money';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, Card, Chip } from '../../../ui';
import { itemSacks } from './tell';

export function ItemCard({ item, onEdit, onConflict }: { item: Expense; onEdit: () => void; onConflict: () => void }) {
  const t = useTheme();
  const msg = useT();
  const fert = item.categoryId === FERTILIZER_CATEGORY && item.fertilizer ? item.fertilizer : null;
  const qty = item.line ? msg('ordd.qty', { qty: item.line.qty, unit: item.line.unit }) : fert ? msg('ordd.qty', { qty: itemSacks(item), unit: msg('ordd.zones.unit') }) : '';

  return (
    <Card testID={`ordd-item-${item.id}`} style={{ gap: t.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{item.item}</AppText>
          {qty ? <AppText variant="bodySm">{qty}</AppText> : null}
          {(item.discountSatang ?? 0) > 0 ? <AppText testID={`ordd-item-${item.id}-discount`} variant="caption">{msg('ordd.discount', { amount: formatSatang(item.discountSatang ?? 0) })}</AppText> : null}
        </View>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink, flexShrink: 0 }}>
          {item.amountSatang === null ? '-' : formatSatang(item.amountSatang)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
        <Pressable testID={`ordd-${item.id}-edit`} accessibilityRole="button" onPress={onEdit} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('ordd.edit.link')}</Text>
        </Pressable>
        {item.conflicts.length > 0 ? (
          <Pressable testID={`ordd-${item.id}-conflict`} accessibilityRole="button" accessibilityLabel={msg('ordd.conflict')} onPress={onConflict} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
            <Chip tone="warn" label={msg('ordd.conflict')} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
