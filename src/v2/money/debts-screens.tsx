/**
 * บัญชีหนี้คนงาน — v1.1.0 farm mockup section 8 (E06-S03 · D-59, D-69,
 * D-72), rebuilt on src/ui (D-82):
 *
 * - DebtsScreen (/v2/debts): every worker with a debt account, and the
 *   people to start one for.
 * - DebtAccountScreen (/v2/debt/<workerId>, screen 22): balance hero with the
 *   instalment plan, the reconciliation (Σ debts by kind − Σ repaid by route
 *   = balance, with a computed ✓), debts with other lenders (shown, never
 *   deducted), and the history with filters and void/restore.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { projectDebts, type DebtAccount, type HistoryLine } from '../../core/finance/debts';
import { formatSatang, parseBahtToSatang, satangToInput } from '../../core/finance/money';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import {
  AppText,
  Button,
  CalendarIcon,
  Card,
  CardLabel,
  Check,
  ChevronRight,
  CTA,
  DebtIcon,
  FactRow,
  IconTile,
  MoneyOutIcon,
  PersonIcon,
  PinnedActions,
  Plus,
  ReceiptIcon,
  ScreenHeader,
  TextField,
} from '../../ui';
import { V2_HOME } from '../routes';
import { orderHref } from './order-routes';
import { ChoiceChip, ChoiceRow, Day } from './pieces';

type Filter = 'all' | HistoryLine['type'];
const FILTERS: readonly Filter[] = ['all', 'loan', 'fertilizer', 'other', 'deduction', 'payment'];
const MINUS = '−';

export function DebtsScreen() {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const counts = useSaleCounts();
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    peopleStore.list().then((l) => setPeople(l.map((p) => ({ id: p.id, name: p.name }))), () => setPeople([]));
  }, []);
  const accounts = useMemo(() => [...projectDebts(fin.events ?? [], counts).values()], [fin.events, counts]);
  const open = (id: string, name: string) => router.push({ pathname: '/v2/debt/[workerId]', params: { workerId: id, name } });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('debt.list.title')} back={{ label: msg('v2.back'), href: V2_HOME, testID: 'debts-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md }}>
        {accounts.length === 0 ? <AppText variant="bodySm" testID="debts-empty">{msg('debt.list.empty')}</AppText> : null}
        {accounts.length ? (
          <Card style={{ gap: 0, paddingVertical: t.space.xs }}>
            {accounts.map((a, i) => (
              <Pressable
                key={a.worker.id}
                testID={`debt-account-${a.worker.id}`}
                accessibilityRole="button"
                onPress={() => open(a.worker.id, a.worker.name)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.sm, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint }}
              >
                <IconTile tone="category2" icon={(c) => <PersonIcon color={c} />} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" style={{ fontSize: t.font.size.bodyLg }}>{a.worker.name}</AppText>
                  <FactRow icon={(c) => <DebtIcon color={c} size={14} />}>
                    {a.balanceSatang < 0 ? `${msg('debt.farmOwes', { name: a.worker.name })} ${formatSatang(-a.balanceSatang)}` : msg('debt.list.owes', { amount: formatSatang(a.balanceSatang) })}
                  </FactRow>
                  {a.planPerSaleSatang != null ? <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>{msg('debt.planValue', { amount: formatSatang(a.planPerSaleSatang) })}</FactRow> : null}
                  {a.others.map((o) => (
                    <FactRow key={o.lender.id} icon={(c) => <PersonIcon color={c} size={14} />}>{msg('v2m.otherLender', { name: o.lender.name, amount: formatSatang(o.balanceSatang) })}</FactRow>
                  ))}
                  {a.overpaid ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.reject }}>{msg('debt.flag')}</Text> : null}
                </View>
                <ChevronRight color={t.color.inkSoft} />
              </Pressable>
            ))}
          </Card>
        ) : null}
        <CardLabel>{msg('debt.list.pick')}</CardLabel>
        <ChoiceRow>
          {people.map((p) => <ChoiceChip key={p.id} testID={`debt-person-${p.id}`} label={p.name} onPress={() => open(p.id, p.name)} />)}
        </ChoiceRow>
      </ScrollView>
    </View>
  );
}

export function DebtAccountScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name?: string }>();
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const counts = useSaleCounts();
  const account = useMemo(() => projectDebts(fin.events ?? [], counts).get(workerId), [fin.events, counts, workerId]);
  const worker = account?.worker ?? { id: workerId, name: name ?? '' };
  const params = { workerId, name: worker.name };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('v2m.debtTitle')} subtitle={worker.name} back={{ label: msg('v2.back'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/v2/debts')), testID: 'debt-back' }} sync={sync} />
      {fin.events === null ? <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('counter.loading')}</AppText> : <Account account={account} worker={worker} fin={fin} />}
      <PinnedActions>
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <CTA testID="debt-add" icon={(c) => <Plus color={c} />} onPress={() => router.push({ pathname: '/v2/debt-add', params })}>{msg('debt.add')}</CTA>
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="debt-pay" size="large" icon={(c) => <MoneyOutIcon color={c} />} onPress={() => router.push({ pathname: '/v2/debt-pay', params })}>{msg('debt.pay')}</Button>
          </View>
        </View>
      </PinnedActions>
    </View>
  );
}

function Account({ account, worker, fin }: { account: DebtAccount | undefined; worker: { id: string; name: string }; fin: ReturnType<typeof useFinance> }) {
  const t = useTheme();
  const msg = useT();
  const inFlight = useInFlight();
  const [filter, setFilter] = useState<Filter>('all');
  const [planDraft, setPlanDraft] = useState<string | null>(null);
  const planEvents = (fin.events ?? []).filter((e) => e.targetId === `plan-${worker.id}`);
  const balance = account?.balanceSatang ?? 0;
  const s = account?.summary;

  const savePlan = (perSaleSatang: number | null) =>
    inFlight.run(async () => {
      const heads = planEvents.filter((e) => !planEvents.some((o) => o.baseEventId === e.id)).map((e) => e.id).sort();
      await fin.write(`plan-${worker.id}`, heads.length ? heads[heads.length - 1] : null, { t: 'debt_plan_set', worker, perSaleSatang });
      setPlanDraft(null);
    });

  const voidLine = async (line: HistoryLine, deleted: boolean) => {
    const d = account?.debts.find((x) => x.id === line.id);
    if (d) return fin.write(d.id, d.headEventId, { t: 'debt_changed', patch: { deleted } });
    const p = account?.payments.find((x) => x.id === line.id);
    if (p) return fin.write(p.id, p.headEventId, { t: 'debt_payment_changed', patch: { deleted } });
  };

  const sourceOf = (h: HistoryLine) => account?.debts.find((d) => d.id === h.id)?.expenseId;
  const openSource = (expenseId: string) => {
    const x = fin.state?.expenses.find((e) => e.id === expenseId);
    // A deleted purchase opens in the expense form: restore lives there, not in the order page.
    if (!x?.deleted && (x?.fertilizer || x?.share?.totalSacks != null)) router.push(orderHref(x.orderId ?? expenseId));
    else router.push({ pathname: '/v2/expense/[id]', params: { id: expenseId } });
  };
  const lines = (account?.history ?? []).filter((h) => filter === 'all' || h.type === filter);
  return (
    <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space[16] * 2 }}>
      <Card style={{ alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <AppText variant="bodySm">{balance < 0 ? msg('debt.farmOwes', { name: worker.name }) : msg('debt.balance', { name: worker.name })}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
            <Text testID="debt-balance" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
              {formatSatang(Math.abs(balance))}
            </Text>
            <AppText>{msg('v2m.baht')}</AppText>
          </View>
          {account?.overpaid ? <Text testID="debt-flag" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.reject }}>{msg('debt.flag')}</Text> : null}
        </View>
        {planDraft === null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, marginTop: t.space.sm }}>
            <IconTile tone="category1" icon={(c) => <CalendarIcon color={c} />} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodySm">{msg('debt.plan')}</AppText>
              <AppText testID="debt-plan" style={{ fontWeight: t.font.weight.bold }}>
                {account?.planPerSaleSatang != null ? msg('debt.planValue', { amount: formatSatang(account.planPerSaleSatang) }) : msg('debt.planNone')}
              </AppText>
            </View>
            <Button testID="debt-plan-edit" variant="ghost" onPress={() => setPlanDraft(account?.planPerSaleSatang != null ? satangToInput(account.planPerSaleSatang) : '')}>{msg('debt.planEdit')}</Button>
          </View>
        ) : (
          <View style={{ gap: t.space.sm, marginTop: t.space.sm }}>
            <TextField testID="debt-plan-amount" label={msg('debt.plan')} keyboardType="decimal-pad" value={planDraft} onChangeText={setPlanDraft} helper={msg('v2m.perSale')} />
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              {account?.planPerSaleSatang != null ? <Button testID="debt-plan-cancel" variant="destructive" onPress={() => void savePlan(null)}>{msg('debt.planCancel')}</Button> : null}
              <Button testID="debt-plan-save" disabled={!parseBahtToSatang(planDraft) || inFlight.busy} onPress={() => void savePlan(parseBahtToSatang(planDraft))}>{msg('common.save')}</Button>
            </View>
          </View>
        )}
      </Card>

      {s ? (
        <Card testID="debt-summary">
          <CardLabel>{msg('debt.summary')}</CardLabel>
          <Sub>{msg('debt.sum.owedTitle')}</Sub>
          <SumLine label={msg('debt.kind.loan')} value={s.owed.loan} sign="+" />
          <SumLine label={msg('debt.kind.fertilizer')} value={s.owed.fertilizer} sign="+" />
          <SumLine label={msg('debt.kind.other')} value={s.owed.other} sign="+" />
          <Sub>{msg('debt.sum.deductTitle')}</Sub>
          <SumLine label={msg('debt.method.cash-from-share')} value={s.deducted['cash-from-share']} sign={MINUS} />
          <SumLine label={msg('debt.method.buyer-split')} value={s.deducted['buyer-split']} sign={MINUS} />
          <SumLine label={msg('debt.method.transfer-with-owner')} value={s.deducted['transfer-with-owner']} sign={MINUS} />
          <SumLine label={msg('debt.method.netting')} value={s.deducted.netting} sign={MINUS} />
          <Sub>{msg('debt.sum.outsideTitle')}</Sub>
          <SumLine label={msg('debt.method.outside')} value={s.outside} sign={MINUS} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm, marginTop: t.space.xs }}>
            <AppText style={{ flex: 1 }}>{msg('debt.sum.balance')}</AppText>
            <AppText testID="debt-summary-balance" style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{formatSatang(s.balanceSatang)}</AppText>
            {s.balanceSatang === balance ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.acceptSunk }}>
                <Check color={t.color.accept} />
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('debt.sum.match')}</Text>
              </View>
            ) : (
              <Text style={{ color: t.color.reject }}>✗</Text>
            )}
          </View>
        </Card>
      ) : null}

      <Card>
        <CardLabel>{msg('debt.others')}</CardLabel>
        {account?.others.length ? (
          account.others.map((o) => (
            <View key={o.lender.id} testID={`debt-other-${o.lender.id}`} style={{ flexDirection: 'row' }}>
              <AppText style={{ flex: 1 }}>{o.lender.name}</AppText>
              <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{formatSatang(o.balanceSatang)}</AppText>
            </View>
          ))
        ) : (
          <AppText variant="bodySm">{msg('v2m.noOthers', { name: worker.name })}</AppText>
        )}
      </Card>

      <CardLabel>{msg('debt.history')}</CardLabel>
      <ChoiceRow>
        {FILTERS.map((f) => <ChoiceChip key={f} testID={`debt-filter-${f}`} on={filter === f} label={f === 'all' ? msg('debt.history.all') : msg(`debt.kind.${f}`)} onPress={() => setFilter(f)} />)}
      </ChoiceRow>
      {lines.length ? (
        <Card style={{ gap: 0, paddingVertical: t.space.xs }}>
          {lines.map((h, i) => (
            <View key={h.id} testID={`debt-line-${h.id}`} style={{ gap: 2, paddingVertical: t.space.sm, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint, opacity: h.deleted ? t.opacity.muted : 1 }}>
              <View style={{ flexDirection: 'row' }}>
                <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, textDecorationLine: h.deleted ? 'line-through' : 'none' }}>{msg(`debt.kind.${h.type}`)}</AppText>
                <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{`${h.signedSatang >= 0 ? '+' : MINUS}${formatSatang(Math.abs(h.signedSatang))}`}</AppText>
              </View>
              <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>
                <Day iso={h.date} />
              </FactRow>
              {h.saleId ? <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{`${msg('debt.history.sale')} ${h.saleId}`}</FactRow> : null}
              {h.type === 'loan' && h.creditor.name ? <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{msg('debt.history.lender', { name: h.creditor.name })}</FactRow> : null}
              {h.deleted ? <AppText variant="caption">{msg('debt.history.voided')}</AppText> : null}
              <View style={{ alignItems: 'flex-start' }}>
                {sourceOf(h) ? (
                  // A share debt is a projection of its expense: void, restore or edit it there (E11-S10).
                  <Button testID={`debt-open-${h.id}`} variant="ghost" onPress={() => openSource(sourceOf(h)!)}>{msg('debt.history.openExpense')}</Button>
                ) : (
                  <Button testID={`debt-void-${h.id}`} variant={h.deleted ? 'ghost' : 'destructive'} onPress={() => void voidLine(h, !h.deleted)}>
                    {h.deleted ? msg('debt.history.restore') : msg('debt.history.void')}
                  </Button>
                )}
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function SumLine({ label, value, sign }: { label: string; value: number; sign: '+' | '−' }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      <AppText variant="bodySm" style={{ flex: 1, color: t.color.ink }}>{`${sign} ${label}`}</AppText>
      <AppText variant="bodySm" style={{ color: t.color.ink, fontVariant: ['tabular-nums'] }}>{formatSatang(value)}</AppText>
    </View>
  );
}

function Sub({ children }: { children: string }) {
  const t = useTheme();
  return <AppText variant="caption" style={{ fontWeight: t.font.weight.bold, marginTop: t.space.xs }}>{children}</AppText>;
}
