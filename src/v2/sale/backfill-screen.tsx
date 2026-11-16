/**
 * /v2/sale/<id>/backfill?point= — กรอกย้อนหลัง (E04-S19, mockup v4): someone
 * arrives late and enters what the paper says, point by point in weighing
 * order, then counts on live. Reached from the counter's ⋯ menu through the
 * point picker (D-49), as before.
 *
 * Continuous per tapper: the tapper's points in paper order (BF-1), then one
 * page per point — "จบที่เข่งไหน" with the start filled in, then "เต็มไหม" with
 * nothing chosen (BF-2/3) — and, before a point that follows a short basket,
 * "เติมที่จุดนี้ไหม" (BF-4). Per point: the picked point only, starting at 1.
 * The Σ bar sits on every page and only goes up (BF-10); the summary reads
 * like the paper and can be checked against its total (BF-6/7). Saving writes
 * ordinary baskets once (`catchUpPlan` → `writeCatchUp`); the last short one
 * stays open for live counting (BF-5). Only before live counting (BF-8).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { catchUpAllowed, catchUpPlan, writeCatchUp, type CatchUpPlan, type CatchUpPoint, type CatchUpRow } from '../../core/catch-up';
import { pointsOf, tapperOn } from '../../core/master';
import { pairForNewPoint } from '../../core/sale-move';
import { pointSetupPayloads } from '../../core/sale-points';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, Button, cardStyle, Check, CTA, QuantityField, TextLink } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { Banner, kgText, useLeaveIfClosed, useSaleView } from './pieces';

/** What was entered for one point; null = not answered yet. */
interface Entry {
  readonly end: number | null;
  readonly full: boolean | null;
  readonly shortG: number | null;
  readonly fill: boolean | null;
  readonly fillG: number | null;
}
const EMPTY: Entry = { end: null, full: null, shortG: null, fill: null, fillG: null };

type Step = { readonly kind: 'order' } | { readonly kind: 'topup'; readonly i: number } | { readonly kind: 'point'; readonly i: number } | { readonly kind: 'summary' };

export function BackfillScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { point: pointId = '' } = useLocalSearchParams<{ point?: string }>();
  const view = useSaleView();
  // A closed sale takes no more weighing (review #2).
  useLeaveIfClosed(view);
  const { saleId, events, state, master, day, mode, settings, append, nameOf, saleTitle } = view;
  const [order, setOrder] = useState<string[]>(pointId ? [pointId] : []);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [step, setStep] = useState<Step | null>(null);
  const [paperG, setPaperG] = useState<number | null>(null);
  // The kg pad opens at once when "ไม่เต็ม" is chosen (NP-15).
  const [kgOpen, setKgOpen] = useState(false);
  const saving = useRef(false);
  // Saved: the screen stays as it was until the router moves on (the log now has baskets, BF-8 would show).
  const [done, setDone] = useState(false);
  const base = `/v2/sale/${saleId}`;

  const point = master?.points.find((p) => p.id === pointId);
  if (!view.ready || !master || !settings || !point) return <FarmScreen title={msg('cu.title')} subtitle={saleTitle} fallback={`${base}/point` as Href} />;

  const perPoint = mode === 'per-point';
  const tapper = tapperOn(master, pointId, day);
  const tapperPoints = !perPoint && tapper ? pointsOf(master, tapper, day) : [];
  const pair = (() => {
    const pile = state.piles.find((p) => p.id === pointId);
    if (pile) return { stdNetG: pile.stdNetG, tareG: pile.tareG };
    const p = pairForNewPoint(events, settings, null);
    return { stdNetG: p.netG, tareG: p.basketG };
  })();
  const opts = { mode, firstNo: 1, stdNetG: pair.stdNetG, tareG: pair.tareG };
  const pointName = (id: string) => master.points.find((p) => p.id === id)?.name ?? '';
  const kg = (g: number) => kgText(g);
  const who = tapper && !perPoint ? nameOf(tapper) : msg('cu.blockedPoint');

  // BF-8: catching up comes before counting live.
  if (!done && !catchUpAllowed(events, master, day, pointId, mode)) {
    return (
      <FarmScreen title={msg('cu.title')} subtitle={saleTitle} fallback={`${base}/counter?point=${pointId}` as Href} testID="catch-up">
        <View testID="cu-blocked">
          <Banner tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} lines={[msg('cu.blocked', { who })]} />
        </View>
      </FarmScreen>
    );
  }

  const first: Step = !perPoint && tapperPoints.length > 1 ? { kind: 'order' } : { kind: 'point', i: 0 };
  const now = step ?? first;
  const entry = (id: string) => entries[id] ?? EMPTY;
  const patch = (id: string, p: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...(e[id] ?? EMPTY), ...p } }));

  /** The core's input for the first `n` points, as far as they are answered. */
  const inputs = (n: number): CatchUpPoint[] =>
    order.slice(0, n).map((id) => {
      const e = entry(id);
      return { pointId: id, endNo: e.end ?? -1, lastShortG: e.full === false ? e.shortG : null, topUpG: e.fill === null ? null : e.fill ? e.fillG : 0 };
    });
  const planOf = (n: number): CatchUpPlan | null => (n > 0 ? catchUpPlan(inputs(n), opts) : null);
  /** The Σ so far: every point answered up to here. */
  const sofar = (() => {
    for (let n = order.length; n > 0; n--) {
      const p = planOf(n);
      if (p) return p;
    }
    return null;
  })();
  /** The basket left short by the points before `i`, still open (asked at point i). */
  const carriedBefore = (i: number) => {
    if (perPoint || i === 0) return null;
    const p = planOf(i);
    const last = p?.rows[p.rows.length - 1];
    return last && last.kind === 'short' && last.status === 'open' ? last : null;
  };
  const startOf = (i: number) => (perPoint ? 1 : (planOf(i)?.lastNo ?? 0) + 1);

  const sumBar = (
    <View testID="cu-sum-bar" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm, paddingVertical: t.space.sm, paddingHorizontal: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.acceptSunk }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.black, color: t.color.ink, fontVariant: ['tabular-nums'] }}>{msg('cu.sum', { kg: kg(sofar?.totalG ?? 0) })}</Text>
      <AppText variant="bodySm">{sofar ? msg('cu.sumBaskets', { n: sofar.baskets }) : msg('cu.none')}</AppText>
    </View>
  );

  const go = (s: Step) => setStep(s);
  const nextFrom = (s: Step): Step => {
    if (s.kind === 'order') return carriedBefore(0) ? { kind: 'topup', i: 0 } : { kind: 'point', i: 0 };
    if (s.kind === 'topup') return { kind: 'point', i: s.i };
    if (s.kind === 'point' && s.i + 1 < order.length) return carriedBefore(s.i + 1) ? { kind: 'topup', i: s.i + 1 } : { kind: 'point', i: s.i + 1 };
    return { kind: 'summary' };
  };
  const backFrom = (s: Step): Step | null => {
    if (s.kind === 'summary') return { kind: 'point', i: order.length - 1 };
    if (s.kind === 'topup') return s.i > 0 ? { kind: 'point', i: s.i - 1 } : first.kind === 'order' ? first : null;
    if (s.kind === 'point') {
      if (carriedBefore(s.i)) return { kind: 'topup', i: s.i };
      if (s.i > 0) return { kind: 'point', i: s.i - 1 };
      return first.kind === 'order' ? first : null;
    }
    return null;
  };
  const prev = backFrom(now);

  const save = (andNext: boolean) => {
    const plan = planOf(order.length);
    if (!plan || saving.current) return;
    // One save, however often it is pressed (BF-6).
    saving.current = true;
    setDone(true);
    for (const id of order) {
      for (const payload of pointSetupPayloads(state, master, id, { pairId: '', netG: pair.stdNetG, basketG: pair.tareG })) append({ kind: 'sys', payload });
    }
    writeCatchUp(plan.drafts, (body) => append(body as Parameters<typeof append>[0]));
    const last = order[order.length - 1];
    if (andNext) router.replace(`${base}/point?mode=backfill` as Href);
    else router.replace(`${base}/counter?point=${last}` as Href);
  };

  const footer = (ok: boolean, label = msg('cu.next'), onNext = () => go(nextFrom(now))) => (
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      {prev ? (
        <View style={{ flex: 1 }}>
          <Button testID="cu-back" variant="ghost" size="large" onPress={() => go(prev)}>
            {msg('cu.back')}
          </Button>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <CTA testID="cu-next" disabled={!ok} onPress={onNext}>
          {label}
        </CTA>
      </View>
    </View>
  );

  const screen = (subtitle: string, body: React.ReactNode, foot: React.ReactNode) => (
    <FarmScreen title={msg('cu.title')} subtitle={subtitle} fallback={`${base}/counter?point=${pointId}` as Href} onBack={prev ? () => go(prev) : undefined} testID="catch-up" footer={foot}>
      {sumBar}
      {body}
    </FarmScreen>
  );

  // ── BF-1: the order of the tapper's points ──
  if (now.kind === 'order') {
    const toggle = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
    return screen(
      tapper ? nameOf(tapper) : '',
      <View testID="cu-order" style={{ gap: t.space.sm }}>
        <Label text={msg('cu.order')} hint={msg('cu.orderHint')} />
        {tapperPoints.map((p) => {
          const at = order.indexOf(p.id);
          return (
            <Pressable key={p.id} testID={`cu-order-${p.id}`} accessibilityRole="button" accessibilityState={{ selected: at >= 0 }} onPress={() => toggle(p.id)} style={{ ...cardStyle(t), flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: at >= 0 ? t.color.action : t.color.surfaceSunk }}>
                <Text style={{ fontFamily: t.font.family.sans, fontWeight: t.font.weight.black, fontSize: t.font.size.bodyLg, color: at >= 0 ? t.color.inkInverse : t.color.inkSoft }}>{at >= 0 ? String(at + 1) : ''}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{p.name}</AppText>
                {at < 0 ? <AppText variant="bodySm">{msg('cu.orderOff')}</AppText> : null}
              </View>
            </Pressable>
          );
        })}
        <AppText variant="bodySm">{msg('cu.orderTip')}</AppText>
      </View>,
      footer(order.length > 0),
    );
  }

  // ── BF-4: what happened to the basket the last point left short ──
  if (now.kind === 'topup') {
    const id = order[now.i];
    const carried = carriedBefore(now.i)!;
    const e = entry(id);
    const missing = Math.max(0, pair.stdNetG - carried.netG);
    const maxFill = Math.floor(pair.stdNetG * 1.5) - carried.netG;
    const fillOk = e.fill === false || (e.fill === true && e.fillG !== null && e.fillG > 0 && e.fillG <= maxFill);
    return screen(
      `${pointName(id)} · ${tapper ? msg('cu.ofPoints', { name: nameOf(tapper), i: now.i + 1, n: order.length }) : ''}`,
      <View testID="cu-topup" style={{ gap: t.space.sm }}>
        <Label text={msg('cu.topup', { n: carried.basketNo, kg: kg(carried.netG) })} />
        <Choice testID="cu-fill" on={e.fill === true} title={msg('cu.fill')} body={msg('cu.fillBody', { kg: kg(missing) })} onPress={() => patch(id, { fill: true, fillG: e.fillG ?? missing })} />
        {e.fill === true ? (
          <QuantityField
            testID="cu-fill-kg"
            label={msg('cu.fillKg', { n: carried.basketNo })}
            value={e.fillG}
            onChange={(g) => patch(id, { fillG: g })}
            unit={msg('common.kg')}
            decimals={3}
            maxDigits={2}
            validate={(g) => (g > 0 && g <= maxFill ? undefined : msg('cu.fillBad', { kg: kg(Math.floor(pair.stdNetG * 1.5)) }))}
          />
        ) : null}
        <Choice testID="cu-nofill" on={e.fill === false} title={msg('cu.noFill')} body={msg('cu.noFillBody', { n: carried.basketNo, kg: kg(carried.netG), next: carried.basketNo + 1 })} onPress={() => patch(id, { fill: false })} />
      </View>,
      footer(fillOk),
    );
  }

  // ── BF-2/3: one page per point ──
  if (now.kind === 'point') {
    const id = order[now.i];
    const e = entry(id);
    const start = startOf(now.i);
    const topOnly = !perPoint && e.end === start - 1 && !!carriedBefore(now.i);
    const count = e.end !== null && e.end >= start ? e.end - start + 1 : 0;
    const shortOk = e.shortG !== null && e.shortG > 0 && e.shortG < pair.stdNetG;
    const answered = topOnly || (count > 0 && (e.full === true || (e.full === false && shortOk)));
    const ok = answered && planOf(now.i + 1) !== null;
    const sub = tapper && !perPoint ? msg('cu.ofPoints', { name: nameOf(tapper), i: now.i + 1, n: order.length }) : pointName(id);
    return screen(
      `${pointName(id)} · ${sub}`,
      <View testID="cu-point" style={{ gap: t.space.sm }}>
        {perPoint ? <Banner tone="warn" lines={[msg('cu.newPoint'), msg('cu.newPointBody')]} /> : null}
        <Label text={msg('cu.end')} hint={msg('cu.endHint')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, alignItems: 'stretch' }}>
          <View testID="cu-start" style={{ flexGrow: 1, flexBasis: 120, minHeight: t.target.comfortable, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, padding: t.space.sm, justifyContent: 'center' }}>
            <AppText variant="bodySm">{msg('cu.start')}</AppText>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.black, color: t.color.ink, fontVariant: ['tabular-nums'] }}>{String(start)}</Text>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 120 }}>
            <QuantityField testID="cu-end" label={msg('cu.endLabel')} value={e.end} onChange={(n) => patch(id, { end: n })} unit={msg('npsale.basket')} maxDigits={3} />
          </View>
        </View>
        {e.end !== null ? (
          <Text testID="cu-count" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.black, color: t.color.ink, textAlign: 'center' }}>
            {topOnly ? msg('cu.topOnly') : count > 1 ? msg('cu.countRange', { n: count, from: start, to: e.end }) : msg('cu.count', { n: count })}
          </Text>
        ) : null}
        {count > 0 ? (
          <>
            <Label text={msg('cu.fullAsk', { n: e.end! })} />
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <Choice testID="cu-full" on={e.full === true} title={msg('cu.full')} body={msg('cu.fullKg', { kg: kg(pair.stdNetG) })} onPress={() => patch(id, { full: true })} center />
              <Choice testID="cu-short" on={e.full === false} title={msg('cu.short')} body={msg('cu.shortAsk')} onPress={() => {
                  patch(id, { full: false });
                  if (e.shortG === null) setKgOpen(true);
                }} center />
            </View>
            {e.full === false ? (
              <QuantityField
                testID="cu-short-kg"
                label={msg('cu.shortKg', { n: e.end! })}
                value={e.shortG}
                onChange={(g) => patch(id, { shortG: g })}
                unit={msg('common.kg')}
                decimals={3}
                maxDigits={2}
                open={kgOpen}
                onOpenChange={setKgOpen}
                validate={(g) => (g > 0 && g < pair.stdNetG ? undefined : msg('cu.shortBad', { kg: kg(pair.stdNetG) }))}
              />
            ) : null}
          </>
        ) : null}
      </View>,
      footer(ok),
    );
  }

  // ── BF-6/7: the summary, like the paper ──
  const plan = planOf(order.length);
  const diff = plan && paperG !== null ? paperG - plan.totalG : null;
  return screen(
    tapper && !perPoint ? nameOf(tapper) : pointName(pointId),
    <View testID="cu-summary" style={{ gap: t.space.sm }}>
      <View style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xs }}>
        {plan?.rows.map((r, i) => (
          <View key={i} style={{ gap: 2 }}>
            {/* Grouped by point, like the paper (mockup v4 B5). */}
            {i === 0 || plan.rows[i - 1].pointId !== r.pointId ? <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold }}>{pointName(r.pointId)}</AppText> : null}
            <SummaryRow r={r} i={i} std={pair.stdNetG} pointName={pointName} />
          </View>
        ))}
        <View testID="cu-total" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: t.space.sm, borderTopWidth: t.border.thick, borderColor: t.color.rule, paddingTop: t.space.xs }}>
          <AppText style={{ fontWeight: t.font.weight.black }}>{msg('cu.total', { n: plan?.baskets ?? 0 })}</AppText>
          <AppText style={{ fontWeight: t.font.weight.black }}>{msg('cu.totalKg', { kg: kg(plan?.totalG ?? 0) })}</AppText>
        </View>
      </View>
      <QuantityField testID="cu-paper" label={msg('cu.paper')} hint={msg('backfill.optional')} value={paperG} onChange={setPaperG} unit={msg('common.kg')} decimals={3} maxDigits={5} emptyText={msg('backfill.optional')} />
      {diff !== null ? (
        <View testID="cu-paper-check">
          {diff === 0 ? <Banner tone="info" icon={(c) => <Check color={c} />} lines={[msg('cu.paperOk')]} /> : <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} lines={[msg('cu.paperOff', { kg: kg(Math.abs(diff)) })]} />}
        </View>
      ) : null}
      {!perPoint ? <TextLink testID="cu-save-next" onPress={() => save(true)}>{msg('cu.saveNext')}</TextLink> : null}
    </View>,
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      {prev ? (
        <View style={{ flex: 1 }}>
          <Button testID="cu-back" variant="ghost" size="large" onPress={() => go(prev)}>
            {msg('cu.back')}
          </Button>
        </View>
      ) : null}
      <View style={{ flex: 2 }}>
        <CTA testID="cu-save" disabled={!plan || done} onPress={() => save(false)}>
          {msg('cu.save')}
        </CTA>
      </View>
    </View>,
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: t.space.sm }}>
      <AppText style={{ fontWeight: t.font.weight.bold }}>{text}</AppText>
      {hint ? <AppText variant="bodySm">{hint}</AppText> : null}
    </View>
  );
}

/** A big card to choose: the whole card is the target (phone-form-ux rule 11). Nothing is chosen for you. */
function Choice({ testID, on, title, body, onPress, center }: { testID: string; on: boolean; title: string; body: string; onPress: () => void; center?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{
        ...cardStyle(t),
        flex: center ? 1 : undefined,
        minHeight: t.target.comfortable,
        padding: t.space.md,
        gap: 2,
        alignItems: center ? 'center' : 'flex-start',
        justifyContent: 'center',
        borderWidth: on ? t.border.thick : t.border.hair,
        borderColor: on ? t.color.action : t.color.rule,
        backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <AppText style={{ fontWeight: t.font.weight.bold, textAlign: center ? 'center' : 'left' }}>{`${on ? '✓ ' : ''}${title}`}</AppText>
      <AppText variant="bodySm" style={{ textAlign: center ? 'center' : 'left' }}>{body}</AppText>
    </Pressable>
  );
}

function SummaryRow({ r, i, std, pointName }: { r: CatchUpRow; i: number; std: number; pointName: (id: string) => string }) {
  const t = useTheme();
  const msg = useT();
  let text: string;
  if (r.kind === 'full') {
    // "11 × 50" stays on one line (the catalogue keeps no NBSP, so it is tied here).
    text = r.count > 1 ? msg('cu.rowFull', { from: r.from, to: r.to, n: r.count, kg: kgText(std) }).replace(/ × /g, '\u00a0×\u00a0') : msg('cu.rowOne', { n: r.from });
  } else if (r.status === 'open' && !r.topUps.length) {
    text = msg('cu.rowOpen', { n: r.basketNo });
  } else {
    text = msg('cu.rowShort', { n: r.basketNo, kg: kgText(r.firstG) }) + r.topUps.map((u) => msg('cu.rowTop', { point: pointName(u.pointId), kg: kgText(u.g) })).join('') + (r.status === 'closed' ? msg('cu.rowClosed') : '');
  }
  const warn = r.kind === 'short';
  return (
    <View testID={`cu-row-${i}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
      <AppText style={{ flex: 1, minWidth: 0, color: warn ? t.color.warn : t.color.ink }}>{text}</AppText>
      <AppText style={{ fontWeight: t.font.weight.bold, color: warn ? t.color.warn : t.color.ink, fontVariant: ['tabular-nums'] }}>{kgText(r.netG)}</AppText>
    </View>
  );
}
