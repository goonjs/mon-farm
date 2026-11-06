/**
 * E06-S09 PR-c · the instalment plan on the debt account (mockup band ค, D4 · IP-17…IP-22).
 *
 * - PlanBadge: the debt list's line — "ผ่อนงวด 2/3 · งวดละ ฿ 4,267", "ไม่ผ่อน · หักเต็มส่วนแบ่ง", or a per-sale plan.
 * - PlanCard: the account's plan — the whole card is the tap target with › (rule 11, no round "แก้"):
 *   "ผ่อน 3 งวด · จ่ายแล้ว 1 งวด", one bar segment per instalment, next / last. A plan whose instalments ran
 *   out with debt left is a yellow alert with the figure only (IP-20, no explaining sentence).
 * - PlanSheet: pick "จำนวนงวด" (choices as at close-out, IP-7, counted from the next sale and keeping what
 *   was paid) or "บาท / การขาย" (the older plan, IP-22); "ยกเลิกแผน" ends either. It replaces the older
 *   inline editor, which saved a per-sale amount over an instalment plan (review round 2).
 *
 * Figures are core's (`accountPlan`, `installmentAmount`), never worked out here.
 */

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { debtPieces } from '../../core/finance/closeout';
import type { DebtAccount } from '../../core/finance/debts';
import { accountPlan, accountPlanPayload, installmentAmount, installmentChoices, type AccountPlan } from '../../core/finance/installments';
import { formatDate, formatSatang } from '../../core/finance/money';
import type { FinanceEvent, FinancePayload } from '../../core/finance/types';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, CalendarIcon, ChevronRight, CompactMoney, FactRow, FarmMateArt, IconTile, MoneyField, SegmentedControl } from '../../ui';
import { Choice, CountChoice } from '../sale/closeout/summary-installments';
import { WarnMark } from '../sale/closeout/summary-parts';

const shortDate = (iso: string) => formatDate(iso).split(' ').slice(0, 2).join(' ');

export function usePlan(account: DebtAccount | undefined, events: readonly FinanceEvent[]): AccountPlan | null {
  return useMemo(() => (account ? accountPlan({ account, events }) : null), [account, events]);
}

/** IP-17 · the debt list line. Nothing for someone who owes nothing. */
export function PlanBadge({ account, events, testID }: { account: DebtAccount; events: readonly FinanceEvent[]; testID?: string }) {
  const t = useTheme();
  const msg = useT();
  const plan = usePlan(account, events);
  if (account.balanceSatang <= 0) return null;
  const icon = (c: string) => <CalendarIcon color={c} size={14} />;
  if (!plan) return <FactRow testID={testID} icon={icon}>{msg('debt.inst.none')}</FactRow>;
  if (plan.kind === 'perSale') {
    // Review PR-c 5: a summary line's money is compact (summary-lines rule).
    return (
      <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
        <CalendarIcon color={t.color.inkSoft} size={14} />
        <CompactMoney satang={plan.perSaleSatang} size="bodyLg" pill />
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{`/ ${msg('debt.history.sale')}`}</AppText>
      </View>
    );
  }
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
      <CalendarIcon color={plan.done ? t.color.warn : t.color.inkSoft} size={14} />
      <AppText variant="bodySm" style={{ color: plan.done ? t.color.warn : t.color.inkSoft, fontWeight: plan.done ? t.font.weight.bold : t.font.weight.regular }}>
        {plan.done ? msg('debt.inst.doneBadge', { m: plan.count }) : msg('debt.inst.badge', { n: plan.number, m: plan.count })}
      </AppText>
      <CompactMoney satang={plan.done ? plan.leftoverSatang : (plan.nextSatang ?? 0)} size="bodyLg" pill />
    </View>
  );
}

/** IP-18 / IP-20 · the account's plan card; the whole card opens the plan sheet. */
export function PlanCard({ account, events, onOpen }: { account: DebtAccount | undefined; events: readonly FinanceEvent[]; onOpen: () => void }) {
  const t = useTheme();
  const msg = useT();
  const plan = usePlan(account, events);
  if (plan?.kind === 'installments' && plan.done && account) {
    const pieces = debtPieces(account, '', 0);
    const oldest = pieces[0];
    return (
      <Pressable testID="debt-plan-done" accessibilityRole="button" onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md, minHeight: t.target.min }}>
        <WarnMark color={t.color.warn} size={16} />
        <View style={{ flex: 1, gap: t.space.xxs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
            <AppText style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('debt.inst.done', { m: plan.count })}</AppText>
            <CompactMoney satang={plan.leftoverSatang} size="bodyLg" pill />
          </View>
          {oldest ? <AppText variant="bodySm" style={{ color: t.color.ink }}>{msg('debt.inst.pieces', { n: pieces.length, kind: msg(`debt.kind.${oldest.kind}`), date: shortDate(oldest.date) })}</AppText> : null}
        </View>
        <ChevronRight color={t.color.warn} size={12} />
      </Pressable>
    );
  }
  return (
    <Pressable testID="debt-plan-row" accessibilityRole="button" onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, marginTop: t.space.sm, minHeight: t.target.min }}>
      <IconTile tone="category1" icon={() => <FarmMateArt id="farmwork.calendar" />} />
      <View style={{ flex: 1, gap: t.space.xxs }}>
        <AppText variant="bodySm">{msg('debt.plan')}</AppText>
        <AppText testID="debt-plan" style={{ fontWeight: t.font.weight.bold }}>
          {plan?.kind === 'installments'
            ? msg('debt.inst.card', { m: plan.count, n: plan.paid })
            : plan?.kind === 'perSale'
              ? msg('debt.planValue', { amount: formatSatang(plan.perSaleSatang) })
              : msg('debt.planNone')}
        </AppText>
        {plan?.kind === 'installments' ? (
          <>
            <View testID="debt-plan-bar" style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: plan.count }, (_, k) => (
                <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < plan.paid ? t.color.accept : t.color.ruleStrong }} />
              ))}
            </View>
            {plan.nextSatang !== null ? (
              <View testID="debt-plan-next" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
                <AppText variant="bodySm">{msg('debt.inst.next')}</AppText>
                <CompactMoney satang={plan.nextSatang} size="bodyLg" pill />
                {plan.lastSatang !== null && plan.count - plan.paid > 1 ? (
                  <>
                    <AppText variant="bodySm">{`· ${msg('debt.inst.last')}`}</AppText>
                    <CompactMoney satang={plan.lastSatang} size="bodyLg" pill />
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <ChevronRight color={t.color.inkSoft} size={12} />
    </Pressable>
  );
}

type Mode = 'count' | 'amount';

/** IP-19 · the plan sheet. `onSave` gets the plan payload (or a cancel); the caller writes it on the plan chain. */
export function PlanSheet({
  account,
  events,
  max,
  busy,
  onSave,
  onClose,
}: {
  account: DebtAccount;
  events: readonly FinanceEvent[];
  max: number;
  busy: boolean;
  onSave: (p: FinancePayload) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const plan = usePlan(account, events);
  const running = plan?.kind === 'installments' && !plan.done ? plan : null;
  const left = running ? running.count - running.paid : null;
  const balance = Math.max(0, account.balanceSatang);
  // Review PR-c 1: a count of instalments of nothing would be over at once (the next debt reads as new debt).
  const countOk = balance > 0;
  const [mode, setMode] = useState<Mode>(plan?.kind === 'perSale' || !countOk ? 'amount' : 'count');
  const [count, setCount] = useState<number | null>(null);
  const [per, setPer] = useState<number | null>(plan?.kind === 'perSale' ? plan.perSaleSatang : null);
  const choices = installmentChoices(left, max);
  const perOk = per !== null && per > 0;
  const canSave = !busy && (mode === 'count' ? count !== null : perOk);
  const save = () => {
    if (!canSave) return;
    onSave(mode === 'count' ? accountPlanPayload({ account, events, count: count! }) : { t: 'debt_plan_set', worker: account.worker, perSaleSatang: per! });
  };
  const sales = perOk ? Math.ceil(balance / per!) : 0;
  const lastPer = perOk ? balance - per! * (sales - 1) : 0;
  return (
    <BottomSheet open onClose={onClose} title={msg('debt.plan')} testID="debt-plan-sheet" closeLabel={msg('co.close')} action={{ label: msg('common.save'), testID: 'debt-plan-save', saving: busy, disabled: !canSave, onPress: save }}>
      <AppText variant="bodySm">{msg('debt.inst.sheetSub', { amount: formatSatang(balance) })}</AppText>
      {countOk ? (
        <SegmentedControl<Mode>
          testID="debt-plan-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'count', label: msg('debt.inst.byCount') },
            { value: 'amount', label: msg('debt.inst.byAmount') },
          ]}
        />
      ) : null}
      {mode === 'count' ? (
        <View style={{ gap: t.space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {choices.map((n) => (
              <Choice key={n} basis={88} testID={`debt-plan-count-${n}`} selected={count === n} onPress={() => setCount(n)}>
                <CountChoice n={n} perSatang={installmentAmount(balance, n)} />
              </Choice>
            ))}
          </View>
          <AppText variant="bodySm">{msg('debt.inst.maxNote', { n: max })}</AppText>
          {count !== null ? (
            <AppText testID="debt-plan-change" style={{ fontWeight: t.font.weight.bold }}>
              {left !== null
                ? msg('debt.inst.change', { old: left, n: count, amount: formatSatang(installmentAmount(balance, count) ?? 0) })
                : msg('debt.inst.newPlan', { n: count, amount: formatSatang(installmentAmount(balance, count) ?? 0) })}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: t.space.sm }}>
          <MoneyField testID="debt-plan-amount" label={msg('debt.plan')} unit={msg('v2m.perSale')} satang={per} onChange={(v) => setPer(v)} />
          {perOk && balance > 0 ? (
            <AppText testID="debt-plan-sales" variant="bodySm">
              {msg('debt.inst.perSaleLeft', { debt: formatSatang(balance), per: formatSatang(per!), n: sales, last: formatSatang(lastPer) })}
            </AppText>
          ) : null}
        </View>
      )}
      {plan ? (
        // An underlined text link, not an outlined word button (rule 11).
        <Pressable testID="debt-plan-cancel" accessibilityRole="button" disabled={busy} onPress={() => onSave({ t: 'debt_plan_set', worker: account.worker, perSaleSatang: null })} style={{ minHeight: t.target.min, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <AppText style={{ color: t.color.reject, fontWeight: t.font.weight.bold, textDecorationLine: 'underline' }}>{msg('debt.planCancel')}</AppText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}
