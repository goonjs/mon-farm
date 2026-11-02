/**
 * E05-S11 · "ที่มาของเงินแต่ละก้อน" (mockup A8, A14, A25 · CO-9, D-85): the
 * three checks — ① shares + farm = sale, ② debt moves ↘ (and netting ↗)
 * sum to 0, ③ rounding sums to 0 — and the money the buyer really pays.
 * Every line and every ok comes from core's `sourcesSheet`.
 *
 * Lines with party 'farm' are the farm's side ("สวน"); in ② a farm ↗ line
 * carries the tapper's name.
 *
 * E06-S08 (P2 · PR-20, D-87): given `owes` (the payment page passes its
 * sale's), money that came in short adds "ได้จริง" and "คนซื้อค้างสวน" under
 * the paid Σ, so ได้จริง + คนซื้อค้างสวน = ยอดขาย to the satang. The summary
 * (before close) passes nothing and reads as before.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { CloseoutPlan, SourcesSheet as Sources } from '../../../core/finance/closeout';
import type { BuyerOwes } from '../../../core/finance/pending-repays';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, cardStyle, Check } from '../../../ui';
import { signed } from '../person-money';
import { baht, Line, MARK, shortBaht, WarnMark } from './summary-parts';

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
          {ok ? <Check color={t.color.accept} size={11} /> : <WarnMark color={t.color.warn} size={14} />}
          <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold, color: ok ? t.color.accept : t.color.warn }}>{ok ? okText : msg('co.src.off')}</AppText>
        </View>
      </View>
      {children}
    </View>
  );
}

export function SourcesSheet({
  src,
  plan,
  saleTotalSatang,
  owes,
  onClose,
}: {
  src: Sources;
  plan: CloseoutPlan;
  saleTotalSatang: number;
  /** What the buyer still owes the farm on this sale (E06-S08); absent = nothing shown. */
  owes?: BuyerOwes;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const allOk = src.shares.ok && src.debt.ok && src.rounding.ok && src.paid.ok;
  const paidSum = src.paid.lines.reduce((a, l) => a + l.satang, 0);
  const short = owes && owes.totalSatang > 0 ? owes : null;
  const owesDetail = short
    ? [
        ...(short.transferSatang > 0 ? [msg('rp.src.owesTransfer', { amount: baht(short.transferSatang) })] : []),
        ...short.cash.map((c) => msg('rp.src.owesCash', { name: plan.workers.find((w) => w.id === c.workerId)?.name ?? '', amount: baht(c.satang) })),
      ].join(' · ')
    : '';
  const netted = src.debt.nettedSatang > 0;
  const debtLabel = (l: Sources['debt']['lines'][number]) => {
    if (l.party === 'worker') return `${l.name} ${MARK[l.way]} ${l.way === 'in' ? msg('co.src.payDebt') : msg('co.src.gotBack')}`;
    // A8: one "↘ สวนรับคืนหนี้" row; with netting (A25) the farm is named and its ↗ rows follow.
    if (l.way === 'in') return netted ? `${msg('co.src.farm')} ${MARK.in} ${msg('co.src.farmInNet')}` : `${MARK.in} ${msg('co.src.farmGot')}`;
    return `${msg('co.src.farm')} ${MARK.out} ${msg('co.src.farmOut', { name: l.name })}`;
  };
  const debtSub = !src.debt.lines.length
    ? msg('co.src.noDebt')
    : `${msg('co.src.notSale')} · ${
        netted
          ? msg('co.src.downNet', { down: shortBaht(src.debt.downSatang), got: shortBaht(src.debt.receivedSatang), net: shortBaht(src.debt.nettedSatang) })
          : msg('co.src.down', { down: shortBaht(src.debt.downSatang), got: shortBaht(src.debt.receivedSatang) })
      }`;
  const tr = src.paid.transfer;
  const paidLabel = (l: Sources['paid']['lines'][number]) =>
    l.kind === 'transfer' ? `${MARK.swap} ${msg('co.src.transfer')}` : l.kind === 'repay-cash' ? msg('co.src.repayCash', { name: l.name }) : msg('co.src.cash', { name: l.name });
  const tone = (way: 'in' | 'out') => (way === 'in' ? t.color.debtIn : t.color.debtOut);
  return (
    <BottomSheet open onClose={onClose} title={msg('co.src.title')} testID="co-sources-sheet" closeLabel={msg('co.close')}>
      <Box testID="co-src-shares" n={1} title={msg('co.src.shares')} ok={src.shares.ok} okText={msg('co.src.sharesOk')}>
        {src.shares.lines.map((l) => (
          <Line key={l.id} label={msg('co.src.shareOf', { name: l.name })} value={baht(l.satang)} />
        ))}
        <Line label={msg('co.src.farmPart')} value={baht(src.shares.ownerSatang)} />
        <Line strong tone={t.color.ink} label={msg('co.src.total')} value={baht(src.shares.lines.reduce((a, l) => a + l.satang, src.shares.ownerSatang))} />
      </Box>

      <Box testID="co-src-debt" n={2} title={`${MARK.in} ${msg('co.src.debt')}`} ok={src.debt.ok} okText={msg('co.src.debtOk')}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{debtSub}</AppText>
        {src.debt.lines.map((l, i) => (
          <Line key={`${l.id}-${l.way}-${i}`} label={debtLabel(l)} value={signed(l.satang)} tone={l.way === 'out' ? tone('out') : undefined} valueTone={tone(l.way)} />
        ))}
      </Box>

      <Box testID="co-src-rounding" n={3} title={msg('co.src.round', { mode: msg(`co.round.${plan.rounding}` as 'co.round.worker') })} ok={src.rounding.ok} okText={msg('co.src.roundOk')}>
        {src.rounding.lines.length ? (
          src.rounding.lines.map((l) => <Line key={l.id} label={l.party === 'farm' ? msg('co.src.farm') : l.name} value={signed(l.satang)} />)
        ) : (
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.src.noRound')}</AppText>
        )}
      </Box>

      <Box testID="co-src-paid" tint title={msg('co.src.paid')} ok={src.paid.ok} okText={msg('co.src.sharesOk')}>
        {src.paid.lines.map((l, i) => (
          <View key={`${l.id}-${l.kind}-${i}`}>
            <Line label={paidLabel(l)} value={baht(l.satang)} />
            {l.kind === 'transfer' && (tr.repaySatang > 0 || tr.roundSatang !== 0) ? (
              <AppText testID="co-src-transfer-split" variant="bodySm" style={{ color: t.color.inkSoft }}>
                {msg('co.src.transferOwner', { owner: baht(tr.ownerShareSatang) })}
                {tr.roundSatang ? ` ${tr.roundSatang < 0 ? '−' : '+'} ${msg('co.src.transferRound', { amount: baht(Math.abs(tr.roundSatang)) })}` : ''}
                {tr.repaySatang ? (
                  <AppText testID="co-src-transfer-repay" variant="bodySm" style={{ color: t.color.debtIn }}>{` + ${MARK.in} ${msg('co.src.transferRepay', { repay: baht(tr.repaySatang) })}`}</AppText>
                ) : null}
              </AppText>
            ) : null}
          </View>
        ))}
        <Line strong tone={t.color.ink} label={`${MARK.sum} ${msg('co.src.sum')}`} value={baht(paidSum)} />
        {short ? (
          <>
            <Line testID="co-src-received" label={msg('rp.src.received')} value={baht(paidSum - short.totalSatang)} />
            <View testID="co-src-owes">
              <Line strong tone={t.color.warn} valueTone={t.color.warn} label={msg('rp.src.owes')} value={baht(short.totalSatang)} />
              <AppText testID="co-src-owes-detail" variant="bodySm" style={{ color: t.color.inkSoft }}>{owesDetail}</AppText>
            </View>
          </>
        ) : null}
      </Box>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: allOk ? t.color.acceptSunk : t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md }}>
        {allOk ? <Check color={t.color.accept} size={12} /> : <WarnMark color={t.color.warn} size={16} />}
        <AppText testID={allOk && short ? 'co-src-equation' : undefined} style={{ flex: 1, fontWeight: t.font.weight.bold }}>
          {allOk && short ? msg('rp.src.equation') : allOk ? msg('co.src.allOk') : msg(plan.tally.diffSatang < 0 ? 'co.tally.short' : 'co.tally.over', { amount: baht(Math.abs(plan.tally.diffSatang)) })}
        </AppText>
      </View>
      {/* the sale total, for the eye: the paid Σ above must equal it */}
      <AppText variant="bodySm" style={{ color: t.color.inkSoft, textAlign: 'right' }}>{`${msg('v2s.saleToday')} ${baht(saleTotalSatang)}`}</AppText>
    </BottomSheet>
  );
}
