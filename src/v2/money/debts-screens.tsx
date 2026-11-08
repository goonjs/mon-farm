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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { projectDebts, type DebtAccount, type HistoryLine } from '../../core/finance/debts';
import { paymentStatus } from '../../core/finance/payments';
import { buyerOwes, PENDING_REPAY_SINCE, pendingRepayLines, type PendingHow } from '../../core/finance/pending-repays';
import { formatDate, formatSatang } from '../../core/finance/money';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useMaster } from '../farm/pieces';
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
  FarmMateArt,
  IconTile,
  MoneyOutIcon,
  PersonIcon,
  personArt,
  PinnedActions,
  Plus,
  ReceiptIcon,
  ScreenHeader,
  TextLink,
} from '../../ui';
import { V2_HOME } from '../routes';
import { orderHref } from './order-routes';
import { ChoiceChip, ChoiceRow, Day } from './pieces';
import { PlanBadge, PlanCard, PlanSheet } from './debt-plan';
import { maxInstallments } from '../../core/master';
import { accountPlan, DEFAULT_MAX_INSTALLMENTS } from '../../core/finance/installments';
import { FARM_FUNDS, type FinancePayload } from '../../core/finance/types';
import { ListChip, ListSummary, PendingCard, payeeOf, RepaySheet, UndoBar, type OpenRepay, type UndoInfo } from './repay-pieces';

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
  // Roles for the tiles come from the whole master, deleted people included (a tapper who left can still owe).
  const master = useMaster().state;
  useEffect(() => {
    peopleStore.list().then((l) => setPeople(l.map((p) => ({ id: p.id, name: p.name }))), () => setPeople([]));
  }, []);
  const byWorker = useMemo(() => projectDebts(fin.events ?? [], counts), [fin.events, counts]);
  const accounts = useMemo(() => [...byWorker.values()], [byWorker]);
  // E06-S08: repayments whose money has not come in yet (PR-4, PR-12).
  const pending = useMemo(() => pendingRepayLines(fin.events ?? [], byWorker), [fin.events, byWorker]);
  const open = (id: string, name: string) => router.push({ pathname: '/v2/debt/[workerId]', params: { workerId: id, name } });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('debt.list.title')} back={{ label: msg('v2.back'), href: V2_HOME, testID: 'debts-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md }}>
        <ListSummary lines={pending} />
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
                <IconTile tone="category2" icon={() => <FarmMateArt id={personArt(master?.people.find((p) => p.id === a.worker.id)?.roles)} />} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" style={{ fontSize: t.font.size.bodyLg }}>{a.worker.name}</AppText>
                  <FactRow icon={(c) => <DebtIcon color={c} size={14} />}>
                    {a.balanceSatang < 0 ? `${msg('debt.farmOwes', { name: a.worker.name })} ${formatSatang(-a.balanceSatang)}` : msg('debt.list.owes', { amount: formatSatang(a.balanceSatang) })}
                  </FactRow>
                  {/* E06-S09 IP-17 */}
                  <PlanBadge account={a} events={fin.events ?? []} testID={`debt-plan-badge-${a.worker.id}`} />
                  {a.others.map((o) => (
                    <FactRow key={o.lender.id} icon={(c) => <PersonIcon color={c} size={14} />}>{msg('v2m.otherLender', { name: o.lender.name, amount: formatSatang(o.balanceSatang) })}</FactRow>
                  ))}
                  {a.overpaid ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.reject }}>{msg('debt.flag')}</Text> : null}
                  <ListChip workerId={a.worker.id} lines={pending} />
                </View>
                <ChevronRight color={t.color.inkSoft} />
              </Pressable>
            ))}
          </Card>
        ) : null}
        {/* Owner q1 = ค (2026-11-08): each person is a full-width row with ›, not a short-name chip. */}
        {people.length ? <CardLabel>{msg('debt.list.pick')}</CardLabel> : null}
        {people.length ? (
          <Card testID="debt-pick-list" style={{ gap: 0, paddingVertical: t.space.xs }}>
            {people.map((p, i) => (
              <Pressable
                key={p.id}
                testID={`debt-person-${p.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${msg('debt.list.pick')} ${p.name}`}
                onPress={() => open(p.id, p.name)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, minHeight: t.target.min, paddingVertical: t.space.xs, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint }}
              >
                <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{p.name}</AppText>
                <View testID={`debt-person-${p.id}-go`}>
                  <ChevronRight color={t.color.inkSoft} />
                </View>
              </Pressable>
            ))}
          </Card>
        ) : null}
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
  /** E06-S09 IP-19: the plan sheet (replaces the older inline per-sale editor). */
  const [planOpen, setPlanOpen] = useState(false);
  const master = useMaster().state;
  const maxInst = master ? maxInstallments(master) : DEFAULT_MAX_INSTALLMENTS;
  // E06-S08: the repayment sheet and the undo bar (PR-5, PR-13).
  const [repay, setRepay] = useState<OpenRepay | null>(null);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);
  const events = useMemo(() => fin.events ?? [], [fin.events]);
  const pending = useMemo(() => (account ? pendingRepayLines(events, new Map([[worker.id, account]])) : []), [events, account, worker.id]);
  const owesBySale = useMemo(() => new Map(buyerOwes(events).map((o) => [o.saleId, o])), [events]);
  /** PR-6: a route deduction of a sale since the feature began — its tick, for the history line. */
  const HOW = { 'transfer-with-owner': 'transfer', 'buyer-split': 'cash', 'cash-from-share': 'picked' } as const;
  const routeOf = (h: HistoryLine) => {
    const p = account?.payments.find((x) => x.id === h.id);
    // A line cut to 0 by a fix (nothing reached the farm) carries no tick to show.
    if (!p || p.deleted || !p.counts || !p.saleId || p.amountSatang <= 0 || p.date < PENDING_REPAY_SINCE || !(p.method in HOW)) return null;
    const how: PendingHow = HOW[p.method as keyof typeof HOW];
    const st = paymentStatus(events, p.saleId, payeeOf(how, worker.id), 0);
    if (!st.done) return null;
    // What the buyer owes TODAY, the same figure as the payment page and the home (re-review 3) — never the gap at tick time.
    const o = owesBySale.get(p.saleId);
    const short = how === 'transfer' ? (o?.transferSatang ?? 0) : (o?.cash.find((c) => c.workerId === worker.id)?.satang ?? 0);
    return { line: { saleId: p.saleId, date: p.date, workerId: worker.id, name: worker.name, satang: p.amountSatang, how }, short };
  };
  const planEvents = (fin.events ?? []).filter((e) => e.targetId === `plan-${worker.id}`);
  const balance = account?.balanceSatang ?? 0;
  const s = account?.summary;

  const savePlan = (payload: FinancePayload) =>
    inFlight.run(async () => {
      const heads = planEvents.filter((e) => !planEvents.some((o) => o.baseEventId === e.id)).map((e) => e.id).sort();
      await fin.write(`plan-${worker.id}`, heads.length ? heads[heads.length - 1] : null, payload);
      setPlanOpen(false);
    });
  /** IP-18: "หักงวด N/M" on a deduction that paid an instalment. */
  const plan = useMemo(() => (account ? accountPlan({ account, events }) : null), [account, events]);
  // Review PR-c 3: one line per sale carries the number — its first live farm deduction line (as planStatus counts),
  // never a line to another lender, a voided one, or a second line of the same sale.
  const instLine = useMemo(() => {
    const out = new Map<string, number>();
    if (plan?.kind !== 'installments') return out;
    const seenSale = new Set<string>();
    for (const h of [...(account?.history ?? [])].reverse()) {
      if (h.type !== 'deduction' || h.deleted || !h.saleId || (h.creditor.id && h.creditor.id !== FARM_FUNDS) || seenSale.has(h.saleId) || !plan.numbers[h.saleId]) continue;
      seenSale.add(h.saleId);
      out.set(h.id, plan.numbers[h.saleId]);
    }
    return out;
  }, [plan, account]);
  const instOf = (h: HistoryLine) => instLine.get(h.id) ?? null;

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
    <>
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
        {/* E06-S09 IP-18 / IP-20: the whole card opens the plan sheet (no round "แก้", rule 11) */}
        <PlanCard account={account} events={events} onOpen={() => setPlanOpen(true)} />
      </Card>

      <PendingCard lines={pending} onOpen={(line) => setRepay({ line, ticked: false })} />

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
              {(() => {
                const src = sourceOf(h);
                const facts = (
                  <>
                    <View style={{ flexDirection: 'row' }}>
                      <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, textDecorationLine: h.deleted ? 'line-through' : 'none' }}>
                        {instOf(h) && plan?.kind === 'installments' ? msg('debt.inst.hist', { n: instOf(h)!, m: plan.count }) : msg(`debt.kind.${h.type}`)}
                      </AppText>
                      <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{`${h.signedSatang >= 0 ? '+' : MINUS}${formatSatang(Math.abs(h.signedSatang))}`}</AppText>
                    </View>
                    <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>
                      <Day iso={h.date} />
                    </FactRow>
                    {h.saleId ? <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{`${msg('debt.history.sale')} ${h.saleId}`}</FactRow> : null}
                    {h.type === 'loan' && h.creditor.name ? <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{msg('debt.history.lender', { name: h.creditor.name })}</FactRow> : null}
                    {h.deleted ? <AppText variant="caption">{msg('debt.history.voided')}</AppText> : null}
                    {(() => {
                      const r = routeOf(h);
                      if (!r) return null;
                      return (
                        <Pressable
                          testID={`rp-hist-${h.id}`}
                          accessibilityRole="button"
                          onPress={() => setRepay({ line: r.line, ticked: true })}
                          style={{ alignSelf: 'flex-start', minHeight: t.target.min, justifyContent: 'center' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xxs, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs, backgroundColor: r.short ? t.color.warnSunk : t.color.acceptSunk }}>
                            {r.short ? null : <Check color={t.color.accept} size={10} />}
                            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: r.short ? t.color.warn : t.color.accept }}>
                              {`${r.short ? msg('rp.hist.short', { amount: formatSatang(r.short) }) : msg('rp.hist.received')} ›`}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })()}
                  </>
                );
                // Owner 2026-11-07 (style A): a share debt's line itself opens its expense — void, restore or edit it there (E11-S10).
                return src ? (
                  <Pressable testID={`debt-open-${h.id}`} accessibilityRole="button" accessibilityLabel={[msg('debt.history.openExpense'), msg(`debt.kind.${h.type}`), `${h.signedSatang >= 0 ? '+' : MINUS}${formatSatang(Math.abs(h.signedSatang))}`, formatDate(h.date), h.deleted ? msg('debt.history.voided') : ''].filter(Boolean).join(', ')} onPress={() => openSource(src)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.target.min }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{facts}</View>
                    <View testID={`debt-open-${h.id}-chevron`} aria-hidden>
                      <ChevronRight color={t.color.inkFaint} />
                    </View>
                  </Pressable>
                ) : (
                  <>
                    {facts}
                    {/* Owner 2026-11-07: void is a red underlined link (style F), restore a blue one (style B). */}
                    <TextLink testID={`debt-void-${h.id}`} tone={h.deleted ? 'action' : 'reject'} onPress={() => void voidLine(h, !h.deleted)}>
                      {h.deleted ? msg('debt.history.restore') : msg('debt.history.void')}
                    </TextLink>
                  </>
                );
              })()}
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
    {undo ? <UndoBar undo={undo} events={events} write={fin.write} onGone={clearUndo} /> : null}
    {planOpen ? <PlanSheet account={account ?? emptyAccount(worker)} events={events} max={maxInst} busy={inFlight.busy} onSave={(p) => void savePlan(p)} onClose={() => setPlanOpen(false)} /> : null}
    {repay ? (
      <RepaySheet
        open={repay}
        events={events}
        account={account}
        write={fin.write}
        onDone={(u) => {
          setRepay(null);
          setUndo(u);
        }}
        onClose={() => setRepay(null)}
      />
    ) : null}
    </>
  );
}

/** A worker with nothing recorded yet can still be given a plan (as the older editor allowed). */
function emptyAccount(worker: { id: string; name: string }): DebtAccount {
  return {
    worker,
    balanceSatang: 0,
    overpaid: false,
    summary: { owed: { loan: 0, fertilizer: 0, other: 0 }, deducted: { 'cash-from-share': 0, 'buyer-split': 0, 'transfer-with-owner': 0, netting: 0 }, outside: 0, balanceSatang: 0 },
    others: [],
    planPerSaleSatang: null,
    installmentPlan: null,
    history: [],
    debts: [],
    payments: [],
  };
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
