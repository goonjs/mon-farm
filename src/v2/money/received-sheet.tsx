/**
 * E06-S08 · the amount sheets shared by the debt ledger and the sale's
 * payment page (mockup M7, M9, P1 · PR-15, PR-16, PR-17, PR-19 · D-87).
 *
 * - ReceivedAmountSheet: the buyer's money came in short ("ได้จริง"). The gap
 *   is what the buyer owes the farm; the worker's debt does not change. When
 *   the buyer handed the money to the worker instead, the sheet sends the
 *   owner to fix the deduction on the sale (PR-19).
 * - PickAmountSheet: the farm lifted less than it deducted from the worker's
 *   own pile ("หยิบได้"); the debt comes back by the rest (PR-17).
 *
 * Amounts are typed on the in-app NumberPad (no OS keyboard); the pad starts
 * empty (= 0) and refuses more than expected.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { entryToSatang, moneyTextStep, pressKey, startEntry, viewEntry, type EntryConfig, type EntryKey } from '../../core/number-entry';
import { formatSatang } from '../../core/finance/money';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Check, CTA, NumberPad } from '../../ui';

const CFG: EntryConfig = { kind: 'money', maxDigits: 8 };
const baht = formatSatang;

/** One label / value line in a result card. */
function Kv({ label, value, tone, testID }: { label: string; value: string; tone?: string; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
      <AppText style={{ flex: 1, minWidth: 140, color: tone ?? t.color.inkSoft, fontWeight: tone ? t.font.weight.bold : t.font.weight.regular }}>{label}</AppText>
      <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: tone ?? t.color.ink }}>{value}</AppText>
    </View>
  );
}

/** The typed amount, big, with its label (the closed MoneyField look, fed by the sheet's own pad). */
function AmountBox({ label, raw, bad, testID }: { label: string; raw: string; bad: boolean; testID: string }) {
  const t = useTheme();
  const msg = useT();
  const v = viewEntry(startEntry(raw), CFG);
  const step = moneyTextStep(v);
  const size = t.font.size[step === 'figure' ? 'displayXl' : step];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.md }}>
      <AppText style={{ flex: 1, minWidth: 80, fontWeight: t.font.weight.bold }}>{label}</AppText>
      <View
        testID={testID}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.xs, borderWidth: t.border.thick, borderColor: bad ? t.color.reject : t.color.action, borderRadius: t.radius.lg, paddingHorizontal: t.space.md, paddingVertical: t.space.xs, backgroundColor: t.color.surfaceRaised }}
      >
        <Text style={{ fontFamily: t.font.family.sans, fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {v.empty ? '0' : v.whole}
          <Text style={{ fontSize: Math.round(size * 0.55) }}>{`.${v.fractionTyped ? v.fraction : '00'}`}</Text>
        </Text>
        <AppText style={{ color: t.color.inkSoft }}>{msg('v2.baht')}</AppText>
      </View>
    </View>
  );
}

function usePad(maxSatang: number) {
  const [entry, setEntry] = useState(() => startEntry(''));
  const typed = entryToSatang(entry.raw) ?? 0;
  const over = typed > maxSatang;
  const press = (k: EntryKey) => setEntry((e) => pressKey(e, k, CFG));
  return { raw: entry.raw, typed, over, press };
}

const card = (t: ReturnType<typeof useTheme>) =>
  ({ backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.xxs }) as const;

export function ReceivedAmountSheet({
  kind,
  name,
  dateText,
  expectedSatang,
  debtSatang,
  buyer,
  names,
  onSave,
  onFixAtSale,
  onClose,
}: {
  /** transfer: the owner's whole transfer of the sale · cash: one worker's repayment cash. */
  kind: 'transfer' | 'cash';
  /** The worker whose debt is shown (for a transfer: the one whose ledger opened it); null = nobody's repayment rides on it (no "gave it to …"). */
  name: string | null;
  /** Transfer: the buyer and everyone whose repayment rides on the transfer (owner Q2). */
  buyer?: string;
  names?: string;
  dateText: string;
  expectedSatang: number;
  /** The worker's debt now — it does not change (D-87). */
  debtSatang: number;
  onSave: (receivedSatang: number) => void;
  /** PR-19: the buyer gave the money to the worker — fix the deduction on the sale. */
  onFixAtSale: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const pad = usePad(expectedSatang);
  const [withWorker, setWithWorker] = useState(false);
  const short = Math.max(0, expectedSatang - pad.typed);
  const seg = (on: boolean, label: string, testID: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ flex: 1, minHeight: t.target.min, justifyContent: 'center', alignItems: 'center', paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: on ? t.color.action : 'transparent' }}
    >
      <AppText style={{ textAlign: 'center', fontWeight: t.font.weight.bold, color: on ? t.color.inkInverse : t.color.inkSoft }}>{label}</AppText>
    </Pressable>
  );
  return (
    <BottomSheet open onClose={onClose} title={msg(kind === 'transfer' ? 'rp.amt.titleTransfer' : 'rp.amt.titleCash')} testID="rp-amount-sheet" closeLabel={msg('rp.sheet.close')}>
      <View style={{ gap: t.space.sm }}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>
          {kind === 'transfer' && buyer && names
            ? msg('rp.amt.subTransferFull', { date: dateText, buyer, names, amount: baht(expectedSatang) })
            : msg(kind === 'transfer' ? 'rp.amt.subTransfer' : 'rp.amt.subCash', { name: name ?? '', date: dateText, amount: baht(expectedSatang) })}
        </AppText>
        {name !== null ? (
          <View style={{ flexDirection: 'row', backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, padding: t.space.xxs, gap: t.space.xxs }}>
            {seg(!withWorker, msg('rp.amt.withBuyer'), 'rp-amt-with-buyer', () => setWithWorker(false))}
            {seg(withWorker, msg('rp.amt.withWorker', { name }), 'rp-amt-with-worker', () => setWithWorker(true))}
          </View>
        ) : null}
        {withWorker && name !== null ? (
          <>
            <AppText testID="rp-amt-worker-holds" style={{ fontWeight: t.font.weight.bold }}>{msg('rp.amt.workerHolds', { name })}</AppText>
            <CTA testID="rp-amt-fix" onPress={onFixAtSale}>{`${msg('rp.amt.fixAtSale')} ›`}</CTA>
          </>
        ) : (
          <>
            <AmountBox label={msg('rp.amt.got')} raw={pad.raw} bad={pad.over} testID="rp-amt-value" />
            <View style={card(t)}>
              <Kv label={msg('rp.amt.expected')} value={baht(expectedSatang)} />
              {pad.over ? (
                <Kv testID="rp-amt-over" label={msg('rp.amt.over', { amount: baht(expectedSatang) })} value="" tone={t.color.reject} />
              ) : (
                <Kv testID="rp-amt-owes" label={msg('rp.amt.owes')} value={baht(short)} tone={t.color.warn} />
              )}
              {name !== null ? <Kv testID="rp-amt-debt" label={msg('rp.amt.debtSame', { name })} value={baht(debtSatang)} /> : null}
            </View>
            <NumberPad variant="money" onKey={pad.press} onDone={() => (pad.over ? undefined : onSave(pad.typed))} doneDisabled={pad.over} testID="rp-amt-pad" />
            <CTA testID="rp-amt-save" disabled={pad.over} icon={(c) => <Check color={c} />} onPress={() => onSave(pad.typed)}>
              {pad.typed === 0 ? msg('rp.amt.saveNone') : msg('rp.amt.save', { amount: baht(pad.typed) })}
            </CTA>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

export function PickAmountSheet({
  mode = 'picked',
  name,
  dateText,
  deductedSatang,
  debtNowSatang,
  onSave,
  onClose,
}: {
  /** picked: lifted from the worker's own pile (PR-17) · handed: the buyer gave the repayment to the worker (PR-19). */
  mode?: 'picked' | 'handed';
  name: string;
  dateText: string;
  /** What was deducted and meant to be lifted from the worker's pile. */
  deductedSatang: number;
  /** The worker's debt now, after the deduction. */
  debtNowSatang: number;
  onSave: (pickedSatang: number) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const pad = usePad(deductedSatang);
  const back = Math.max(0, deductedSatang - pad.typed);
  return (
    <BottomSheet open onClose={onClose} title={msg(mode === 'picked' ? 'rp.pick.title' : 'rp.fix.titleHanded', { name })} testID="rp-pick-sheet" closeLabel={msg('rp.sheet.close')}>
      <View style={{ gap: t.space.sm }}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{`${msg('rp.pick.sub', { name, amount: baht(deductedSatang) })} · ${dateText}`}</AppText>
        <AmountBox label={msg(mode === 'picked' ? 'rp.pick.got' : 'rp.fix.gotHanded')} raw={pad.raw} bad={pad.over} testID="rp-pick-value" />
        <View style={card(t)}>
          {pad.over ? (
            <Kv testID="rp-pick-over" label={msg('rp.amt.over', { amount: baht(deductedSatang) })} value="" tone={t.color.reject} />
          ) : (
            <>
              <Kv testID="rp-pick-debt" label={msg('rp.pick.debtBack', { name })} value={baht(debtNowSatang + back)} />
              <Kv testID="rp-pick-more" label={msg('rp.pick.payMore', { name })} value={baht(back)} />
            </>
          )}
        </View>
        <NumberPad variant="money" onKey={pad.press} onDone={() => (pad.over ? undefined : onSave(pad.typed))} doneDisabled={pad.over} testID="rp-pick-pad" />
        <CTA testID="rp-pick-save" disabled={pad.over || back === 0} icon={(c) => <Check color={c} />} onPress={() => onSave(pad.typed)}>
          {mode === 'picked'
            ? pad.typed === 0
              ? msg('rp.pick.saveNone')
              : msg('rp.pick.save', { amount: baht(pad.typed) })
            : pad.typed === 0
              ? msg('rp.fix.saveNone')
              : msg('rp.fix.save', { amount: baht(pad.typed) })}
        </CTA>
      </View>
    </BottomSheet>
  );
}
