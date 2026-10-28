/** One item of the order: name, qty, net amount, optional "ลด x", and for fertilizer the three tell-later buttons. */

import { Pressable, Text, View } from 'react-native';

import { FERTILIZER_CATEGORY, type DetailKey } from '../../../core/finance/fert-order';
import type { Expense } from '../../../core/finance/ledger';
import { formatSatang } from '../../../core/finance/money';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, Card, Chip, LeafIcon, PinIcon, TapperIcon } from '../../../ui';
import { itemSacks } from './tell';

const KEYS: readonly DetailKey[] = ['reasons', 'zones', 'tappers'];
const ICONS = { reasons: LeafIcon, zones: PinIcon, tappers: TapperIcon } as const;

export function ItemCard({ item, missing, reasonName, onOpen, onEdit, onConflict }: { item: Expense; missing: readonly DetailKey[]; reasonName: (id: string) => string; onOpen: (k: DetailKey) => void; onEdit: () => void; onConflict: () => void }) {
  const t = useTheme();
  const msg = useT();
  const fert = item.categoryId === FERTILIZER_CATEGORY && item.fertilizer ? item.fertilizer : null;
  const qty = item.line ? msg('ordd.qty', { qty: item.line.qty, unit: item.line.unit }) : fert ? msg('ordd.qty', { qty: itemSacks(item), unit: msg('ordd.zones.unit') }) : '';

  const value = (k: DetailKey): string => {
    if (!fert) return '';
    if (k === 'reasons') {
      const [first, ...rest] = fert.reasons;
      return rest.length ? msg('ordd.btn.reasonsMore', { name: reasonName(first), n: rest.length }) : reasonName(first);
    }
    if (k === 'zones') return msg('ordd.btn.zonesDone', { placed: fert.zones.reduce((s, z) => s + z.sacks, 0), total: itemSacks(item) });
    return item.share && item.share.lines.length ? item.share.lines.map((l) => l.worker.name).join(' · ') : msg('ordd.btn.tappersNone');
  };

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
      {fert ? (
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          {KEYS.map((k) => {
            const told = !missing.includes(k);
            const Icon = ICONS[k];
            return (
              <Pressable
                key={k}
                testID={`ordd-${item.id}-${k}`}
                accessibilityRole="button"
                accessibilityLabel={`${msg(`ordd.btn.${k}`)} ${told ? value(k) : msg(`ordd.btn.${k}Add`)}`}
                accessibilityState={{ selected: told }}
                onPress={() => onOpen(k)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 72,
                  justifyContent: 'center',
                  gap: 2,
                  padding: t.space.sm,
                  borderRadius: t.radius.lg,
                  borderWidth: t.border.thick,
                  borderStyle: told ? 'solid' : 'dashed',
                  borderColor: told ? t.color.accept : t.color.ruleStrong,
                  backgroundColor: told ? t.color.acceptSunk : t.color.surface,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  <View aria-hidden><Icon color={told ? t.color.accept : t.color.inkSoft} size={16} /></View>
                  <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: t.color.inkSoft, flexShrink: 1 }}>{msg(`ordd.btn.${k}`)}</Text>
                </View>
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: told ? t.color.accept : t.color.ink, flexShrink: 1 }}>
                  {told ? value(k) : msg(`ordd.btn.${k}Add`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
