/**
 * E05-S11 · จ่ายเงิน · ปิดการขาย (CO-10, CO-25; mockup A9, A19, A20).
 *
 * The deductions are recorded by now ("ยืนยันยอด"), so the plan is built
 * from the recorded lines (no draft) and every amount a tick carries comes
 * from `useSaleMoney`, as PaymentBody (money-screens.tsx, E05-S05/S10) did.
 * Every rule of that page is kept here:
 *
 * - one tick per pile with real money; payee ids are the tapper id,
 *   OWNER_PAYEE and `debt-cash-<tapperId>` (buyer-split / cash-from-share);
 *   a tick is a `payment_mark_set` (paymentMarkPayload) at paymentTarget;
 * - "ต้องตรวจใหม่" when the amount changed since the tick;
 * - ticks in conflict lock every tick and the close (D-29), counting only
 *   rows on the page; a worker deducted over the share locks their tick, the
 *   owner's and the close (D-61);
 * - close only when the piles add up and the rounding was answered; closing
 *   with unticked rows is allowed (SET-6); ticks stay open after close;
 * - closing marks the sale closing, sets it completed and dismisses to the
 *   list in one navigation.
 *
 * New (CO-10/CO-25): a worker with no cash today gets an info line, not a
 * tick (Q5); the transfer says "ส่วนสวน + ↘ คืนหนี้" apart (D-85); unticked
 * repayments carry "รอรับโอน" / "รอรับเงินสด"; a cash-from-share repayment
 * ticks together with that worker's cash (and can be unticked alone, A20).
 */

import { useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { projectAccounts } from '../../../core/finance/accounts';
import { closeoutPlan, pendingRepays, REPAY_ROUTES, sourcesSheet, type CloseoutPlan } from '../../../core/finance/closeout';
import { compactMoneyParts } from '../../../core/compact-money';
import { overDeducted, pilesCheck } from '../../../core/finance/deduct';
import { formatSatang } from '../../../core/finance/money';
import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts } from '../../../core/finance/payments';
import { BANKS } from '../../../core/finance/promptpay';
import type { DebtPaymentMethod } from '../../../core/finance/types';
import { canComplete } from '../../../core/sale-status';
import { useInFlight } from '../../../finance/use-in-flight';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, AppText, BankIcon, BottomSheet, Button, cardStyle, Check, ChevronRight, Chip, ClockIcon, InfoIcon } from '../../../ui';
import type { TapperMoney } from '../../money/sale/use-sale-money';
import { FarmScreen } from '../../farm/pieces';
import { Banner, IconLine, markClosing, useSaleView } from '../pieces';
import { useCloseout } from './use-closeout';

const baht = formatSatang;
const signedBaht = (s: number) => `${s < 0 ? '−' : '+'}${baht(Math.abs(s))}`;
/** "8,500" / "12.54k": the chip's short figure (summary-lines). */
const short = (s: number) => {
  const p = compactMoneyParts(s);
  return `${p.sign}${p.digits}${p.unit}`;
};

/** Remounts its child after a finance write, so every money hook reads the log again. */
function Fresh({ children }: { children: (bump: () => void) => ReactNode }) {
  const [v, setV] = useState(0);
  return <View key={v} style={{ flex: 1 }}>{children(() => setV((x) => x + 1))}</View>;
}

export function CloseoutPayScreen() {
  return <Fresh>{(bump) => <PayBody bump={bump} />}</Fresh>;
}

type Row =
  | { readonly kind: 'cash'; readonly id: string; readonly tp: TapperMoney; readonly satang: number }
  | { readonly kind: 'info'; readonly id: string; readonly tp: TapperMoney }
  | { readonly kind: 'repay'; readonly id: string; readonly tp: TapperMoney; readonly satang: number; readonly picked: boolean }
  | { readonly kind: 'owner'; readonly id: string; readonly satang: number };

function PayBody({ bump }: { bump: () => void }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const co = useCloseout();
  const { money, fin } = co;
  // One money write at a time: a double tap must not write twice (review #4).
  const flight = useInFlight();
  const [sources, setSources] = useState(false);
  const { saleId, state, master, append, saleTitle } = view;
  const title = msg('cop.payPageTitle');
  const subtitle = state.saleStatus === 'draft' ? msg('v2s.draftOf', { title: saleTitle }) : saleTitle;
  const settlement = money.settlement;
  const inputs = co.inputs;
  const roundingMode = money.rounding.choice.asked ? money.rounding.choice.mode : 'none';
  // The truth on this page: the plan from the recorded lines only (no draft).
  const plan: CloseoutPlan | null = useMemo(
    () =>
      settlement && inputs
        ? closeoutPlan({ saleTotalSatang: settlement.grossSatang, ownerShareSatang: settlement.ownerSatang, workers: inputs, drafts: {}, defaultRoute: () => REPAY_ROUTES[0], rounding: roundingMode })
        : null,
    [settlement, inputs, roundingMode],
  );
  const ready = view.ready && master && money.loaded && settlement && fin.events !== null && plan;
  if (!ready || !settlement || fin.events === null || !plan) return <FarmScreen title={title} subtitle={subtitle} fallback={'/v2/sales' as Href} />;
  const events = fin.events;

  const s = settlement;
  const accounts = projectAccounts(events);
  const choice = accounts.choiceFor(saleId);
  const account = choice?.kind === 'account' ? accounts.accounts.find((a) => a.id === choice.accountId) : undefined;
  const isOver = (tp: TapperMoney) => overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang);
  const over = money.tappers.some(isOver);
  const lines = (id: string) => (money.debts.get(id)?.payments ?? []).filter((x) => x.saleId === saleId && !x.deleted && x.counts);
  const cashRepaid = (id: string) => lines(id).filter((x) => x.method === 'cash-from-share' || x.method === 'buyer-split');

  const rows: Row[] = [
    ...money.tappers.flatMap((tp): Row[] => {
      const ps = cashRepaid(tp.id);
      const own: Row = tp.cashSatang > 0 ? { kind: 'cash', id: tp.id, tp, satang: tp.cashSatang } : { kind: 'info', id: tp.id, tp };
      return ps.length
        ? [own, { kind: 'repay', id: `debt-cash-${tp.id}`, tp, satang: ps.reduce((a, x) => a + x.amountSatang, 0), picked: ps.some((x) => x.method === 'cash-from-share') }]
        : [own];
    }),
    { kind: 'owner', id: OWNER_PAYEE, satang: money.ownerTransferSatang },
  ];
  const payees = rows.filter((r): r is Exclude<Row, { kind: 'info' }> => r.kind !== 'info');
  const status = new Map(payees.map((p) => [p.id, paymentStatus(events, saleId, p.id, p.satang)]));
  const st = (id: string) => status.get(id)!;
  // Only rows on the page block: a hidden zero-cash row or a gone repayment must not keep the sale from closing.
  const conflicts = salePaymentConflicts(events, saleId).filter((id) => payees.some((p) => p.id === id));

  const sum = (m: DebtPaymentMethod) => money.tappers.reduce((a, tp) => a + lines(tp.id).filter((x) => x.method === m).reduce((y, x) => y + x.amountSatang, 0), 0);
  const piles = pilesCheck([...money.tappers.map((tp) => ({ satang: tp.cashSatang })), { satang: money.ownerTransferSatang }, { satang: sum('cash-from-share') }, { satang: sum('buyer-split') }], s.grossSatang);
  const canClose = piles.ok && money.rounding.ready && conflicts.length === 0 && !over;
  const closed = view.closed;
  const closeSale = () => {
    if (!canClose) return;
    // One navigation, no timing: the list is not in the sale's stack, so dismissTo pops
    // the whole sale and back never reaches a live counter (review #2, N3).
    markClosing(saleId);
    if (canComplete(state)) append({ kind: 'sys', payload: { t: 'sale_status_set', status: 'completed' } });
    router.dismissTo('/v2/sales' as Href);
  };

  const mark = async (id: string, amount: number, done: boolean) => {
    const cur = st(id);
    await fin.write(paymentTarget(saleId, id), cur.head, paymentMarkPayload(saleId, id, done, amount));
  };
  const tick = (row: Exclude<Row, { kind: 'info' }>, done: boolean) =>
    flight.run(async () => {
      await mark(row.id, row.satang, done);
      // A20: the farm lifts the repayment out while paying the worker — both tick together.
      if (row.kind === 'cash') {
        const repay = payees.find((p) => p.kind === 'repay' && p.tp.id === row.id && p.picked);
        if (repay && st(repay.id).done !== done && !st(repay.id).conflict) await mark(repay.id, repay.satang, done);
      }
      bump();
    });
  // Ticks stay open after close (owner 2026-10-10); none while ticks conflict (D-29) or for a
  // tapper deducted over the share (D-61). The owner's tick waits on any over-deducted tapper:
  // route-3 repayments ride on his transfer (review F6).
  const locked = (row: Exclude<Row, { kind: 'info' }>) => conflicts.length > 0 || flight.busy || (row.kind === 'owner' ? over : isOver(row.tp));

  const pending = pendingRepays(plan, { owner: st(OWNER_PAYEE).done, debtCash: (wid) => status.get(`debt-cash-${wid}`)?.done ?? false });
  const pendingTransfer = pending.filter((p) => p.how === 'transfer').reduce((a, p) => a + p.satang, 0);
  const pendingCash = (wid: string) => pending.filter((p) => p.how === 'cash' && p.workerId === wid).reduce((a, p) => a + p.satang, 0);
  const transferOn = plan.workers.filter((w) => w.route === 'transfer-with-owner' && w.routeSatang > 0);
  const repayName = transferOn.length === 1 ? transferOn[0].name : '';
  const left = payees.filter((p) => !st(p.id).done).length;
  const src = sourcesSheet(plan, s.grossSatang, s.ownerSatang);

  const cashSub = (tp: TapperMoney) => {
    const w = plan.workers.find((x) => x.id === tp.id);
    const picked = lines(tp.id).some((x) => x.method === 'cash-from-share');
    const base = !tp.debtDeductedSatang
      ? msg('cop.subShare', { share: baht(tp.shareSatang) })
      : picked
        ? msg('cop.subPicked', { name: tp.name, pile: baht(tp.shareSatang), debt: baht(tp.debtDeductedSatang) })
        : msg('cop.subDebt', { share: baht(tp.shareSatang), debt: baht(tp.debtDeductedSatang) });
    const adjust = money.rounding.choice.asked ? tp.adjustSatang : 0;
    if (adjust) return `${base} ${msg('cop.subRound', { amount: signedBaht(adjust) })}`;
    if (money.rounding.choice.asked && roundingMode === 'none' && (w?.cashBeforeSatang ?? tp.cashBeforeSatang) % 100 !== 0) return `${base} ${msg('cop.subNoRound')}`;
    return base;
  };

  const sub = (text: string, testID: string, tone?: string) => (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: tone ?? t.color.inkSoft }}>
      {text}
    </Text>
  );
  const chip = (text: string, testID: string) => (
    <View testID={testID} style={{ alignSelf: 'flex-start', backgroundColor: t.color.warnSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{text}</Text>
    </View>
  );

  const card = (row: Exclude<Row, { kind: 'info' }>) => {
    const ps = st(row.id);
    const titleText =
      row.kind === 'cash' ? msg('cop.paidCash', { name: row.tp.name }) : row.kind === 'repay' ? msg('cop.gotRepayCash', { name: row.tp.name }) : msg('cop.ownerGot');
    const body: ReactNode[] = [];
    if (row.kind === 'cash') body.push(sub(cashSub(row.tp), `pay-sub-${row.id}`));
    if (row.kind === 'repay') {
      body.push(sub(row.picked ? msg('cop.viaPicked', { name: row.tp.name }) : msg('cop.viaSplit'), `pay-sub-${row.id}`, t.color.debtIn));
      const wait = pendingCash(row.tp.id);
      if (!ps.done && wait) body.push(chip(msg('cop.waitCash', { amount: short(wait) }), `pay-chip-${row.id}`));
      if (ps.done && row.picked && status.get(row.tp.id)?.done) body.push(sub(msg('cop.tickedWith', { name: row.tp.name }), `pay-with-${row.id}`));
    }
    if (row.kind === 'owner') {
      if (money.rounding.transferInSatang) {
        body.push(sub(msg('cop.ownerSplit', { owner: baht(money.rounding.result.ownerSatang), name: repayName, repay: baht(money.rounding.transferInSatang) }), `pay-sub-${row.id}`));
      }
      if (!ps.done && pendingTransfer) body.push(chip(msg('cop.waitTransfer', { amount: short(pendingTransfer) }), `pay-chip-${row.id}`));
      if (account) {
        body.push(
          <IconLine key="acct" icon={(c) => <BankIcon color={c} size={12} />}>
            {`${BANKS.find((b) => b.code === account.bankCode)?.name ?? account.label} ••${account.accountNo.slice(-4)}`}
          </IconLine>,
        );
      }
    }
    if (ps.done && ps.at) {
      body.push(
        <IconLine key="at" icon={(c) => <ClockIcon color={c} size={12} />}>
          {msg('cop.tickedAt', { time: new Date(ps.at + 7 * 3_600_000).toISOString().slice(11, 16) })}
        </IconLine>,
      );
    }
    if (ps.recheck) body.push(<IconLine key="re" icon={(c) => <AlertIcon color={c} size={12} />}>{msg('v2s.recheck')}</IconLine>);
    const off = locked(row);
    return (
      <Pressable
        key={row.id}
        testID={`tick-${row.id}`}
        accessibilityRole="checkbox"
        aria-checked={ps.done}
        disabled={off}
        accessibilityState={{ checked: ps.done, disabled: off }}
        onPress={() => void tick(row, !ps.done)}
        style={{
          ...cardStyle(t),
          minHeight: t.target.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.md,
          padding: t.space.md,
          borderWidth: ps.done ? t.border.thick : t.border.hair,
          borderColor: ps.done ? t.color.accept : t.color.ruleStrong,
          backgroundColor: ps.done ? t.color.acceptSunk : t.color.surfaceRaised,
        }}
      >
        <View style={{ width: 28, height: 28, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: ps.done ? t.color.accept : t.color.ruleStrong, backgroundColor: ps.done ? t.color.accept : t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          {ps.done ? <Check color={t.color.inkInverse} size={12} /> : null}
        </View>
        <View style={{ flex: 1, gap: t.space.xxs }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{titleText}</AppText>
          {body.map((b, k) => (
            <View key={k}>{b}</View>
          ))}
        </View>
        <Text testID={`tick-amt-${row.id}`} style={{ flexShrink: 0, fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {baht(row.satang)}
        </Text>
      </Pressable>
    );
  };

  const check = (ok: boolean, label: string, testID: string) => (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      {ok ? <Check color={t.color.accept} size={12} /> : <AlertIcon color={t.color.warn} size={14} />}
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="bodySm" style={{ color: ok ? t.color.accept : t.color.warn, fontWeight: t.font.weight.bold }}>{msg(ok ? 'cop.srcYes' : 'cop.srcNo')}</AppText>
    </View>
  );

  return (
    <FarmScreen
      title={title}
      subtitle={subtitle}
      fallback={'/v2/sales' as Href}
      testID="payment"
      footer={
        <View style={{ gap: t.space.sm }}>
          <AppText testID="pay-left" variant="bodySm" style={{ textAlign: 'center' }}>
            {left ? msg('cop.untickedN', { n: left }) : msg('cop.allTicked')}
          </AppText>
          {closed ? null : (
            <Button testID="close-sale" size="large" variant="primary" disabled={!canClose} icon={(c) => <Check color={c} size={14} />} onPress={closeSale}>
              {msg('cop.closeSale')}
            </Button>
          )}
        </View>
      }
      overlay={
        <BottomSheet open={sources} onClose={() => setSources(false)} title={msg('cop.srcTitle')} testID="pay-sources">
          {check(src.shares.ok, msg('cop.srcShares'), 'pay-src-shares')}
          {check(src.debt.ok, msg('cop.srcDebt'), 'pay-src-debt')}
          {check(src.rounding.ok, msg('cop.srcRound'), 'pay-src-round')}
          {check(src.paid.ok, msg('cop.srcPaid'), 'pay-src-paid')}
          <Button testID="pay-sources-close" onPress={() => setSources(false)}>
            {msg('cop.close')}
          </Button>
        </BottomSheet>
      }
    >
      <View testID="pay-step" style={{ gap: t.space.xs }}>
        <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold }}>{msg('cop.step')}</AppText>
        <View aria-hidden style={{ height: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.accept }} />
      </View>
      <View
        testID="pay-tally"
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, borderRadius: t.radius.lg, paddingLeft: t.space.md, backgroundColor: piles.ok ? t.color.acceptSunk : t.color.warnSunk }}
      >
        {piles.ok ? <Check color={t.color.accept} size={14} /> : <AlertIcon color={t.color.warn} size={14} />}
        <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, color: piles.ok ? t.color.ink : t.color.warn }}>
          {piles.ok ? msg('cop.tallyOk') : msg('cop.tallyOff', { how: msg(piles.diffSatang < 0 ? 'cop.short' : 'cop.over'), amount: baht(Math.abs(piles.diffSatang)) })}
        </AppText>
        <Pressable testID="pay-sources-open" accessibilityRole="button" onPress={() => setSources(true)} style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs, paddingHorizontal: t.space.md }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('cop.sources')}</Text>
          <ChevronRight color={t.color.action} size={7} />
        </Pressable>
      </View>
      {conflicts.length ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.tickConflict')} lines={[msg('v2s.tickConflictLine')]} testID="pay-conflict" /> : null}
      {over ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.overTitle')} lines={[msg('v2s.overLine')]} testID="pay-over" /> : null}
      {rows.map((row) =>
        row.kind === 'info' ? (
          <View key={row.id} testID={`pay-info-${row.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingHorizontal: t.space.xs }}>
            <InfoIcon color={t.color.inkSoft} size={16} />
            <AppText variant="bodySm" style={{ flex: 1 }}>{msg('cop.noCash', { name: row.tp.name })}</AppText>
          </View>
        ) : (
          card(row)
        ),
      )}
      {closed ? <Chip tone="accept" label={msg('status.closed')} testID="sale-closed" /> : null}
    </FarmScreen>
  );
}
