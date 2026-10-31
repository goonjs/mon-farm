/**
 * E05-S11 · จัดเงินสดกับคนรับซื้อยาง (CO-19, CO-23, CO-24; mockup A6, A11,
 * A13, A17). One small card: how each deducted worker's repayment is
 * received (โอนรวม · คนซื้อแยกเงินสด · หยิบจากเงิน{ชื่อ}) and — only when
 * someone's cash has satang — the rounding; then what the buyer pays, which
 * adds up to the sale. Every choice changes the in-memory draft only
 * (`useCloseout().update`); nothing is written until "ยืนยันยอด" on the
 * summary. The first-time defaults come from the device preference inside
 * `useCloseout` (CO-23).
 */

import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { breakPlan, REPAY_ROUTES, ROUNDING_MENU, type CloseoutWorker, type RepayRoute } from '../../../core/finance/closeout';
import type { RoundingMode } from '../../../core/finance/deduct';
import { formatSatang } from '../../../core/finance/money';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, AppText, BottomSheet, Button, cardStyle, Check, SegmentedControl } from '../../../ui';
import { FarmScreen } from '../../farm/pieces';
import { bahtText } from '../pieces';
import { buyerPiles, NoteRow, transferRepayName } from './cash-pieces';
import { useCloseout } from './use-closeout';

const baht = formatSatang;

export function CloseoutCashScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const co = useCloseout();
  const [breakFor, setBreakFor] = useState<string | null>(null);
  const saleId = co.saleId;
  const title = msg('cop.title');
  const subtitle = msg('cop.subtitle');
  const fallback = `/v2/sale/${saleId}/settlement` as Href;
  if (!co.ready || !co.plan) return <FarmScreen title={title} subtitle={subtitle} fallback={fallback} />;

  const plan = co.plan;
  const deducted = plan.workers.filter((w) => w.routeSatang > 0);
  const setRoute = (id: string, route: RepayRoute) => co.update((d) => ({ ...d, workers: { ...d.workers, [id]: { ...d.workers[id], route } } }));
  const setRounding = (rounding: RoundingMode) => co.update((d) => ({ ...d, rounding }));
  const pileOf = (w: CloseoutWorker) => w.cashSatang + w.routeSatang;
  const breakOf = (w: CloseoutWorker) => (w.route === 'cash-from-share' ? breakPlan(pileOf(w), w.routeSatang) : null);
  const fractions = plan.workers.filter((w) => w.cashBeforeSatang % 100 !== 0).map((w) => msg('cop.hasFraction', { name: w.name, amount: baht(w.cashBeforeSatang % 100) }));
  const piles = buyerPiles(plan);
  const repayName = transferRepayName(plan);
  const breaking = breakFor ? plan.workers.find((w) => w.id === breakFor) : undefined;
  const bp = breaking ? breakOf(breaking) : null;
  const toBuyer = () => router.push(`/v2/sale/${saleId}/buyer-view` as Href);
  const ok = () => {
    co.update((d) => ({ ...d, cashStepDone: true }));
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
  const line = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, color: t.color.inkSoft } as const;
  const amount = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.ink, fontVariant: ['tabular-nums' as const], textAlign: 'right' as const };

  return (
    <FarmScreen
      title={title}
      subtitle={subtitle}
      fallback={fallback}
      testID="cop-cash"
      footer={
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button testID="cop-buyer-view" size="large" onPress={toBuyer}>
              {msg('cop.showBuyer')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="cop-ok" size="large" variant="primary" icon={(c) => <Check color={c} size={14} />} onPress={ok}>
              {msg('cop.ok')}
            </Button>
          </View>
        </View>
      }
      overlay={
        <BottomSheet open={!!breaking && !!bp} onClose={() => setBreakFor(null)} title={msg('cop.breakTitle')} testID="cop-break-sheet">
          {breaking && bp ? (
            <>
              <AppText variant="bodySm">{msg('cop.breakSub', { name: breaking.name, amount: bahtText(breaking.routeSatang) })}</AppText>
              <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.sm }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('cop.moneyOf', { name: breaking.name, amount: baht(pileOf(breaking)) })}</AppText>
                <NoteRow notes={bp.pile} testID="cop-break-pile" />
              </View>
              <View style={{ backgroundColor: t.color.actionSunk, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.sm }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('cop.farmTakes', { amount: bahtText(breaking.routeSatang) })}</AppText>
                <NoteRow notes={bp.take} testID="cop-break-take" />
                {bp.shortSatang > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                    <AlertIcon color={t.color.warn} size={14} />
                    <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.warn }}>
                      {msg('cop.smallShort', { small: baht(bp.smallSatang), short: baht(bp.shortSatang) })}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ backgroundColor: t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.sm }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('cop.askBreak')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
                  <NoteRow notes={[{ satang: bp.broken, count: 1 }]} />
                  <Text aria-hidden style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, color: t.color.inkSoft }}>→</Text>
                  <NoteRow notes={bp.into} fresh testID="cop-break-into" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button testID="cop-break-close" onPress={() => setBreakFor(null)}>
                    {msg('cop.close')}
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="cop-break-buyer" variant="primary" onPress={toBuyer}>
                    {msg('cop.showBuyer')}
                  </Button>
                </View>
              </View>
            </>
          ) : null}
        </BottomSheet>
      }
    >
      {deducted.length || plan.hasFraction ? (
        <View testID="cop-choices" style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.sm }}>
          {deducted.length ? (
            <View testID="cop-routes" style={{ gap: t.space.sm }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('cop.routesTitle')}</AppText>
              {deducted.map((w) => {
                const needs = !!breakOf(w);
                return (
                  <View key={w.id} style={{ gap: t.space.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, flexWrap: 'wrap' }}>
                      <Text testID={`cop-who-${w.id}`} style={{ flex: 1, minWidth: 140, ...line }}>
                        <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{w.name}</Text> {msg('cop.deducts', { amount: baht(w.routeSatang) })}
                      </Text>
                      {needs ? (
                        <Pressable
                          testID={`cop-break-${w.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={msg('cop.needBreak')}
                          onPress={() => setBreakFor(w.id)}
                          style={{ minHeight: t.target.min, justifyContent: 'center' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, backgroundColor: t.color.warnSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}>
                            <AlertIcon color={t.color.warn} size={14} />
                            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('cop.needBreak')}</Text>
                          </View>
                        </Pressable>
                      ) : null}
                    </View>
                    <SegmentedControl
                      testID={`cop-route-${w.id}`}
                      value={w.route}
                      onChange={(r) => setRoute(w.id, r)}
                      options={REPAY_ROUTES.map((r) => ({ value: r, label: msg(`cop.route.${r}` as const, { name: w.name }) }))}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
          {plan.hasFraction ? (
            <View style={{ gap: t.space.xs, ...(deducted.length ? { borderTopWidth: t.border.hair, borderTopColor: t.color.ruleStrong, borderStyle: 'dashed' as const, paddingTop: t.space.sm } : {}) }}>
              <Text testID="cop-round-title" style={line}>
                <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('cop.roundTitle')}</Text> {fractions.join(' · ')}
              </Text>
              <SegmentedControl testID="cop-round" value={plan.rounding} onChange={setRounding} options={ROUNDING_MENU.map((r) => ({ value: r, label: msg(`cop.round.${r}` as const) }))} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View testID="cop-pays" style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xs }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('cop.payTitle')}</AppText>
        {piles.map((p) =>
          p.kind === 'cash' ? (
            <View key={`cash-${p.id}`} testID={`cop-cash-${p.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm }}>
                <Text style={{ flexShrink: 1, ...line }}>{msg('cop.cashOf', { name: p.name })}</Text>
                <Text style={amount}>{baht(p.satang)}</Text>
              </View>
              {p.pickedSatang ? <Text style={{ ...line, fontSize: t.font.size.bodySm, color: t.color.debtIn }}>{msg('cop.pickedOf', { amount: baht(p.pickedSatang) })}</Text> : null}
            </View>
          ) : (
            <View key={`repay-${p.id}`} testID={`cop-split-${p.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm }}>
              <Text style={{ flexShrink: 1, ...line, color: t.color.debtIn }}>{msg('cop.splitOf', { name: p.name })}</Text>
              <Text style={{ ...amount, color: t.color.debtIn }}>{baht(p.satang)}</Text>
            </View>
          ),
        )}
        <View testID="cop-transfer">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm }}>
            <Text style={{ flexShrink: 1, ...line }}>{msg('cop.transfer')}</Text>
            <Text style={amount}>{baht(plan.transferSatang)}</Text>
          </View>
          {plan.transferRepaySatang ? (
            <Text testID="cop-transfer-split" style={{ ...line, fontSize: t.font.size.bodySm }}>
              {msg('cop.transferSplit', { owner: baht(plan.ownerSatang), name: repayName, repay: baht(plan.transferRepaySatang) })}
            </Text>
          ) : null}
        </View>
        <View
          testID="cop-total"
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm, marginTop: t.space.xs }}
        >
          <Text style={{ flexShrink: 1, ...line, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('cop.totalIsSale')}</Text>
          <Text style={{ ...amount, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.black }}>{baht(plan.tally.sumSatang)}</Text>
        </View>
        {plan.tally.ok ? null : (
          <Text testID="cop-off" style={{ ...line, color: t.color.warn, fontWeight: t.font.weight.bold }}>
            {msg('cop.offBy', { how: msg(plan.tally.diffSatang < 0 ? 'cop.short' : 'cop.over'), amount: baht(Math.abs(plan.tally.diffSatang)) })}
          </Text>
        )}
      </View>
    </FarmScreen>
  );
}
