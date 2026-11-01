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
 *   owner's and the close (D-61) — and so does a double deduction from two
 *   devices, or recorded lines the plan calls invalid (the debt deleted
 *   after; owner 2026-11-01 (A), `payBlocks`): the summary fixes each;
 * - close only when the piles add up and the rounding was answered; closing
 *   with unticked rows is allowed (SET-6); ticks stay open after close;
 * - closing marks the sale closing, sets it completed and dismisses to the
 *   list in one navigation.
 *
 * New (CO-10/CO-25): a worker with no cash today gets an info line, not a
 * tick (Q5); the transfer says "ส่วนสวน + ↘ คืนหนี้" apart (D-85); unticked
 * repayments carry "รอรับโอน" / "รอรับเงินสด"; a cash-from-share repayment
 * ticks together with that worker's cash (and can be unticked alone, A20).
 *
 * E06-S08 (P1, P2 · PR-16, PR-17, PR-20 · D-87): under the owner's transfer
 * and each buyer-split repayment, "ได้น้อยกว่านี้ ›" records what really came
 * in (the tick keeps the row amount, plus `receivedSatang`); a short tick
 * carries "คนซื้อค้างสวน ฿ X". A cash-from-share repayment instead gets
 * "ไม่ได้หยิบ / หยิบไม่ครบ ›", which shrinks the deduction itself
 * (`debt_payment_changed`), so the worker's ticks ask for a recheck. ดูที่มา
 * opens the summary's sources sheet with this sale's คนซื้อค้างสวน.
 */

import { useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { projectAccounts } from '../../../core/finance/accounts';
import { closeoutPlan, payBlocks, pendingRepays, REPAY_ROUTES, sourcesSheet, type CloseoutPlan } from '../../../core/finance/closeout';
import { buyerOwes, pickFixPatches } from '../../../core/finance/pending-repays';
import { compactMoneyParts } from '../../../core/compact-money';
import { overDeducted, pilesCheck } from '../../../core/finance/deduct';
import { formatSatang } from '../../../core/finance/money';
import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts } from '../../../core/finance/payments';
import { BANKS } from '../../../core/finance/promptpay';
import { formatThaiDate } from '../../../core/master';
import type { DebtPaymentMethod } from '../../../core/finance/types';
import { canComplete } from '../../../core/sale-status';
import { useInFlight } from '../../../finance/use-in-flight';
import { useI18n, useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, AppText, BankIcon, Button, cardStyle, Check, Chip, ClockIcon, CompactMoney, InfoIcon } from '../../../ui';
import { PickAmountSheet, ReceivedAmountSheet } from '../../money/received-sheet';
import type { TapperMoney } from '../../money/sale/use-sale-money';
import { FarmScreen } from '../../farm/pieces';
import { Banner, IconLine, markClosing, useSaleView } from '../pieces';
import { SourcesPill } from './summary-cards';
import { SourcesSheet } from './summary-sources-sheet';
import { WarnMark } from './summary-parts';
import { useShareSplit } from './cash-pieces';
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
  const { era } = useI18n();
  // E06-S08: the "ได้น้อยกว่านี้" sheet (by payee id) and the pick-fix sheet (by worker id).
  const [lessFor, setLessFor] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const shareSplit = useShareSplit();
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
  // Owner 2026-11-01 (A): a double deduction (two devices) or recorded lines the plan calls invalid lock like D-61.
  const blocks = payBlocks(plan);
  const bad = (tp: TapperMoney) => isOver(tp) || blocks.some((b) => b.id === tp.id);
  const over = money.tappers.some(bad);
  // The D-61 banner for an over-deduction that is not a double (a double says so in its own banner).
  const overBanner = money.tappers.some((tp) => isOver(tp) && !blocks.some((b) => b.id === tp.id && b.why === 'double'));
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
  const locked = (row: Exclude<Row, { kind: 'info' }>) => conflicts.length > 0 || flight.busy || (row.kind === 'owner' ? over : bad(row.tp));

  const pending = pendingRepays(plan, { owner: st(OWNER_PAYEE).done, debtCash: (wid) => status.get(`debt-cash-${wid}`)?.done ?? false });
  const pendingTransfer = pending.filter((p) => p.how === 'transfer').reduce((a, p) => a + p.satang, 0);
  const pendingCash = (wid: string) => pending.filter((p) => p.how === 'cash' && p.workerId === wid).reduce((a, p) => a + p.satang, 0);
  const transferOn = plan.workers.filter((w) => w.route === 'transfer-with-owner' && w.routeSatang > 0);
  const repayName = transferOn.length === 1 ? transferOn[0].name : '';
  const left = payees.filter((p) => !st(p.id).done).length;
  const src = sourcesSheet(plan, s.grossSatang, s.ownerSatang);
  const owes = buyerOwes(events).find((o) => o.saleId === saleId);
  const dateText = state.startedTs === null ? '' : formatThaiDate(state.startedTs, era);
  const balance = (wid: string) => money.debts.get(wid)?.balanceSatang ?? 0;
  const picks = (wid: string) => lines(wid).filter((x) => x.method === 'cash-from-share');
  // The owner's transfer carries every transfer-with-owner repayment; the sheet names the one worker, else the first.
  const transferWorker = transferOn[0] ? { id: transferOn[0].id, name: transferOn[0].name } : null;

  const saveLess = (row: Exclude<Row, { kind: 'info' }>, received: number) =>
    flight.run(async () => {
      await fin.write(paymentTarget(saleId, row.id), st(row.id).head, paymentMarkPayload(saleId, row.id, true, row.satang, received));
      setLessFor(null);
      bump();
    });
  const savePick = (wid: string, picked: number) =>
    flight.run(async () => {
      const ls = picks(wid).map((x) => ({ id: x.id, headEventId: x.headEventId, amountSatang: x.amountSatang }));
      for (const p of pickFixPatches(ls, picked)) await fin.write(p.id, p.head, { t: 'debt_payment_changed', patch: p.patch });
      setPickFor(null);
      bump();
    });
  // PR-19 from this page: the money is with the worker. Only a cash-from-share deduction can be
  // fixed here (P1); anything else just closes — the summary is read-only once the sale is closed.
  const fixAtSale = (wid: string | undefined) => {
    setLessFor(null);
    if (wid && picks(wid).length) setPickFor(wid);
  };

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

  const owesChip = (satang: number, testID: string) => (
    <View testID={testID} style={{ alignSelf: 'flex-start', backgroundColor: t.color.warnSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.warn }}>
        {`${msg('rp.pay.owes', { amount: '' }).trim()} `}
        <CompactMoney satang={satang} color={t.color.warn} />
      </Text>
    </View>
  );
  /** A small text link under a tick card: its own 48-tall target, outside the checkbox. */
  const linkUnder = (label: string, testID: string, disabled: boolean, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={{ alignSelf: 'flex-start', minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: disabled ? t.color.inkFaint : t.color.action }}>{label}</Text>
    </Pressable>
  );

  const card = (row: Exclude<Row, { kind: 'info' }>) => {
    const ps = st(row.id);
    const titleText =
      row.kind === 'cash' ? msg('cop.paidCash', { name: row.tp.name }) : row.kind === 'repay' ? msg('cop.gotRepayCash', { name: row.tp.name }) : msg('cop.ownerGot');
    const body: ReactNode[] = [];
    if (row.kind === 'cash') {
      body.push(sub(cashSub(row.tp), `pay-sub-${row.id}`));
      // Owner Q4: netting under the tapper's tick, ↗ orange (CO-15 / D-85).
      if (row.tp.nettedSatang > 0) body.push(sub(`↗ ${msg('cop.netted', { amount: short(row.tp.nettedSatang) })}`, `pay-net-${row.id}`, t.color.debtOut));
    }
    if (row.kind === 'repay') {
      body.push(sub(row.picked ? msg('cop.viaPicked', { dir: '↘', name: row.tp.name }) : msg('cop.viaSplit', { dir: '↘' }), `pay-sub-${row.id}`, t.color.debtIn));
      const wait = pendingCash(row.tp.id);
      if (!ps.done && wait) body.push(chip(msg('cop.waitCash', { dir: '↘', amount: short(wait) }), `pay-chip-${row.id}`));
      if (ps.done && row.picked && status.get(row.tp.id)?.done) body.push(sub(msg('cop.tickedWith', { name: row.tp.name }), `pay-with-${row.id}`));
    }
    if (row.kind === 'owner') {
      if (money.rounding.transferInSatang) {
        // A9: the repayment on its own line, blue — never broken inside a word.
        // the "+" leads the repay line, so it never hangs alone at the end of the share line
        body.push(sub(shareSplit(s.ownerSatang, money.rounding.result.ownerSatang - s.ownerSatang), `pay-sub-${row.id}`));
        body.push(sub(`+ ${msg('cop.ownerSplitRepay', { dir: '↘', name: repayName, repay: baht(money.rounding.transferInSatang) })}`, `pay-sub-${row.id}-repay`, t.color.debtIn));
      }
      if (!ps.done && pendingTransfer) body.push(chip(msg('cop.waitTransfer', { dir: '↘', amount: short(pendingTransfer) }), `pay-chip-${row.id}`));
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
    // E06-S08 P2: what the buyer still owes on this tick (never on a cash-from-share repayment).
    const receivable = row.kind === 'owner' || (row.kind === 'repay' && !row.picked);
    if (receivable && ps.done && ps.shortSatang > 0) body.push(owesChip(ps.shortSatang, `pay-owes-${row.id}`));
    const off = locked(row);
    const link = receivable
      ? linkUnder(msg('rp.pay.less'), `pay-less-${row.id}`, off, () => setLessFor(row.id))
      : row.kind === 'repay' && row.picked
        ? linkUnder(msg('rp.pay.pickFix'), `pay-pickfix-${row.id}`, off, () => setPickFor(row.tp.id))
        : null;
    return (
      <View key={row.id} style={{ gap: t.space.xxs }}>
      <Pressable
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
      {link}
      </View>
    );
  };

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
      overlay={(() => {
        if (sources) return <SourcesSheet src={src} plan={plan} saleTotalSatang={s.grossSatang} owes={owes} onClose={() => setSources(false)} />;
        const lessRow = lessFor ? payees.find((p) => p.id === lessFor) : undefined;
        if (lessRow && lessRow.kind !== 'cash') {
          const who = lessRow.kind === 'repay' ? { id: lessRow.tp.id, name: lessRow.tp.name } : transferWorker;
          return (
            <ReceivedAmountSheet
              kind={lessRow.kind === 'owner' ? 'transfer' : 'cash'}
              name={who?.name ?? ''}
              dateText={dateText}
              expectedSatang={lessRow.satang}
              debtSatang={who ? balance(who.id) : 0}
              onSave={(received) => void saveLess(lessRow, received)}
              onFixAtSale={() => fixAtSale(who?.id)}
              onClose={() => setLessFor(null)}
            />
          );
        }
        const pickTp = pickFor ? money.tappers.find((tp) => tp.id === pickFor) : undefined;
        if (pickTp) {
          return (
            <PickAmountSheet
              name={pickTp.name}
              dateText={dateText}
              deductedSatang={picks(pickTp.id).reduce((a, x) => a + x.amountSatang, 0)}
              debtNowSatang={balance(pickTp.id)}
              onSave={(picked) => void savePick(pickTp.id, picked)}
              onClose={() => setPickFor(null)}
            />
          );
        }
        return null;
      })()}
    >
      <View testID="pay-step" style={{ gap: t.space.xs }}>
        <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold }}>{msg('cop.step')}</AppText>
        <View aria-hidden style={{ height: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.accept }} />
      </View>
      <View
        testID="pay-tally"
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, borderRadius: t.radius.lg, paddingLeft: t.space.md, paddingRight: t.space.xs, backgroundColor: piles.ok ? t.color.acceptSunk : t.color.warnSunk }}
      >
        {piles.ok ? <Check color={t.color.accept} size={14} /> : <WarnMark color={t.color.warn} size={14} />}
        <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, color: piles.ok ? t.color.ink : t.color.warn }}>
          {piles.ok ? msg('cop.tallyOk') : msg('cop.tallyOff', { how: msg(piles.diffSatang < 0 ? 'cop.short' : 'cop.over'), amount: baht(Math.abs(piles.diffSatang)) })}
        </AppText>
        <SourcesPill testID="pay-sources-open" label={msg('cop.sources')} onPress={() => setSources(true)} />
      </View>
      {conflicts.length ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.tickConflict')} lines={[msg('v2s.tickConflictLine')]} testID="pay-conflict" /> : null}
      {overBanner ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.overTitle')} lines={[msg('v2s.overLine')]} testID="pay-over" /> : null}
      {blocks
        .filter((b) => b.why !== 'over')
        .map((b) => (
          <Banner
            key={b.id}
            tone="bad"
            icon={(c) => <AlertIcon color={c} size={14} />}
            title={b.why === 'double' ? msg('cop.doubleTitle', { name: b.name, n: b.devices }) : msg('cop.invalidTitle', { name: b.name })}
            lines={[msg('v2s.overLine')]}
            testID={`pay-${b.why}-${b.id}`}
          />
        ))}
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
