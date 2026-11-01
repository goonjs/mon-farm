/**
 * E05-S11 · "รายละเอียดการขาย" (mockup A4 · CO-18): today's look kept as it
 * is — the sale card of pages 16/17 (weight, price, baskets, short baskets,
 * total, checked with the buyer) and the "แบ่งยอดขาย" block (each tapper's
 * share and the farm's part, adding up to the sale). Copied from
 * `money-screens.tsx` (`SaleFigures`, `SaleCard`, section ก) so that file
 * stays untouched until the old pages are removed (story dev notes, PR 3).
 */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { formatSatang } from '../../../core/finance/money';
import { tapperOn } from '../../../core/master';
import { basketList } from '../../../core/sale-points';
import type { Settlement } from '../../../core/settle';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, cardStyle, Check, IconTile, TapperIcon } from '../../../ui';
import type { TapperMoney } from '../../money/sale/use-sale-money';
import { IconLine, Kv, kgText, tapperTone, useSaleView } from '../pieces';

const baht = formatSatang;

function Big({ value, testID, size }: { value: string; testID?: string; size: number }) {
  const t = useTheme();
  return (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: size, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
      {value}
    </Text>
  );
}

function TotalRow({ label, value, testID, size }: { label: string; value: string; testID?: string; size: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm, marginTop: t.space.xs }}>
      <AppText style={{ flexShrink: 1, fontWeight: t.font.weight.bold }}>{label}</AppText>
      <Big value={value} testID={testID} size={size} />
    </View>
  );
}

function SaleFigures({ s, children }: { s: Settlement; children?: ReactNode }) {
  const msg = useT();
  const { events, master, day, nameOf } = useSaleView();
  const shorts = basketList(events).filter((r) => r.status === 'live' && r.short);
  const placeOf = (pointId: string) => {
    const pt = master?.points.find((p) => p.id === pointId);
    return `${master?.properties.find((f) => f.id === pt?.propertyId)?.name ?? ''} ${pt?.name ?? ''}`;
  };
  const ownerOf = (pointId: string) => {
    const id = master ? tapperOn(master, pointId, day) : null;
    return id ? nameOf(id) : '';
  };
  return (
    <>
      <Kv label={msg('v2s.weight')} value={msg('v2f.kg', { n: kgText(s.totals.netG) })} />
      <Kv label={msg('v2s.priceLabel')} value={msg('v2s.perKg', { price: baht(s.satangPerKg) })} />
      <Kv label={msg('v2s.basketCount')} value={msg('sales.baskets', { n: s.totals.baskets })} />
      <Kv label={msg('v2s.shortCount', { n: s.totals.shortBaskets })} value={msg('v2f.kg', { n: kgText(s.totals.shortNetG) })} />
      {shorts.map((r) => (
        <Kv
          key={r.id}
          indent
          tone="muted"
          label={ownerOf(r.pointId) ? msg('v2s.shortAtBy', { place: placeOf(r.pointId), n: r.basketNo, name: ownerOf(r.pointId) }) : msg('v2s.shortAt', { place: placeOf(r.pointId), n: r.basketNo })}
          value={msg('v2f.kg', { n: kgText(r.netG) })}
        />
      ))}
      <TotalRow label={`${msg('v2s.saleTotal')} (${msg('v2s.bahtUnit')})`} value={baht(s.grossSatang)} size={26} />
      {children}
    </>
  );
}

export function SaleSheet({ s, tappers, checked, onClose }: { s: Settlement; tappers: readonly TapperMoney[]; checked: boolean; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const { master } = useSaleView();
  const farmOf = (personId: string) => s.perZone.filter((z) => z.personId === personId).reduce((a, z) => a + z.ownerSatang, 0);
  return (
    <BottomSheet open onClose={onClose} title={msg('co.sale.sheet')} testID="co-sale-sheet" closeLabel={msg('co.close')}>
      <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
        <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.saleToday')}</AppText>
        <SaleFigures s={s}>{checked ? <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.checkedWithBuyer')}</IconLine> : null}</SaleFigures>
      </View>

      <AppText testID="co-sale-split" variant="label">{msg('co.sale.split')}</AppText>
      <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
        {tappers.map((tp, i) => {
          const z = s.perZone.find((x) => x.personId === tp.id);
          return (
            <View key={tp.id} style={{ gap: t.space.xxs, marginTop: i ? t.space.sm : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, flexWrap: 'wrap' }}>
                {master ? <IconTile tone={tapperTone(master, tp.id)} icon={(c) => <TapperIcon color={c} size={16} />} /> : null}
                <AppText style={{ fontWeight: t.font.weight.bold }}>{tp.name}</AppText>
                <AppText variant="caption">{msg('v2s.soldBy', { kg: kgText(tp.netG), amount: baht(tp.grossSatang) })}</AppText>
              </View>
              <Kv label={msg('v2s.shareOf', { name: tp.name, pct: z ? 100 - z.ownerPct : tp.pct })} value={baht(tp.shareSatang)} />
              <Kv label={msg('v2s.farmPart')} value={baht(farmOf(tp.id))} />
            </View>
          );
        })}
        <Kv tone="total" label={msg('v2s.sumShares')} value={baht(tappers.reduce((a, tp) => a + tp.shareSatang, 0))} />
        <Kv label={msg('v2s.sumFarm')} value={baht(s.ownerSatang)} />
        <TotalRow label={msg('v2s.sumSale')} value={baht(s.grossSatang)} size={24} />
      </View>
    </BottomSheet>
  );
}
