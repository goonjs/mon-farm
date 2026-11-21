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
 * stays open for live counting (BF-5).
 *
 * E04-S26: at any time, one point at a time, even after counting live — the
 * baskets number on from the last one of the sequence (AT-1/2), a short
 * basket still open is asked about first (AT-3), and only clearing the money
 * stops it (AT-4).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { openBasketIn, stdNetOfLog } from '../../core/bridge';
import { catchUpAllowed, catchUpPlan, writeCatchUp, type CatchUpOpen, type CatchUpPlan, type CatchUpPoint, type CatchUpRow } from '../../core/catch-up';
import { pointsOf, tapperOn } from '../../core/master';
import { pairForNewPoint } from '../../core/sale-move';
import { nextBasketNo, pointSetupPayloads } from '../../core/sale-points';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, Button, cardStyle, Check, CTA, FarmMateArt, QuantityField, TextLink } from '../../ui';
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
  // Opened for a point (`?point=`) or, from the picker and the counter's menu, for a tapper (`?tapper=`, owner 2026-11-16).
  const params = useLocalSearchParams<{ point?: string; tapper?: string }>();
  const tapperParam = params.tapper ?? '';
  // Opened for a tapper, the tapper decides: a point in the same link is ignored (review N1).
  const pointParam = tapperParam ? '' : (params.point ?? '');
  const view = useSaleView();
  // Clearing the money is in the finance log (review N3).
  const fin = useFinance();
  // A closed sale takes no more weighing (review #2).
  useLeaveIfClosed(view);
  const { saleId, events, state, master, day, mode, settings, append, nameOf, saleTitle } = view;
  const [picked, setPicked] = useState<string[]>(pointParam ? [pointParam] : []);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [step, setStep] = useState<Step | null>(null);
  const [paperG, setPaperG] = useState<number | null>(null);
  // The kg pad opens at once when "ไม่เต็ม" is chosen (NP-15).
  const [kgOpen, setKgOpen] = useState(false);
  const saving = useRef(false);
  // Saved: the screen stays as it was until the router moves on (the log now has baskets, BF-8 would show).
  const [done, setDone] = useState(false);
  const base = `/v2/sale/${saleId}`;

  const loading = <FarmScreen title={msg('cu.title')} subtitle={saleTitle} fallback={`${base}/point` as Href} />;
  if (!view.ready || !master || !settings || fin.events === null) return loading;

  const perPoint = mode === 'per-point';
  const tapper = tapperParam || (pointParam ? tapperOn(master, pointParam, day) : null);
  const tapperPoints = tapper ? pointsOf(master, tapper, day) : [];
  const pointId = pointParam || tapperPoints[0]?.id || '';
  if (!master.points.some((p) => p.id === pointId)) {
    if (!tapperParam) return loading;
    // A tapper with no points on the sale day: say so (review N2).
    return (
      <FarmScreen title={msg('cu.title')} subtitle={saleTitle} fallback={`${base}/point` as Href} testID="catch-up">
        <View testID="cu-no-points">
          <Banner tone="warn" lines={[msg('cu.noPoints', { name: nameOf(tapperParam) }), msg('cu.noPointsBody')]} />
        </View>
      </FarmScreen>
    );
  }
  // The order page: the tapper's points in paper order. Per point, only when opened for the tapper.
  const choosing = tapperPoints.length > 1 && (!perPoint || !pointParam);
  const order = choosing ? picked : [pointId];
  const tapperOf = (id: string) => tapperOn(master, id, day);
  const back = (pointParam ? `${base}/counter?point=${pointParam}` : `${base}/point`) as Href;
  /** Each point's basket pair: its pile's when it was set up already, else the one a new point gets (review B1). */
  const pairOf = (id: string) => {
    const pile = state.piles.find((p) => p.id === id);
    if (pile) return { stdNetG: pile.stdNetG, tareG: pile.tareG };
    const p = pairForNewPoint(events, settings, null);
    return { stdNetG: p.netG, tareG: p.basketG };
  };
  const pair = pairOf(pointId);
  // AT-2: numbered on from the last basket of the sequence, never inserted. Per point, each point its own.
  const firstNoOf = (id: string) => nextBasketNo(events, id, mode, tapperOf);
  const opts = { mode, firstNo: firstNoOf(order[0] ?? pointId), stdNetG: pair.stdNetG, tareG: pair.tareG };
  const stdOfLog = stdNetOfLog(events);
  /** AT-3: the short basket still open in this point's sequence, with its root pile's standard (review N2). */
  const openAt = (id: string): CatchUpOpen | undefined => {
    const o = openBasketIn(events, master, day, id, mode, stdOfLog);
    return o ? { rootId: o.rootId, basketNo: o.basketNo, pointId: o.pointId, haveG: o.haveG, stdNetG: pairOf(o.pointId).stdNetG, tareG: o.tareG } : undefined;
  };
  /** Where an open basket from the log is asked: continuous, at the first point entered; per point, at its own point (review N4). */
  const openFor = (i: number) => (perPoint || i === 0 ? openAt(order[i]) : undefined);
  const pointName = (id: string) => master.points.find((p) => p.id === id)?.name ?? '';
  const kg = (g: number) => kgText(g);

  // AT-4: not once clearing the money has started; nothing to go on with until the ticks and debt lines are taken back.
  if (!done && !catchUpAllowed(fin.events, saleId)) {
    return (
      <FarmScreen title={msg('cu.title')} subtitle={saleTitle} fallback={back} testID="catch-up">
        <View testID="cu-blocked">
          <Banner tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} lines={[msg('cu.blockedClearing'), msg('cu.blockedClearingBody')]} />
        </View>
      </FarmScreen>
    );
  }

  const first: Step = choosing ? { kind: 'order' } : { kind: 'point', i: 0 };
  const now = step ?? first;
  const entry = (id: string) => entries[id] ?? EMPTY;
  const patch = (id: string, p: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...(e[id] ?? EMPTY), ...p } }));

  /** The core's input for the first `n` points, as far as they are answered. */
  const inputs = (n: number): CatchUpPoint[] =>
    order.slice(0, n).map((id) => {
      const e = entry(id);
      const i = order.indexOf(id);
      return {
        pointId: id,
        endNo: e.end ?? -1,
        lastShortG: e.full === false ? e.shortG : null,
        topUpG: e.fill === null ? null : e.fill ? e.fillG : 0,
        pair: pairOf(id),
        ...(perPoint ? { firstNo: firstNoOf(id) } : {}),
        ...(openFor(i) ? { open: openFor(i) } : {}),
      };
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
  /** The basket to ask about at point i: one open in the log (AT-3), or one the points before left short. */
  const carriedBefore = (i: number): { readonly basketNo: number; readonly netG: number; readonly pointId: string } | null => {
    const open = openFor(i);
    if (open) return { basketNo: open.basketNo, netG: open.haveG, pointId: open.pointId };
    if (perPoint || i === 0) return null;
    const p = planOf(i);
    const last = p?.rows[p.rows.length - 1];
    return last && last.kind === 'short' && last.status === 'open' ? last : null;
  };
  const startOf = (i: number) => (perPoint ? firstNoOf(order[i]) : i === 0 ? opts.firstNo : (planOf(i)?.lastNo ?? opts.firstNo - 1) + 1);

  const sumBar = (
    <View testID="cu-sum-bar" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm, paddingVertical: t.space.sm, paddingHorizontal: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.acceptSunk }}>
      {/* The Σ is code: the text catalogue keeps to Thai and Latin (summary-lines: the total is led by Σ). */}
      <FarmMateArt id="sale.weigh" size={32} />
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.black, color: t.color.ink, fontVariant: ['tabular-nums'] }}>{`Σ ${msg('cu.sum', { kg: kg(sofar?.totalG ?? 0) })}`}</Text>
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
      const own = pairOf(id);
      for (const payload of pointSetupPayloads(state, master, id, { pairId: '', netG: own.stdNetG, basketG: own.tareG })) append({ kind: 'sys', payload });
      // Counting goes on here at once, no scale check first (E04-S23 JB-3a); the check setting still applies to the next point.
      // A pile closed already stays closed: no second ready (E04-S26).
      const status = state.piles.find((p) => p.id === id)?.status;
      if (status !== 'counting' && status !== 'closed') append({ kind: 'sys', payload: { t: 'ready', pileId: id } });
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
    <FarmScreen title={msg('cu.title')} subtitle={subtitle} fallback={back} onBack={prev ? () => go(prev) : undefined} testID="catch-up" footer={foot}>
      {sumBar}
      {body}
    </FarmScreen>
  );

  // ── BF-1: the order of the tapper's points ──
  if (now.kind === 'order') {
    const toggle = (id: string) => setPicked((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
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
    // The basket is judged by the pair of the point it started at.
    const root = pairOf(carried.pointId);
    const missing = Math.max(0, root.stdNetG - carried.netG);
    const maxFill = Math.floor(root.stdNetG * 1.5) - carried.netG;
    const fillOk = e.fill === false || (e.fill === true && e.fillG !== null && e.fillG > 0 && e.fillG <= maxFill);
    return screen(
      tapper ? nameOf(tapper) : saleTitle,
      <View testID="cu-topup" style={{ gap: t.space.sm }}>
        <PointHead name={pointName(id)} at={msg('cu.pointOf', { i: now.i + 1, n: order.length })} />
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
            validate={(g) => (g > 0 && g <= maxFill ? undefined : msg('cu.fillBad', { kg: kg(Math.floor(root.stdNetG * 1.5)) }))}
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
    const own = pairOf(id);
    const start = startOf(now.i);
    const topOnly = e.end === start - 1 && !!carriedBefore(now.i);
    const count = e.end !== null && e.end >= start ? e.end - start + 1 : 0;
    const shortOk = e.shortG !== null && e.shortG > 0 && e.shortG < own.stdNetG;
    const answered = topOnly || (count > 0 && (e.full === true || (e.full === false && shortOk)));
    const ok = answered && planOf(now.i + 1) !== null;
    return screen(
      tapper ? nameOf(tapper) : saleTitle,
      <View testID="cu-point" style={{ gap: t.space.sm }}>
        <PointHead name={pointName(id)} at={order.length > 1 ? msg('cu.pointOf', { i: now.i + 1, n: order.length }) : ''} />
        {perPoint && start === 1 ? <Banner tone="warn" lines={[msg('cu.newPoint'), msg('cu.newPointBody')]} /> : null}
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
              <Choice testID="cu-full" on={e.full === true} title={msg('cu.full')} body={msg('cu.fullKg', { kg: kg(own.stdNetG) })} onPress={() => patch(id, { full: true })} center />
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
                validate={(g) => (g > 0 && g < own.stdNetG ? undefined : msg('cu.shortBad', { kg: kg(own.stdNetG) }))}
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
            <SummaryRow r={r} i={i} pointName={pointName} />
          </View>
        ))}
        <View testID="cu-total" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: t.space.sm, borderTopWidth: t.border.thick, borderColor: t.color.rule, paddingTop: t.space.xs }}>
          <AppText style={{ fontWeight: t.font.weight.black }}>{`Σ ${msg('cu.total', { n: plan?.baskets ?? 0 })}`}</AppText>
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

/** The point being entered, so it is found at a glance (owner 2026-11-16): its name big, then "1 จาก 2 จุด". */
function PointHead({ name, at }: { name: string; at: string }) {
  const t = useTheme();
  return (
    <View testID="cu-point-name" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: t.space.sm, rowGap: 4, borderLeftWidth: 6, borderLeftColor: t.color.action, backgroundColor: t.color.actionSunk, borderRadius: t.radius.md, paddingVertical: t.space.sm, paddingHorizontal: t.space.md }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.black, color: t.color.ink, flexShrink: 1 }}>{name}</Text>
      {at ? <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold }}>{at}</AppText> : null}
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

function SummaryRow({ r, i, pointName }: { r: CatchUpRow; i: number; pointName: (id: string) => string }) {
  const t = useTheme();
  const msg = useT();
  let text: string;
  if (r.kind === 'full') {
    // "11 × 50" stays on one line (the catalogue keeps no NBSP, so it is tied here).
    text = r.count > 1 ? msg('cu.rowFull', { from: r.from, to: r.to, n: r.count, kg: kgText(r.netG / r.count) }).replace(/ × /g, '\u00a0×\u00a0') : msg('cu.rowOne', { n: r.from });
  } else if (r.status === 'open' && !r.topUps.length) {
    text = msg('cu.rowOpen', { n: r.basketNo });
  } else {
    // A basket counted live says so, so its live kg is not read as part of this entry (owner 2026-11-21).
    const head = r.liveG !== undefined ? msg('cu.rowLive', { n: r.basketNo, kg: kgText(r.liveG) }) : msg('cu.rowShort', { n: r.basketNo, kg: kgText(r.firstG) });
    text = head + r.topUps.map((u) => msg('cu.rowTop', { point: pointName(u.pointId), kg: kgText(u.g) })).join('') + (r.status === 'closed' ? msg('cu.rowClosed') : '');
  }
  const warn = r.kind === 'short';
  // A basket from the log shows what this catch-up adds to it; the Σ adds the same.
  const addedG = r.netG - (r.kind === 'short' ? (r.liveG ?? 0) : 0);
  return (
    <View testID={`cu-row-${i}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
      <AppText style={{ flex: 1, minWidth: 0, color: warn ? t.color.warn : t.color.ink }}>{text}</AppText>
      <AppText style={{ fontWeight: t.font.weight.bold, color: warn ? t.color.warn : t.color.ink, fontVariant: ['tabular-nums'] }}>{kgText(addedG)}</AppText>
    </View>
  );
}
