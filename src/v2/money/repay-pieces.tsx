/**
 * E06-S08 · repayments not received yet, on the debt ledger (mockup M1–M7,
 * M9, M10, P3 · PR-1…PR-15, PR-19 · D-87).
 *
 * - ListSummary / ListChip (M1): who is waiting for repayment money, Σ.
 * - PendingCard (M2–M4): one row per sale under the balance; the balance is
 *   already after the deduction (D-85) and is never added back.
 * - RepaySheet (M5, M5b, M10): mark the money received — the same tick the
 *   sale's payment page writes (`payment_mark_set`, E05-S11 CO-25): the
 *   owner's transfer tick for the transfer route (the whole transfer, owner
 *   Q2), the `debt-cash-<id>` tick otherwise. The amounts come from the sale's
 *   own money (`useSaleMoney` inside a SaleProvider), so a tick made here
 *   reads exactly like one made on the payment page.
 * - UndoBar (P3): "บันทึกแล้ว · เลิกทำ" for a few seconds after a write.
 */

import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DebtAccount } from '../../core/finance/debts';
import { formatSatang } from '../../core/finance/money';
import { closeoutPlan, payBlocks, REPAY_ROUTES } from '../../core/finance/closeout';
import { overDeducted } from '../../core/finance/deduct';
import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts, type PaymentStatus } from '../../core/finance/payments';
import { debtCashPayee, type PendingHow, type PendingRepayLine } from '../../core/finance/pending-repays';
import type { FinanceEvent, FinancePayload } from '../../core/finance/types';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { financeStore } from '../../store/finance';
import { SaleProvider } from '../../store/SaleProvider';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Card, Check, ChevronRight, CompactMoney, CTA } from '../../ui';
import { useDay } from '../farm/pieces';
import { CardIcon, MARK } from '../sale/closeout/summary-parts';
import { useCloseout } from '../sale/closeout/use-closeout';
import { ReceivedAmountSheet } from './received-sheet';

/** The "more" mark after a link's words (kept out of the catalogue, like MARK). */
export const MORE = '›';
const baht = formatSatang;
type Write = (targetId: string, base: string | null, payload: FinancePayload) => Promise<unknown>;

/** The payee whose tick says the money for this line came in. */
export const payeeOf = (how: PendingHow, workerId: string) => (how === 'transfer' ? OWNER_PAYEE : debtCashPayee(workerId));

/** A pill that says who the money waits on (amber = waiting; the ↘ repayment stays blue beside it, D-85). */
export function WaitChip({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xxs, backgroundColor: t.color.warnSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      {typeof children === 'string' ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{children}</Text> : children}
    </View>
  );
}

/** Sum per worker, by name (the order on screen never depends on generated ids). */
export function perWorker(lines: readonly PendingRepayLine[]): { id: string; name: string; satang: number }[] {
  const by = new Map<string, { id: string; name: string; satang: number }>();
  for (const l of lines) by.set(l.workerId, { id: l.workerId, name: l.name, satang: (by.get(l.workerId)?.satang ?? 0) + l.satang });
  return [...by.values()].sort((x, y) => x.name.localeCompare(y.name, 'th') || x.id.localeCompare(y.id));
}

/** M1 · PR-12: who waits for how much, 2 per line, then Σ on its own line. */
export function ListSummary({ lines }: { lines: readonly PendingRepayLine[] }) {
  const t = useTheme();
  const msg = useT();
  const people = perWorker(lines);
  if (!people.length) return null;
  const rows: (typeof people)[] = [];
  for (let i = 0; i < people.length; i += 2) rows.push(people.slice(i, i + 2));
  const total = people.reduce((a, p) => a + p.satang, 0);
  return (
    <Card testID="rp-list-sum" style={{ gap: t.space.xxs }}>
      <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('rp.list.sumTitle')}</AppText>
      {rows.map((r) => (
        <View key={r.map((p) => p.id).join('+')} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: t.space.sm }}>
          {r.map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
              {i ? <AppText style={{ color: t.color.inkSoft }}>·</AppText> : null}
              <AppText style={{ fontWeight: t.font.weight.bold }}>{p.name}</AppText>
              <CompactMoney satang={p.satang} pill />
            </View>
          ))}
        </View>
      ))}
      <View testID="rp-list-sum-total" style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{`${MARK.sum} ${msg('rp.list.sumTotal')}`}</AppText>
        <CompactMoney satang={total} pill />
      </View>
    </Card>
  );
}

/** M1 · PR-4: the chip on a worker's row. */
export function ListChip({ workerId, lines }: { workerId: string; lines: readonly PendingRepayLine[] }) {
  const t = useTheme();
  const msg = useT();
  const satang = lines.filter((l) => l.workerId === workerId).reduce((a, l) => a + l.satang, 0);
  if (!satang) return null;
  return (
    <WaitChip testID={`rp-list-chip-${workerId}`}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('rp.list.chip')}</Text>
      <CompactMoney satang={satang} color={t.color.warn} />
    </WaitChip>
  );
}

const howText = (msg: ReturnType<typeof useT>, how: PendingHow, name: string) =>
  how === 'transfer' ? msg('rp.how.transfer') : how === 'cash' ? msg('rp.how.cash') : msg('rp.how.picked', { name });

/** M2–M4 · PR-1, PR-3: the card under the balance. */
export function PendingCard({ lines, onOpen }: { lines: readonly PendingRepayLine[]; onOpen: (l: PendingRepayLine) => void }) {
  const t = useTheme();
  const msg = useT();
  const day = useDay();
  if (!lines.length) return null;
  const total = lines.reduce((a, l) => a + l.satang, 0);
  return (
    <Card testID="rp-card" style={{ gap: 0, paddingVertical: t.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingBottom: t.space.xs }}>
        <CardIcon id="finance.otherCost" tone="warn" small />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('rp.card.title')}</AppText>
          <AppText variant="bodySm" style={{ color: t.color.ink }}>{msg('rp.card.sub')}</AppText>
        </View>
      </View>
      {lines.map((l) => (
        <Pressable
          key={`${l.saleId}-${l.how}`}
          testID={`rp-row-${l.saleId}-${l.how}`}
          accessibilityRole="button"
          onPress={() => onOpen(l)}
          style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.xs, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint }}
        >
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('rp.card.sale', { date: day(l.date) })}</AppText>
            <AppText style={{ color: t.color.debtIn }}>{`${MARK.in} ${msg('rp.card.repay', { amount: baht(l.satang) })}`}</AppText>
            <WaitChip>{howText(msg, l.how, l.name)}</WaitChip>
          </View>
          <ChevronRight color={t.color.inkSoft} />
        </Pressable>
      ))}
      {lines.length > 1 ? (
        <View testID="rp-card-total" style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}>
          <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{`${MARK.sum} ${msg('rp.card.total')}`}</AppText>
          <CompactMoney satang={total} pill />
        </View>
      ) : null}
    </Card>
  );
}

/** What the undo bar can put back. */
export interface UndoInfo {
  readonly saleId: string;
  readonly payee: string;
  readonly label: string;
  /** The tick before the write: null = never ticked. */
  readonly before: { readonly done: boolean; readonly amount: number; readonly received?: number } | null;
}

export interface OpenRepay {
  readonly line: PendingRepayLine;
  /** Opened from a received history line: offer "ยังไม่ได้รับ". */
  readonly ticked: boolean;
}

/** The sheet, inside the sale's own provider so every amount is the payment page's. */
export function RepaySheet({ open, events, account, write, onDone, onClose }: { open: OpenRepay; events: readonly FinanceEvent[]; account: DebtAccount | undefined; write: Write; onDone: (u: UndoInfo) => void; onClose: () => void }) {
  return (
    <SaleProvider saleId={open.line.saleId}>
      <RepaySheetBody open={open} events={events} account={account} write={write} onDone={onDone} onClose={onClose} />
    </SaleProvider>
  );
}

function RepaySheetBody({ open, events, account, write, onDone, onClose }: { open: OpenRepay; events: readonly FinanceEvent[]; account: DebtAccount | undefined; write: Write; onDone: (u: UndoInfo) => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const day = useDay();
  const co = useCloseout();
  const money = co.money;
  const [less, setLess] = useState(false);
  // One write at a time: a ref, not state, stops two taps in one tick (review 2026-11-01).
  const flight = useInFlight();
  const busy = flight.busy;
  const { line, ticked } = open;
  const { saleId, name } = line;
  const payee = payeeOf(line.how, line.workerId);
  const linesOf = (id: string) => (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts);
  // The payment page's amounts (pay-screen.tsx): the owner's whole transfer, or that worker's repayment cash.
  const cashSatang = linesOf(line.workerId).filter((p) => p.method === 'buyer-split' || p.method === 'cash-from-share').reduce((a, p) => a + p.amountSatang, 0);
  const amount = line.how === 'transfer' ? money.ownerTransferSatang : cashSatang;
  const ready = money.loaded && money.settlement !== null && co.inputs !== null;
  // The payment page's locks (pay-screen.tsx `locked`): ticks in conflict (D-29/D-30), a double or invalid
  // deduction (payBlocks), a worker deducted over the share (D-61). Here: no write, send the owner there.
  const roundingMode = money.rounding.choice.asked ? money.rounding.choice.mode : 'none';
  const recordedPlan = useMemo(
    () =>
      money.settlement && co.inputs
        ? closeoutPlan({ saleTotalSatang: money.settlement.grossSatang, ownerShareSatang: money.settlement.ownerSatang, workers: co.inputs, drafts: {}, defaultRoute: () => REPAY_ROUTES[0], rounding: roundingMode })
        : null,
    [money.settlement, co.inputs, roundingMode],
  );
  const transferOn = money.tappers.map((tp) => ({ tp, satang: linesOf(tp.id).filter((p) => p.method === 'transfer-with-owner').reduce((a, p) => a + p.amountSatang, 0) })).filter((x) => x.satang > 0);
  const repayOnTransfer = transferOn.reduce((a, x) => a + x.satang, 0);
  const st: PaymentStatus = paymentStatus(events, saleId, payee, amount);
  const isOver = (tp: (typeof money.tappers)[number]) => overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang);
  const locked =
    st.conflict ||
    salePaymentConflicts(events, saleId).length > 0 ||
    (recordedPlan ? payBlocks(recordedPlan).length > 0 : false) ||
    (line.how === 'transfer' ? money.tappers.some(isOver) : money.tappers.some((tp) => tp.id === line.workerId && isOver(tp)));
  const before = st.head ? { done: st.done, amount: st.amountAtMarkSatang ?? amount, ...(st.done && st.shortSatang ? { received: st.receivedSatang ?? undefined } : {}) } : null;

  const mark = (done: boolean, received: number | undefined, label: string) =>
    flight.run(async () => {
      if (locked) return;
      // Fresh heads from the store: a sync or the other sheet may have written since this screen read.
      const head = paymentStatus(await financeStore.load(), saleId, payee, amount);
      if (head.conflict) return;
      await write(paymentTarget(saleId, payee), head.head, paymentMarkPayload(saleId, payee, done, amount, received));
      onDone({ saleId, payee, label, before });
    });
  const openSale = () => {
    onClose();
    router.push(`/v2/sale/${saleId}/payment` as Href);
  };
  /** PR-17 / PR-19: the money is with the worker — fix the deduction on the sale's payment page, its sheet opened. */
  const fixAtSale = () => {
    onClose();
    router.push(`/v2/sale/${saleId}/payment?fix=${encodeURIComponent(line.workerId)}&how=${line.how}` as Href);
  };
  const buyer = (money.state as { parties?: { buyer?: string } }).parties?.buyer ?? '';
  const transferNames = transferOn.map((x) => x.tp.name).join(msg('co.and'));

  if (less) {
    return (
      <ReceivedAmountSheet
        kind={line.how === 'transfer' ? 'transfer' : 'cash'}
        name={name}
        dateText={day(line.date)}
        expectedSatang={amount}
        debtSatang={account?.balanceSatang ?? 0}
        buyer={line.how === 'transfer' ? buyer : undefined}
        names={line.how === 'transfer' ? transferNames : undefined}
        onSave={(received) =>
          void mark(true, received, received === 0 ? msg('rp.undo.none') : received >= amount ? msg('rp.undo.full', { amount: baht(amount) }) : msg('rp.undo.less', { amount: baht(received) }))
        }
        onFixAtSale={fixAtSale}
        onClose={onClose}
      />
    );
  }

  const kv = (label: string, value: string, tone?: string, testID?: string) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
      <AppText style={{ flex: 1, minWidth: 120, color: tone ?? t.color.inkSoft }}>{label}</AppText>
      <AppText testID={testID} style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: tone ?? t.color.ink }}>{value}</AppText>
    </View>
  );
  const box = { borderWidth: t.border.hair, borderColor: t.color.ruleFaint, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceRaised, padding: t.space.md, gap: t.space.xxs } as const;
  const picked = line.how === 'picked';
  const route = line.how === 'transfer' ? msg('rp.route.transfer') : line.how === 'cash' ? msg('rp.route.cash') : msg('rp.route.picked', { name });

  return (
    <BottomSheet open onClose={onClose} title={picked ? msg('rp.sheet.titlePicked', { name }) : msg('rp.sheet.title')} testID="rp-sheet" closeLabel={msg('rp.sheet.close')}>
      <View style={{ gap: t.space.sm }}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('rp.sheet.sub', { name, date: day(line.date) })}</AppText>
        <View style={box}>
          {kv(`${MARK.in} ${msg('rp.sheet.repay', { name })}`, baht(line.satang), t.color.debtIn)}
          {kv(msg('rp.sheet.route'), route)}
        </View>
        {line.how === 'transfer' && ready ? (
          <View testID="rp-bundle" style={box}>
            <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold, color: t.color.inkSoft }}>{msg('rp.sheet.bundle')}</AppText>
            {kv(msg('rp.sheet.ownerPart'), baht(amount - repayOnTransfer))}
            {transferOn.map((x) => (
              <View key={x.tp.id}>{kv(`${MARK.in} ${msg('rp.sheet.repay', { name: x.tp.name })}`, baht(x.satang), t.color.debtIn)}</View>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.xxs }}>
              <AppText style={{ flex: 1, color: t.color.inkSoft }}>{msg('rp.sheet.transferTotal')}</AppText>
              <Text testID="rp-bundle-total" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>{baht(amount)}</Text>
            </View>
          </View>
        ) : null}
        {locked ? (
          <>
            <AppText testID="rp-sheet-locked" style={{ fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('rp.sheet.locked')}</AppText>
            <CTA testID="rp-sheet-open" onPress={openSale}>{`${msg('rp.sheet.openSale')} ${MORE}`}</CTA>
          </>
        ) : ticked ? (
          <CTA testID="rp-sheet-undo-tick" disabled={busy || !ready} onPress={() => void mark(false, undefined, msg('rp.undo.reopened'))}>
            {msg('rp.sheet.undoTick')}
          </CTA>
        ) : picked ? (
          <>
            <CTA testID="rp-sheet-picked-full" disabled={!ready || busy} icon={(c) => <Check color={c} />} onPress={() => void mark(true, undefined, msg('rp.undo.full', { amount: baht(amount) }))}>
              {msg('rp.sheet.pickedFull', { amount: baht(amount) })}
            </CTA>
            <Button testID="rp-sheet-picked-fix" size="large" onPress={fixAtSale}>{`${msg('rp.sheet.pickedFix')} ${MORE}`}</Button>
          </>
        ) : (
          <>
            <CTA testID="rp-sheet-full" disabled={!ready || busy || amount <= 0} icon={(c) => <Check color={c} />} onPress={() => void mark(true, undefined, msg('rp.undo.full', { amount: baht(amount) }))}>
              {msg('rp.sheet.full', { amount: baht(amount) })}
            </CTA>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              <View style={{ flexGrow: 1, flexBasis: 160 }}>
                <Button testID="rp-sheet-less" size="large" disabled={!ready || amount <= 0} onPress={() => setLess(true)}>{msg('rp.sheet.less')}</Button>
              </View>
              <Button testID="rp-sheet-open" variant="ghost" onPress={openSale}>{`${msg('rp.sheet.openSale')} ${MORE}`}</Button>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/** P3 · PR-13: "บันทึกแล้ว · เลิกทำ" for 8 s; เลิกทำ writes the tick back as it was. */
export function UndoBar({ undo, events, write, onGone }: { undo: UndoInfo; events: readonly FinanceEvent[]; write: Write; onGone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const flight = useInFlight();
  useEffect(() => {
    const id = setTimeout(onGone, 8000);
    return () => clearTimeout(id);
  }, [undo, onGone]);
  const back = () =>
    flight.run(async () => {
      // The head from the store, not the screen's copy: the write being undone may not have reloaded yet (review 2026-11-01).
      const st = paymentStatus(await financeStore.load(), undo.saleId, undo.payee, 0);
      if (st.conflict) return onGone();
      const b = undo.before;
      await write(paymentTarget(undo.saleId, undo.payee), st.head, paymentMarkPayload(undo.saleId, undo.payee, b?.done ?? false, b?.amount ?? st.amountAtMarkSatang ?? 0, b?.received));
      onGone();
    });
  return (
    <View testID="rp-undo" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.ink, borderRadius: t.radius.lg, paddingLeft: t.space.md, paddingRight: t.space.xs, marginHorizontal: t.layout.screenPaddingX, marginBottom: t.space.sm }}>
      <Check color={t.color.inkInverse} size={11} />
      <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.inkInverse }}>{undo.label}</Text>
      <Pressable testID="rp-undo-action" accessibilityRole="button" disabled={flight.busy} onPress={() => void back()} style={{ minHeight: t.target.min, minWidth: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.black, color: t.color.actionSunk }}>{msg('rp.undo.action')}</Text>
      </Pressable>
    </View>
  );
}
