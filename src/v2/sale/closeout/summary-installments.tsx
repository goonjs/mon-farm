/**
 * E06-S09 · the deduct sheet for a worker with an instalment plan (mockup band ข/ง, แบบ A · IP-11…IP-14).
 *
 * One answer, large: the plan's boxes (paid = green with the day, today = outlined, the rest grey, the
 * last one "สุดท้าย") → "หักตามงวด · งวด N จาก M" → one button "หักงวด N · X". Everything else sits
 * under "ทำอย่างอื่น" as whole-row taps with › (no round outlined word buttons, owner rule 11): close the
 * whole debt, re-split what is left, type an amount (the pad view), or "ยังไม่หัก · ขอติดไว้ก่อน".
 * New debt since the plan has no default (Q3): the button stays grey until fold / in full is picked.
 *
 * Every figure is the plan's own (core `CloseoutWorker.installment`), never worked out here, except
 * the per-instalment amount on a re-split choice (`installmentAmount`, the same core rule).
 */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CloseoutWorker } from '../../../core/finance/closeout';
import { installmentAmount } from '../../../core/finance/installments';
import { formatDate } from '../../../core/finance/money';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, Check, ChevronRight, CTA } from '../../../ui';
import { baht, shortBaht, WarnMark } from './summary-parts';

export type InstView = 'plan' | 'all' | 'resplit';

/** "2026-11-04" → "4 พ.ย." */
const dayMonth = (iso: string) => formatDate(iso).split(' ').slice(0, 2).join(' ');

/** The plan as boxes, one per instalment; wraps (never clipped) up to 12. `closing` = the whole debt goes today. */
export function InstallmentBoxes({ w, closing = false }: { w: CloseoutWorker; closing?: boolean }) {
  const t = useTheme();
  const msg = useT();
  const v = w.installment;
  if (!v) return null;
  const rest = closing ? Array.from({ length: Math.max(0, v.count - v.number) }, () => null) : v.nextSatang;
  const box = (key: string, n: number, figure: string, foot: string, kind: 'paid' | 'now' | 'rest', testID?: string) => (
    <View
      key={key}
      testID={testID}
      style={{
        flexGrow: 1,
        flexBasis: 72,
        minHeight: t.target.min,
        borderRadius: t.radius.md,
        borderWidth: kind === 'now' ? t.border.thick : t.border.hair,
        borderColor: kind === 'now' ? t.color.action : kind === 'paid' ? t.color.accept : t.color.ruleStrong,
        backgroundColor: kind === 'paid' ? t.color.acceptSunk : kind === 'now' ? t.color.surfaceRaised : t.color.surfaceSunk,
        paddingHorizontal: t.space.xs,
        paddingVertical: t.space.xxs,
        alignItems: 'center',
      }}
    >
      <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.inst.box', { n })}</AppText>
      <AppText style={{ fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: kind === 'rest' ? t.color.inkSoft : t.color.ink }}>{figure}</AppText>
      <AppText variant="bodySm" style={{ textAlign: 'center', color: kind === 'paid' ? t.color.accept : kind === 'now' ? t.color.action : t.color.inkSoft, fontWeight: kind === 'rest' ? t.font.weight.regular : t.font.weight.bold }}>
        {foot}
      </AppText>
    </View>
  );
  return (
    <View testID="co-inst-boxes" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
      {v.paidSales.map((p, k) => box(`p${p.saleId}`, k + 1, shortBaht(p.satang), `✓ ${dayMonth(p.date)}`, 'paid', `co-inst-paid-${k + 1}`))}
      {box('now', v.number, shortBaht(v.needsChoice ? v.dueSatang : w.totalSatang), rest.length ? msg('co.inst.today') : `${msg('co.inst.today')} · ${msg('co.inst.last')}`, 'now', 'co-inst-now')}
      {rest.map((x, k) => {
        const n = v.number + 1 + k;
        const last = k === rest.length - 1;
        return box(`r${n}`, n, x === null ? '—' : shortBaht(x), x === null ? msg('co.inst.none') : last ? msg('co.inst.last') : ' ', 'rest', `co-inst-next-${n}`);
      })}
    </View>
  );
}

/** The one large answer: a caption, the figure, and what it leaves. */
function BigPay({ caption, satang, foot }: { caption: string; satang: number; foot: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID="co-inst-big" style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.lg, paddingHorizontal: t.space.md, paddingVertical: t.space.sm, gap: t.space.xxs }}>
      <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{caption}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: t.space.xs }}>
        <Text testID="co-inst-amount" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, lineHeight: Math.round(t.font.size.displayLg * 1.25), fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {shortBaht(satang)}
        </Text>
        <AppText style={{ color: t.color.inkSoft }}>{msg('v2.baht')}</AppText>
      </View>
      <AppText testID="co-inst-after" variant="bodySm" style={{ color: t.color.inkSoft }}>{foot}</AppText>
    </View>
  );
}

/** A whole-row tap with › (rule 11): label, an optional figure, the chevron. */
function RowLink({ testID, label, value, onPress }: { testID: string; label: string; value?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingHorizontal: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint }}
    >
      <AppText style={{ flex: 1, flexShrink: 1, color: t.color.ink }}>{label}</AppText>
      {value ? <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.inkSoft }}>{value}</AppText> : null}
      <ChevronRight color={t.color.inkSoft} size={20} />
    </Pressable>
  );
}

/** An underlined text link back to the plan view (no round button, rule 11). */
export function BackToPlan({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <Pressable testID="co-inst-back" accessibilityRole="link" onPress={onPress} style={{ minHeight: t.target.min, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <AppText style={{ color: t.color.action, fontWeight: t.font.weight.bold, textDecorationLine: 'underline' }}>{msg('co.inst.back')}</AppText>
    </Pressable>
  );
}

/** A choice card ("3 งวด / งวดละ 4,267" or "รวมในงวดที่เหลือ"): a whole tap target, selected = outlined and tinted. */
export function Choice({ testID, selected, onPress, children, basis = 90 }: { testID: string; selected: boolean; onPress: () => void; children: ReactNode; basis?: number }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: basis,
        minHeight: t.target.min,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: t.space.sm,
        paddingVertical: t.space.xxs,
        borderRadius: t.radius.md,
        borderWidth: selected ? t.border.thick : t.border.hair,
        borderColor: selected ? t.color.action : t.color.ruleStrong,
        backgroundColor: selected ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      {children}
    </Pressable>
  );
}

/** "3 งวด" over "งวดละ 4,267". */
export function CountChoice({ n, perSatang }: { n: number; perSatang: number | null }) {
  const t = useTheme();
  const msg = useT();
  return (
    <>
      <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('co.inst.n', { n })}</AppText>
      {perSatang ? <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.inst.per', { amount: shortBaht(perSatang) })}</AppText> : null}
    </>
  );
}

export function InstallmentPane({
  w,
  view,
  onView,
  onNewDebt,
  onSplit,
  onTyped,
  onNone,
  onOk,
  blocked,
}: {
  w: CloseoutWorker;
  view: InstView;
  onView: (v: InstView) => void;
  onNewDebt: (c: 'fold' | 'full') => void;
  onSplit: (n: number) => void;
  onTyped: () => void;
  onNone: () => void;
  onOk: () => void;
  blocked: boolean;
}) {
  const t = useTheme();
  const msg = useT();
  const v = w.installment!;
  /** The debt as if nothing were deducted today: what a re-split divides. */
  const balance = w.totalSatang + w.debtLeftSatang;
  const sub = (text: string) => (
    <AppText testID="co-inst-sub" variant="bodySm" style={{ color: t.color.inkSoft }}>{text}</AppText>
  );
  const ok = (label: string, disabled: boolean) => (
    <CTA testID="co-deduct-ok" disabled={disabled} icon={disabled ? undefined : (c) => <Check color={c} />} onPress={onOk}>
      {label}
    </CTA>
  );

  if (view === 'all') {
    return (
      <View style={{ gap: t.space.sm }}>
        {sub(msg('co.inst.all'))}
        <InstallmentBoxes w={w} closing />
        <BigPay caption={msg('co.inst.allTitle')} satang={w.totalSatang} foot={msg('co.inst.after', { name: w.name, cash: baht(w.cashSatang), left: baht(w.debtLeftSatang) })} />
        {ok(msg('co.inst.okAll', { amount: shortBaht(w.totalSatang) }), blocked)}
        <BackToPlan onPress={() => onView('plan')} />
      </View>
    );
  }

  if (view === 'resplit') {
    const picked = v.mode === 'resplit';
    return (
      <View style={{ gap: t.space.sm }}>
        {sub(msg('co.inst.splitSub', { amount: baht(balance) }))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: t.space.xs }}>
          <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('co.inst.splitAsk')}</AppText>
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.inst.splitFrom')}</AppText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {w.installmentChoices.map((n) => (
            <Choice key={n} testID={`co-inst-split-${n}`} selected={picked && v.count - v.paidSales.length === n} onPress={() => onSplit(n)}>
              <CountChoice n={n} perSatang={installmentAmount(balance, n)} />
            </Choice>
          ))}
        </View>
        {picked ? (
          <>
            <InstallmentBoxes w={w} />
            <BigPay caption={msg('co.inst.todayN', { number: v.number, count: v.count })} satang={w.totalSatang} foot={msg('co.inst.cashOnly', { name: w.name, cash: baht(w.cashSatang) })} />
          </>
        ) : null}
        {ok(picked ? msg('co.inst.okSplit', { n: v.count - v.paidSales.length, amount: shortBaht(w.totalSatang) }) : msg('co.inst.splitAsk'), !picked || blocked)}
        <BackToPlan onPress={() => onView('plan')} />
      </View>
    );
  }

  // view === 'plan'
  const short = !v.needsChoice && v.dueSatang > w.totalSatang && w.totalSatang > 0 && w.totalSatang === w.capSatang;
  const lastN = v.count;
  const lastAmount = v.nextSatang[v.nextSatang.length - 1];
  const canClose = w.capSatang >= balance && balance > w.totalSatang;
  return (
    <View style={{ gap: t.space.sm }}>
      {sub(msg('co.inst.sub', { count: v.count, number: v.number }))}
      {v.needsChoice || v.newDebt ? (
        <View testID="co-inst-newdebt" style={{ backgroundColor: t.color.warnSunk, borderRadius: t.radius.md, padding: t.space.sm, gap: t.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <WarnMark color={t.color.warn} size={14} />
            <AppText style={{ flex: 1, color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('co.inst.newDebt', { amount: baht(v.extraSatang) })}</AppText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            <Choice testID="co-inst-fold" selected={v.newDebt === 'fold'} onPress={() => onNewDebt('fold')}>
              <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('co.inst.fold')}</AppText>
            </Choice>
            <Choice testID="co-inst-full" selected={v.newDebt === 'full'} onPress={() => onNewDebt('full')}>
              <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('co.inst.full')}</AppText>
            </Choice>
          </View>
        </View>
      ) : null}
      {short ? (
        <View testID="co-inst-short" style={{ backgroundColor: t.color.warnSunk, borderRadius: t.radius.md, padding: t.space.sm, gap: t.space.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <WarnMark color={t.color.warn} size={14} />
            <AppText style={{ flex: 1, color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('co.inst.short', { amount: baht(w.totalSatang) })}</AppText>
          </View>
          <AppText variant="bodySm" style={{ color: t.color.ink }}>{msg('co.inst.shortWhy', { number: v.number, due: baht(v.dueSatang), gap: baht(v.dueSatang - w.totalSatang) })}</AppText>
        </View>
      ) : null}
      <InstallmentBoxes w={w} />
      {v.needsChoice ? null : (
        <BigPay
          caption={msg(short ? 'co.inst.canToday' : 'co.inst.byPlan', { number: v.number, count: v.count })}
          satang={w.totalSatang}
          foot={
            // Code review 6: the shortfall is spread over every instalment left, so name them all when more than one is left.
            short && v.nextSatang.length > 1
              ? msg('co.inst.afterRest', { name: w.name, cash: baht(w.cashSatang), list: v.nextSatang.map(shortBaht).join(' · ') })
              : short && lastAmount !== undefined
              ? msg('co.inst.afterLast', { name: w.name, cash: baht(w.cashSatang), n: lastN, amount: baht(lastAmount) })
              : msg('co.inst.after', { name: w.name, cash: baht(w.cashSatang), left: baht(w.debtLeftSatang) })
          }
        />
      )}
      {ok(v.needsChoice ? msg('co.inst.chooseFirst') : msg('co.inst.ok', { number: v.number, amount: shortBaht(w.totalSatang) }), v.needsChoice || blocked)}
      <View>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft, paddingBottom: t.space.xxs }}>{msg('co.inst.other')}</AppText>
        {canClose ? <RowLink testID="co-inst-row-all" label={msg('co.inst.all')} value={shortBaht(balance)} onPress={() => onView('all')} /> : null}
        {w.installmentChoices.length ? <RowLink testID="co-inst-row-resplit" label={msg('co.inst.resplit')} onPress={() => onView('resplit')} /> : null}
        <RowLink testID="co-inst-row-typed" label={msg('co.inst.typed')} onPress={onTyped} />
        <RowLink testID="co-inst-row-none" label={msg('co.quick.none')} onPress={onNone} />
      </View>
    </View>
  );
}
