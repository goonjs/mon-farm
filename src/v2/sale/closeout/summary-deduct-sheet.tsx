/**
 * E05-S11 · "หักหนี้{ชื่อ}กี่บาท" (mockup A5, A23 · CO-5, CO-7, CO-22, A22).
 *
 * The amount is typed on the in-app NumberPad (no OS keyboard, no − +).
 * Every key changes the in-memory draft at once, so the cash, the oldest
 * piece and the debt left below are the plan's own figures (core), never
 * worked out here. ✓ keeps the draft and counts as checking this tapper's
 * debt; closing without ✓ puts the draft back as it was.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { quickAmounts, type CloseoutWorker, type DebtPiece } from '../../../core/finance/closeout';
import { moneyTextStep, pressKey, startEntry, viewEntry, entryToSatang, type EntryConfig, type EntryKey, type EntryState } from '../../../core/number-entry';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Check, CTA, MoneyField, NumberPad } from '../../../ui';
import type { Closeout } from './use-closeout';
import { addId, baht, Line, MARK, netSet, shortBaht, withWorker } from './summary-parts';
import { usePieceName } from './summary-debt-sheet';

const CFG: EntryConfig = { kind: 'money', maxDigits: 8 };

/** Raw pad text for an amount: "3000", "5937.5". */
const rawOf = (satang: number) => (satang % 100 === 0 ? String(satang / 100) : `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0').replace(/0$/, '')}`);


export function DeductSheet({ co, w, pieces, canNet, onClose }: { co: Closeout; w: CloseoutWorker; pieces: readonly DebtPiece[]; /** The farm owes this tapper (CO-7: the link shows only then). */ canNet: boolean; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const pieceName = usePieceName();
  // What to put back when the sheet is closed without ✓.
  const [before] = useState(() => ({ worker: co.draft.workers[w.id], choice: co.draft.owedChoice[w.id] }));
  const [entry, setEntry] = useState<EntryState>(() => startEntry(rawOf(w.totalSatang)));

  const setTotal = (satang: number) => co.update((d) => withWorker(d, w.id, { totalSatang: satang }));
  const press = (k: EntryKey) => {
    const next = pressKey(entry, k, CFG);
    setEntry(next);
    setTotal(entryToSatang(next.raw) ?? 0);
  };
  const jump = (satang: number) => {
    setEntry(startEntry(rawOf(satang)));
    setTotal(satang);
  };
  /** Netting set to an amount (0 removes it): core's rule, then the pad shows the new deduction. */
  const net = (satang: number) => {
    let total = w.totalSatang;
    co.update((d) => {
      const next = netSet(d, w, satang);
      total = next.workers[w.id]?.totalSatang ?? w.totalSatang;
      return next;
    });
    setEntry(startEntry(rawOf(total)));
  };
  const cancel = () => {
    co.update((d) => {
      const workers = { ...d.workers };
      if (before.worker) workers[w.id] = before.worker;
      else delete workers[w.id];
      const owedChoice = { ...d.owedChoice };
      if (before.choice) owedChoice[w.id] = before.choice;
      else delete owedChoice[w.id];
      return { ...d, workers, owedChoice };
    });
    onClose();
  };
  const ok = () => {
    if (w.invalid) return;
    co.update((d) => ({
      ...d,
      debtChecked: addId(d.debtChecked, w.id),
      ...(w.nettingSatang > 0 ? { owedChecked: addId(d.owedChecked, w.id), owedChoice: { ...d.owedChoice, [w.id]: 'net' as const } } : {}),
    }));
    onClose();
  };

  const netChip = { minHeight: t.target.comfortable, justifyContent: 'center' as const, paddingHorizontal: t.space.md, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.debtOut, backgroundColor: t.color.surfaceRaised };
  const q = quickAmounts(w.capSatang);
  const view = viewEntry(entry, CFG);
  const size = t.font.size[moneyTextStep(view) === 'figure' ? 'displayXl' : moneyTextStep(view)];
  const oldest = pieces[0];
  const balance = w.totalSatang + w.debtLeftSatang;
  const chip = (id: string, label: string, satang: number) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected: w.totalSatang === satang }}
      onPress={() => jump(satang)}
      style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: w.totalSatang === satang ? t.color.actionSunk : t.color.surfaceRaised }}
    >
      <AppText style={{ fontWeight: t.font.weight.bold }}>{label}</AppText>
    </Pressable>
  );

  return (
    <BottomSheet open onClose={cancel} title={msg('co.deduct.title', { name: w.name })} testID="co-deduct-sheet" closeLabel={msg('co.close')}>
      {/* one column a step tighter than the sheet's own gap (the pad and ✓ stay on screen) */}
      <View style={{ gap: t.space.sm }}>
      <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.xxs }}>
        <Line label={msg('co.deduct.debt', { name: w.name, n: pieces.length })} value={baht(balance)} />
        <Line label={w.nettingSatang > 0 ? msg('co.deduct.capNet', { amount: shortBaht(w.nettingSatang) }) : msg('co.deduct.cap')} value={baht(w.capSatang)} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {chip('co-quick-full', msg('co.quick.full', { amount: shortBaht(q.full) }), q.full)}
        {chip('co-quick-half', msg('co.quick.half', { amount: shortBaht(q.half) }), q.half)}
        {chip('co-quick-none', msg('co.quick.none'), q.none)}
      </View>

      <View testID="co-amount" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.sm, borderWidth: t.border.thick, borderColor: w.invalid ? t.color.reject : t.color.action, borderRadius: t.radius.lg, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, backgroundColor: t.color.surfaceRaised }}>
        <AppText style={{ color: t.color.inkSoft }}>{msg('co.deduct.unit')}</AppText>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: size, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: view.empty ? t.color.inkFaint : t.color.ink }}>
          {view.empty ? '0' : view.whole}
          {view.fractionTyped ? <Text style={{ fontSize: Math.round(size * 0.55) }}>{`.${view.fraction}`}</Text> : null}
        </Text>
        <AppText style={{ color: t.color.inkSoft }}>{msg('v2.baht')}</AppText>
      </View>
      {w.invalid ? (
        <AppText testID="co-cap" accessibilityLiveRegion="polite" style={{ color: t.color.reject, fontWeight: t.font.weight.bold, textAlign: 'right' }}>
          {msg('co.deduct.overCap', { amount: baht(w.capSatang) })}
        </AppText>
      ) : null}

      <View style={{ backgroundColor: t.color.debtInSunk, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.xxs }}>
        <Line testID="co-res-cash" label={msg('co.res.cash', { name: w.name })} value={baht(w.cashSatang)} />
        {oldest ? <Line testID="co-res-oldest" label={msg('co.res.oldest', { piece: pieceName(oldest) })} value={baht(oldest.leftAfterSatang)} /> : null}
        <Line testID="co-res-left" label={msg('co.res.left')} value={baht(w.debtLeftSatang)} />
      </View>

      {w.nettingSatang > 0 ? (
        <View testID="co-net-on" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: t.space.sm }}>
          <View style={{ flexGrow: 1, flexBasis: 150 }}>
            <MoneyField
              testID="co-net-field"
              label={`${MARK.out} ${msg('co.net.on', { amount: shortBaht(w.nettingSatang) })} · ${msg('co.net.max', { amount: shortBaht(w.netCapSatang) })}`}
              satang={w.nettingSatang}
              unit={msg('v2.baht')}
              minSatang={1}
              maxSatang={w.netCapSatang}
              words={false}
              onChange={net}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.space.xs }}>
            {w.nettingSatang === w.netCapSatang ? null : (
              <Pressable testID="co-net-full" accessibilityRole="button" onPress={() => net(w.netCapSatang)} style={netChip}>
                <AppText style={{ color: t.color.debtOut, fontWeight: t.font.weight.bold }}>{msg('co.net.full', { amount: shortBaht(w.netCapSatang) })}</AppText>
              </Pressable>
            )}
            <Pressable testID="co-net-remove" accessibilityRole="button" onPress={() => net(0)} style={netChip}>
              <AppText style={{ color: t.color.debtOut, fontWeight: t.font.weight.bold }}>× {msg('co.net.remove')}</AppText>
            </Pressable>
          </View>
        </View>
      ) : canNet && w.netCapSatang > 0 ? (
        <Pressable testID="co-net-link" accessibilityRole="link" onPress={() => net(w.netCapSatang)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
          <AppText style={{ color: t.color.debtOut, fontWeight: t.font.weight.bold, textDecorationLine: 'underline' }}>{MARK.out} {msg('co.net.link', { amount: shortBaht(w.netCapSatang), name: w.name })} ›</AppText>
        </Pressable>
      ) : null}

      <NumberPad variant="money" testID="co-pad" onKey={press} onDone={ok} />
      <CTA testID="co-deduct-ok" disabled={w.invalid} icon={(c) => <Check color={c} />} onPress={ok}>
        {msg('co.deduct.ok')}
      </CTA>
      </View>
    </BottomSheet>
  );
}
