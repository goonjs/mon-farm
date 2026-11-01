/**
 * E05-S11 · "หักหนี้{ชื่อ}กี่บาท" (mockup A5, A23 · CO-5, CO-7, CO-22, A22).
 *
 * The amount is typed on the in-app NumberPad (no OS keyboard, no − +).
 * Every key changes the in-memory draft at once, so the cash, the oldest
 * piece and the debt left below are the plan's own figures (core), never
 * worked out here. ✓ keeps the draft and counts as checking this tapper's
 * debt; closing without ✓ puts the draft back as it was.
 *
 * A double (owner 2026-11-01): the sheet opens on ONE device's amount
 * (`doublePick.one`), so ✓ unchanged deducts that; "หักทั้งสอง" sets the sum.
 * Opening writes nothing (review 3, NB5): the one set is shown through
 * `co.preview` until a key commits it; only ✓ records the owner's choice
 * (`doubleChoice`), the one thing that clears the double (B1).
 *
 * Review 4 (B1′): what the sheet sets carries the recorded lines it was set
 * on (`linesSig`); core drops it once they move. If they move while the sheet
 * is open (a sync lands), the sheet starts again from the lines now recorded
 * — the proposal and the boxes are refreshed, so ✓ is always on those.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { quickAmounts, type CloseoutWorker, type DeductAmounts, type DebtPiece } from '../../../core/finance/closeout';
import { moneyTextStep, pressKey, startEntry, viewEntry, entryToSatang, type EntryConfig, type EntryKey, type EntryState } from '../../../core/number-entry';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Check, CTA, NumberPad } from '../../../ui';
import type { Closeout, CloseoutDraft } from './use-closeout';
import { addId, baht, MARK, netSet, shortBaht, WarnMark, withWorker } from './summary-parts';
import { usePieceName } from './summary-debt-sheet';

const CFG: EntryConfig = { kind: 'money', maxDigits: 8 };

/** Raw pad text for an amount: "3000", "5937.5". */
const rawOf = (satang: number) => (satang % 100 === 0 ? String(satang / 100) : `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0').replace(/0$/, '')}`);


type Box = 'total' | 'net';

export function DeductSheet({ co, w: given, pieces: givenPieces, canNet, onClose }: { co: Closeout; w: CloseoutWorker; pieces: readonly DebtPiece[]; /** The farm owes this tapper (CO-7: the link shows only then). */ canNet: boolean; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const pieceName = usePieceName();
  // What to put back when the sheet is closed without ✓.
  const [before] = useState(() => ({ worker: co.draft.workers[given.id], choice: co.draft.owedChoice[given.id] }));
  // An open double starts from one device's set, not the sum the two devices wrote — shown, not written (NB5).
  const opening = (x: CloseoutWorker) => (x.doubleOpen && x.doublePick ? x.doublePick.one : null);
  const [pending, setPending] = useState<DeductAmounts | null>(() => opening(given));
  const shownWith = (p: DeductAmounts | null) => (p && co.preview ? co.preview(given.id, { ...p, linesSig: given.linesSig }) : null);
  const seen = shownWith(pending);
  /** The worker as the sheet shows it: the plan's, or the one set's preview while nothing is typed yet. */
  const w = seen?.w ?? given;
  const pieces = seen?.pieces ?? givenPieces;
  const [entry, setEntry] = useState<EntryState>(() => startEntry(rawOf(w.totalSatang)));
  // A23: one pad, one box typed into at a time; the netting box takes the pad only when tapped.
  const [active, setActive] = useState<Box>('total');
  const [netEntry, setNetEntry] = useState<EntryState>(() => startEntry(rawOf(w.nettingSatang)));
  // B1′: the lines moved while open (a sync) → start again from them; what was typed on the old lines is dropped by core.
  const [madeOn, setMadeOn] = useState(given.linesSig);
  if (madeOn !== given.linesSig) {
    setMadeOn(given.linesSig);
    const p = opening(given);
    const now = shownWith(p)?.w ?? given;
    setPending(p);
    setEntry(startEntry(rawOf(now.totalSatang)));
    setNetEntry(startEntry(rawOf(now.nettingSatang)));
    setActive('total');
  }
  /** The draft with the shown one set under it, so the first key or chip writes on top of what is on screen. */
  const base = (d: CloseoutDraft) => (pending ? withWorker(d, w.id, pending) : d);
  /** Every change here is tied to the lines it was made on (B1′). */
  const edit = (f: (d: CloseoutDraft) => CloseoutDraft) => {
    co.update((d) => {
      const n = f(base(d));
      return n.workers[w.id] ? withWorker(n, w.id, { linesSig: w.linesSig }) : n;
    });
    setPending(null);
  };

  const setTotal = (satang: number) => edit((d) => withWorker(d, w.id, { totalSatang: satang }));
  /** Netting set to an amount (0 removes it): core's rule, then the deduction box shows the new deduction. */
  const net = (satang: number) => {
    let total = w.totalSatang;
    edit((d) => {
      const next = netSet(d, w, satang);
      total = next.workers[w.id]?.totalSatang ?? w.totalSatang;
      return next;
    });
    setEntry(startEntry(rawOf(total)));
    setNetEntry(startEntry(rawOf(satang)));
    if (satang === 0) setActive('total');
  };
  const netTyped = active === 'net' ? entryToSatang(netEntry.raw) : w.nettingSatang;
  /** What is wrong with the typed netting (it is not applied until it is within 1..ceiling). */
  const netProblem = active !== 'net' ? null : netTyped == null || netTyped <= 0 ? msg('co.net.empty') : netTyped > w.netCapSatang ? msg('co.net.overMax', { amount: shortBaht(w.netCapSatang) }) : null;
  const press = (k: EntryKey) => {
    if (active === 'net') {
      const next = pressKey(netEntry, k, CFG);
      setNetEntry(next);
      const v = entryToSatang(next.raw);
      if (v != null && v > 0 && v <= w.netCapSatang) {
        let total = w.totalSatang;
        edit((d) => {
          const nd = netSet(d, w, v);
          total = nd.workers[w.id]?.totalSatang ?? w.totalSatang;
          return nd;
        });
        setEntry(startEntry(rawOf(total)));
      }
      return;
    }
    const next = pressKey(entry, k, CFG);
    setEntry(next);
    setTotal(entryToSatang(next.raw) ?? 0);
  };
  /** "หักทั้งสอง": the sum both devices wrote, netting included — chosen on purpose only (✓ records the choice). */
  const both = () => {
    const b = w.doublePick?.both;
    if (!b || w.doubleBothProblem) return; // NB1: never the sum when it cannot be deducted
    edit((d) => withWorker(d, w.id, b));
    setEntry(startEntry(rawOf(b.totalSatang)));
    setNetEntry(startEntry(rawOf(b.nettingSatang)));
    setActive('total');
  };
  const jump = (satang: number) => {
    setEntry(startEntry(rawOf(satang)));
    setTotal(satang);
  };
  const pick = (box: Box) => {
    if (box === active) return;
    if (box === 'net') setNetEntry(startEntry(rawOf(w.nettingSatang)));
    else setEntry(startEntry(rawOf(w.totalSatang)));
    setActive(box);
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
  const blocked = w.invalid || netProblem !== null;
  const ok = () => {
    if (blocked) return;
    const pick = w.doublePick;
    const choice = pick && w.totalSatang === pick.both.totalSatang && w.nettingSatang === pick.both.nettingSatang ? ('both' as const) : ('one' as const);
    co.update((d) => ({
      // A double (two devices' lines): ✓ records the owner's choice with the amount shown (one device's, unless หักทั้งสอง) — confirm then writes it as one set.
      ...(w.doubled ? withWorker(d, w.id, { totalSatang: w.totalSatang, nettingSatang: w.nettingSatang, doubleChoice: choice, linesSig: w.linesSig }) : d),
      debtChecked: addId(d.debtChecked, w.id),
      ...(w.nettingSatang > 0 ? { owedChecked: addId(d.owedChecked, w.id), owedChoice: { ...d.owedChoice, [w.id]: 'net' as const } } : {}),
    }));
    onClose();
  };

  const q = quickAmounts(w.capSatang);
  const netted = w.nettingSatang > 0;
  const oldest = pieces[0];
  const balance = w.totalSatang + w.debtLeftSatang;
  const chip = (id: string, label: string, onPress: () => void, selected: boolean, tone?: string) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: tone ?? t.color.ruleStrong, backgroundColor: selected ? t.color.actionSunk : t.color.surfaceRaised }}
    >
      <AppText style={{ fontWeight: t.font.weight.bold, color: tone ?? t.color.ink }}>{label}</AppText>
    </Pressable>
  );
  const fit = (v: ReturnType<typeof viewEntry>, two: boolean) => {
    const step = moneyTextStep(v);
    return t.font.size[two ? (step === 'figure' || step === 'displayXl' ? 'displayLg' : step) : step === 'figure' ? 'displayXl' : step];
  };
  /** One amount box. With netting there are two: the one the pad types into is outlined and says "กำลังแก้: …". */
  const box = (which: Box, testID: string, v: ReturnType<typeof viewEntry>, bad: boolean) => {
    const two = netted;
    const on = which === active;
    const size = fit(v, two);
    const what = msg(which === 'net' ? 'co.deduct.whatNet' : 'co.deduct.whatTotal');
    const figure = (
      <Text style={{ fontFamily: t.font.family.sans, fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: v.empty ? t.color.inkFaint : which === 'net' ? t.color.debtOut : t.color.ink }}>
        {v.empty ? '0' : v.whole}
        {v.fractionTyped ? <Text style={{ fontSize: Math.round(size * 0.55) }}>{`.${v.fraction}`}</Text> : null}
      </Text>
    );
    const unit = <AppText style={{ color: t.color.inkSoft }}>{msg('v2.baht')}</AppText>;
    const frame = {
      borderWidth: on ? t.border.thick : t.border.hair,
      borderColor: bad ? t.color.reject : on ? t.color.action : t.color.ruleStrong,
      borderRadius: t.radius.lg,
      paddingHorizontal: two ? t.space.md : t.space.lg,
      paddingVertical: two ? t.space.xs : t.space.sm,
      backgroundColor: on && two ? t.color.actionSunk : t.color.surfaceRaised,
    };
    if (!two) {
      return (
        <View testID={testID} style={{ ...frame, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.sm }}>
          <AppText style={{ color: t.color.inkSoft }}>{msg('co.deduct.unit')}</AppText>
          {figure}
          {unit}
        </View>
      );
    }
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${on ? msg('co.deduct.editing', { what }) : what} ${v.empty ? '0' : v.whole}${v.fractionTyped ? `.${v.fraction}` : ''} ${msg('v2.baht')}`}
        onPress={() => pick(which)}
        style={{ ...frame, flexGrow: 1, flexBasis: 150, minHeight: t.target.min }}
      >
        <AppText
          testID={on ? 'co-editing' : undefined}
          variant="bodySm"
          style={{ fontWeight: on ? t.font.weight.bold : t.font.weight.regular, color: on ? t.color.action : which === 'net' ? t.color.debtOut : t.color.inkSoft }}
        >
          {on ? msg('co.deduct.editing', { what }) : `${which === 'net' ? `${MARK.out} ` : ''}${what}`}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.xs }}>
          {figure}
          {unit}
        </View>
      </Pressable>
    );
  };
  const totalView = active === 'total' ? viewEntry(entry, CFG) : viewEntry(startEntry(rawOf(w.totalSatang)), CFG);
  const netView = active === 'net' ? viewEntry(netEntry, CFG) : viewEntry(startEntry(rawOf(w.nettingSatang)), CFG);
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, lineHeight: Math.round(t.font.size.bodyMd * 1.45) } as const;

  return (
    <BottomSheet open onClose={cancel} title={msg('co.deduct.title', { name: w.name })} testID="co-deduct-sheet" closeLabel={msg('co.close')}>
      {/* one column a step tighter than the sheet's own gap: the pad and ✓ stay on screen with netting too (A23) */}
      <View style={{ gap: t.space.sm, marginBottom: -t.space.sm }}>
        <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.lg, paddingHorizontal: t.space.md, paddingVertical: t.space.sm }}>
          <SmallLine label={msg('co.deduct.debt', { name: w.name, n: pieces.length })} value={baht(balance)} />
          <SmallLine label={netted ? msg('co.deduct.capNet', { amount: shortBaht(w.nettingSatang) }) : msg('co.deduct.cap')} value={baht(w.capSatang)} />
          <View style={{ borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, marginVertical: t.space.xxs }} />
          <SmallLine testID="co-res-cash" label={msg('co.res.cash', { name: w.name })} value={baht(w.cashSatang)} />
          {oldest ? <SmallLine testID="co-res-oldest" label={msg('co.res.oldest', { piece: pieceName(oldest) })} value={baht(oldest.leftAfterSatang)} /> : null}
          <SmallLine testID="co-res-left" label={msg('co.res.left')} value={baht(w.debtLeftSatang)} tone={t.color.debtIn} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {active === 'net'
            ? [
                ...(w.nettingSatang === w.netCapSatang && !netProblem ? [] : [chip('co-net-full', msg('co.net.full', { amount: shortBaht(w.netCapSatang) }), () => net(w.netCapSatang), false, t.color.debtOut)]),
                chip('co-net-remove', `× ${msg('co.net.remove')}`, () => net(0), false, t.color.debtOut),
              ]
            : [
                chip('co-quick-full', msg('co.quick.full', { amount: shortBaht(q.full) }), () => jump(q.full), w.totalSatang === q.full),
                chip('co-quick-half', msg('co.quick.half', { amount: shortBaht(q.half) }), () => jump(q.half), w.totalSatang === q.half),
                chip('co-quick-none', msg('co.quick.none'), () => jump(q.none), w.totalSatang === q.none),
              ]}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.sm }}>
          {box('total', 'co-amount', totalView, w.invalid)}
          {netted ? box('net', 'co-net-field', netView, netProblem !== null) : null}
          {/* owner 2026-11-01: a double says so beside the box, with the doubled sum on purpose only (the pad and ✓ stay on screen) */}
          {w.doublePick ? (
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 130, gap: t.space.xxs, alignItems: 'flex-end' }}>
              <View testID="co-double-warn" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, alignSelf: 'stretch', justifyContent: 'flex-end' }}>
                <WarnMark color={t.color.warn} size={13} />
                <AppText variant="bodySm" style={{ flexShrink: 1, color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('co.double.sheet', { n: w.devices })}</AppText>
              </View>
              {w.doubleBothProblem ? (
                // NB1: the sum cannot be deducted — the reason instead of the button
                <AppText testID="co-double-both-why" variant="bodySm" style={{ color: t.color.inkSoft, textAlign: 'right' }}>
                  {msg('co.double.bothNo', {
                    why: msg(w.doubleBothProblem.problem === 'net-range' ? 'co.double.overNet' : 'co.double.overCap', {
                      amount: shortBaht(w.doubleBothProblem.problem === 'net-range' ? w.netCapSatang : w.doubleBothProblem.capSatang),
                    }),
                  })}
                </AppText>
              ) : (
                chip(
                  'co-double-both',
                  msg('co.double.both', { amount: shortBaht(w.doublePick.both.totalSatang) }),
                  both,
                  w.totalSatang === w.doublePick.both.totalSatang && w.typedNettingSatang === w.doublePick.both.nettingSatang,
                  t.color.warn,
                )
              )}
            </View>
          ) : null}
        </View>
        {w.invalid ? (
          <AppText testID="co-cap" accessibilityLiveRegion="polite" style={{ color: t.color.reject, fontWeight: t.font.weight.bold, textAlign: 'right' }}>
            {w.problem === 'below-netting'
              ? msg('co.deduct.belowNet', { amount: shortBaht(w.nettingSatang) })
              : w.problem === 'net-range'
                ? msg('co.net.overMax', { amount: shortBaht(w.netCapSatang) })
                : msg('co.deduct.overCap', { amount: baht(w.capSatang) })}
          </AppText>
        ) : null}
        {netProblem ? (
          <AppText testID="co-net-error" accessibilityLiveRegion="polite" style={{ color: t.color.reject, fontWeight: t.font.weight.bold, textAlign: 'right' }}>
            {netProblem}
          </AppText>
        ) : null}

        {netted ? (
          // CO-15: หักกลบ never without its sentence.
          <Text testID="co-net-on" style={{ ...small, color: t.color.debtOut }}>
            {`${MARK.out} ${msg('co.net.explain', { amount: shortBaht(w.nettingSatang), name: w.name })}`}
          </Text>
        ) : canNet && w.netCapSatang > 0 ? (
          <Pressable testID="co-net-link" accessibilityRole="link" onPress={() => net(w.netCapSatang)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
            <AppText style={{ color: t.color.debtOut, fontWeight: t.font.weight.bold, textDecorationLine: 'underline' }}>{MARK.out} {msg('co.net.link', { amount: shortBaht(w.netCapSatang), name: w.name })} ›</AppText>
          </Pressable>
        ) : null}

        {co.mixed?.has(w.id) ? <MergeWarn testID="co-merge-warn" /> : null}

        <NumberPad variant="money" testID="co-pad" onKey={press} onDone={ok} doneDisabled={blocked} />
        <CTA testID="co-deduct-ok" disabled={blocked} icon={(c) => <Check color={c} />} onPress={ok}>
          {msg('co.deduct.ok')}
        </CTA>
      </View>
    </BottomSheet>
  );
}

/** "การหักเดิมรับคืนหลายทาง…": an older sale's deduction on two routes is saved on the one chosen (review #9). */
export function MergeWarn({ testID, text }: { testID: string; text?: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, backgroundColor: t.color.warnSunk, borderRadius: t.radius.md, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      <WarnMark color={t.color.warn} size={13} />
      <AppText variant="bodySm" style={{ flex: 1, color: t.color.warn, fontWeight: t.font.weight.bold }}>{text ?? msg('v2s.mergeRoutes')}</AppText>
    </View>
  );
}

/** A label / figure row of the sheet's one info box, a step smaller than `Line` (A23 fits one screen). */
function SmallLine({ label, value, testID, tone }: { label: string; value: string; testID?: string; tone?: string }) {
  const t = useTheme();
  const st = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, lineHeight: Math.round(t.font.size.bodyMd * 1.5) } as const;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm, flexWrap: 'wrap' }}>
      <Text style={{ ...st, flexShrink: 1, color: t.color.inkSoft }}>{label}</Text>
      <Text style={{ ...st, marginLeft: 'auto', fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: tone ?? t.color.ink }}>{value}</Text>
    </View>
  );
}
