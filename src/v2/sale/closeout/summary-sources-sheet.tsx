/**
 * E05-S11 · "ที่มาของเงินแต่ละก้อน" (mockup A8, A14, A25 · CO-9, D-85): the
 * three checks — ① shares + farm = sale, ② debt moves ↘ (and netting ↗)
 * sum to 0, ③ rounding sums to 0 — and the money the buyer really pays.
 * Every line and every ok comes from core's `sourcesSheet`.
 *
 * Lines whose id is the farm's (`FARM_FUNDS`, or `FARM_FUNDS:<worker>`) are
 * the farm's side; in ② a farm ↗ line carries the tapper's name.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { CloseoutPlan, SourcesSheet as Sources } from '../../../core/finance/closeout';
import { FARM_FUNDS } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, AppText, BottomSheet, cardStyle, Check } from '../../../ui';
import { signed } from '../person-money';
import { baht, Line, MARK } from './summary-parts';

const isFarm = (id: string) => id === FARM_FUNDS || id.startsWith(`${FARM_FUNDS}:`);

/** ① ② ③ drawn as a ringed numeral (the catalogue has no circled digits). */
function No({ n }: { n: number }) {
  const t = useTheme();
  return (
    <View aria-hidden style={{ width: 24, height: 24, borderRadius: t.radius.pill, borderWidth: t.border.thick, borderColor: t.color.ink, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.bodySm, lineHeight: t.font.size.bodySm + 2 }}>{n}</AppText>
    </View>
  );
}

function Box({ n, title, ok, okText, children, testID, tint }: { n?: number; title: string; ok: boolean; okText: string; children: ReactNode; testID: string; tint?: boolean }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={testID} style={{ ...cardStyle(t), backgroundColor: tint ? t.color.acceptSunk : t.color.surfaceRaised, padding: t.space.md, gap: t.space.xxs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.sm }}>
        {n ? <No n={n} /> : null}
        <AppText style={{ flexShrink: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{title}</AppText>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          {ok ? <Check color={t.color.accept} size={11} /> : <AlertIcon color={t.color.warn} size={14} />}
          <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold, color: ok ? t.color.accept : t.color.warn }}>{ok ? okText : msg('co.src.off')}</AppText>
        </View>
      </View>
      {children}
    </View>
  );
}

export function SourcesSheet({ src, plan, saleTotalSatang, onClose }: { src: Sources; plan: CloseoutPlan; saleTotalSatang: number; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const allOk = src.shares.ok && src.debt.ok && src.rounding.ok && src.paid.ok;
  const debtLabel = (l: Sources['debt']['lines'][number]) =>
    isFarm(l.id)
      ? `${msg('co.src.farm')} ${MARK[l.way]} ${l.way === 'in' ? msg('co.src.farmIn') : msg('co.src.farmOut', { name: l.name })}`
      : `${l.name} ${MARK[l.way]} ${l.way === 'in' ? msg('co.src.payDebt') : msg('co.src.gotBack')}`;
  const paidLabel = (l: Sources['paid']['lines'][number]) =>
    l.kind === 'transfer' ? `${MARK.swap} ${msg('co.src.transfer')}` : l.kind === 'repay-cash' ? msg('co.src.repayCash', { name: l.name }) : msg('co.src.cash', { name: l.name });
  const tone = (way: 'in' | 'out') => (way === 'in' ? t.color.debtIn : t.color.debtOut);
  return (
    <BottomSheet open onClose={onClose} title={msg('co.src.title')} testID="co-sources-sheet">
      <Box testID="co-src-shares" n={1} title={msg('co.src.shares')} ok={src.shares.ok} okText={msg('co.src.sharesOk')}>
        {src.shares.lines.map((l) => (
          <Line key={l.id} label={msg('co.src.shareOf', { name: l.name })} value={baht(l.satang)} />
        ))}
        <Line label={msg('co.src.farmPart')} value={baht(src.shares.ownerSatang)} />
        <Line strong tone={t.color.ink} label={msg('co.src.total')} value={baht(src.shares.lines.reduce((a, l) => a + l.satang, src.shares.ownerSatang))} />
      </Box>

      <Box testID="co-src-debt" n={2} title={`${MARK.in} ${msg('co.src.debt')}`} ok={src.debt.ok} okText={msg('co.src.debtOk')}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{src.debt.lines.length ? msg('co.src.notSale') : msg('co.src.noDebt')}</AppText>
        {src.debt.lines.map((l, i) => (
          <Line key={`${l.id}-${l.way}-${i}`} label={debtLabel(l)} value={signed(l.satang)} tone={l.way === 'out' ? tone('out') : undefined} valueTone={tone(l.way)} />
        ))}
      </Box>

      <Box testID="co-src-rounding" n={3} title={msg('co.src.round', { mode: msg(`co.round.${plan.rounding}` as 'co.round.worker') })} ok={src.rounding.ok} okText={msg('co.src.roundOk')}>
        {src.rounding.lines.length ? (
          src.rounding.lines.map((l) => <Line key={l.id} label={isFarm(l.id) ? msg('co.src.farm') : l.name} value={signed(l.satang)} />)
        ) : (
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.src.noRound')}</AppText>
        )}
      </Box>

      <Box testID="co-src-paid" tint title={msg('co.src.paid')} ok={src.paid.ok} okText={msg('co.src.sharesOk')}>
        {src.paid.lines.map((l, i) => (
          <View key={`${l.id}-${l.kind}-${i}`}>
            <Line label={paidLabel(l)} value={baht(l.satang)} />
            {l.kind === 'transfer' && plan.transferRepaySatang > 0 ? (
              <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{`${msg('co.src.transferOwner', { owner: baht(plan.ownerSatang) })} ${MARK.in} ${msg('co.src.transferRepay', { repay: baht(plan.transferRepaySatang) })}`}</AppText>
            ) : null}
          </View>
        ))}
        <Line strong tone={t.color.ink} label={`${MARK.sum} ${msg('co.src.sum')}`} value={baht(src.paid.lines.reduce((a, l) => a + l.satang, 0))} />
      </Box>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: allOk ? t.color.acceptSunk : t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md }}>
        {allOk ? <Check color={t.color.accept} size={12} /> : <AlertIcon color={t.color.warn} size={16} />}
        <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>
          {allOk ? msg('co.src.allOk') : msg(plan.tally.diffSatang < 0 ? 'co.tally.short' : 'co.tally.over', { amount: baht(Math.abs(plan.tally.diffSatang)) })}
        </AppText>
      </View>
      {/* the sale total, for the eye: the paid Σ above must equal it */}
      <AppText variant="bodySm" style={{ color: t.color.inkSoft, textAlign: 'right' }}>{`${msg('v2s.saleToday')} ${baht(saleTotalSatang)}`}</AppText>
    </BottomSheet>
  );
}
