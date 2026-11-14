/**
 * "ปุ๋ยที่ใส่" — a full page (phone-form-ux rule 12; FZ-2…FZ-9, SP-1…SP-11, mockup v3 screens 2–5, 7, 8).
 * One card per stock card (type + net price per sack). + uses all its stock and opens it; inside an open
 * card: the sacks used (in-app pad), "ไม่ใส่อันนี้", and the split to every active tapper, two per line.
 * "ใช้ปุ๋ย K อย่าง" asks about each part-split card, one at a time, before handing the state back.
 * Nothing is written here: the main page saves.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { fertilizerSplit } from '../../../core/finance/ledger';
import { projectFertilizing, takeCosts, type FertilizingProjection } from '../../../core/finance/fertilizing';
import {
  applyAll,
  cardStatus,
  editorProblems,
  fullPrice,
  notUsing,
  partialCards,
  resolvePartial,
  setCardSacks,
  setPct,
  setTake,
  toFields,
  toggleOpen,
  pickCard,
  type EditorCard,
  type EditorState,
} from '../../../core/finance/fertilizing-editor';
import type { Expense } from '../../../core/finance/ledger';
import { formatDate } from '../../../core/finance/money';
import type { FinanceEvent } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import type { useSyncStatus } from '../../../sync/use-sync-status';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Button, CTA, Check, ChevronRight, CompactMoney, FarmMateArt, PinnedActions, Plus, QuantityField, SegmentedControl, SyncPill, TextLink } from '../../../ui';
import { ConfirmSheet } from '../../money/order-detail/parts';
import { statusKey } from './main-rows';

export function CardsPage({
  initial,
  projection,
  events,
  expenses,
  recordId,
  date,
  catPct,
  sync,
  onApply,
  onClose,
  onOrders,
}: {
  initial: EditorState;
  projection: FertilizingProjection;
  events: readonly FinanceEvent[];
  expenses: readonly Expense[];
  recordId: string | null;
  date: string;
  catPct: number;
  sync?: ReturnType<typeof useSyncStatus>;
  onApply: (s: EditorState) => void;
  onClose: () => void;
  onOrders: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [s, setS] = useState<EditorState>(initial);
  const [asking, setAsking] = useState<EditorState | null>(null);
  const [discard, setDiscard] = useState(false);
  const [pctOf, setPctOf] = useState<string | null>(null);

  const used = s.cards.filter((c) => c.sacks > 0);
  const problems = editorProblems(s);
  const pctFor = (w: string) => s.pct[w] ?? catPct;

  // Each tapper's cost per card, exactly as the saved record will draw it: the draft projected with the log.
  const costs = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    if (!used.length) return out;
    const fields = toFields(s, { date, zones: [], reasons: [], note: '' });
    const preview: FinanceEvent = { id: '~preview', groupId: '', deviceSeq: 0, ts: 0, actor: { userId: '', deviceId: '' }, source: 'app', targetId: 'fz-~preview', baseEventId: null, payload: { t: 'fertilizing_recorded', fields } };
    const r = projectFertilizing([...events, preview], expenses, { exclude: recordId ?? undefined }).records.find((x) => x.id === 'fz-~preview');
    used.forEach((c, i) => {
      const line = r?.lines[i];
      if (line) out.set(c.card.key, takeCosts(line));
    });
    return out;
  }, [s, events, expenses, recordId, date, used]);

  const ordered = useMemo(() => {
    const by = new Map<string, number>();
    for (const x of expenses) {
      if (x.deleted || x.categoryId !== 'cat-fertilizer' || x.stage === 'actual' || !x.fertilizer) continue;
      const name = x.fertilizer.formula;
      by.set(name, (by.get(name) ?? 0) + (x.fertilizer.sacks ?? x.line?.qty ?? 0));
    }
    return [...by].map(([name, sacks]) => `${name} ${sacks} ${msg('fz.unit')}`);
  }, [expenses, msg]);

  const apply = () => {
    const ask = partialCards(s);
    if (ask.length) setAsking(s);
    else onApply(s);
  };
  const answer = (key: string, how: 'return' | 'farm' | 'later') => {
    if (!asking) return;
    const next = resolvePartial(asking, key, how);
    setS(next);
    if (partialCards(next).length) setAsking(next);
    else {
      setAsking(null);
      onApply(next);
    }
  };
  const asked = asking ? partialCards(asking)[0] : null;
  // Ask only when something was changed here (review #188 N2): a saved one reopened and closed asks nothing.
  const close = () => (JSON.stringify(s.cards) !== JSON.stringify(initial.cards) || JSON.stringify(s.pct) !== JSON.stringify(initial.pct) || JSON.stringify(s.settle) !== JSON.stringify(initial.settle) ? setDiscard(true) : onClose());
  const shortDate = formatDate(date).split(' ').slice(0, 2).join(' ');
  const pctWorker = pctOf ? s.people[pctOf] : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, minHeight: t.layout.topBarHeight, paddingLeft: t.space.xs, paddingRight: t.space.md }}>
        <Pressable testID="fz-cards-close" accessibilityRole="button" accessibilityLabel={msg('fz.cards.close')} onPress={close} style={{ minWidth: t.target.min, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ transform: [{ rotate: '45deg' }] }}>
            <Plus color={t.color.ink} />
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="heading">{msg('fz.cards.title')}</AppText>
          <AppText variant="bodySm">{msg('fz.cards.subtitle', { date: shortDate })}</AppText>
        </View>
        {sync ? <SyncPill status={sync} /> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {s.cards.length ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TextLink testID="fz-use-all" onPress={() => setS(applyAll(s))}>{msg('fz.useAll')}</TextLink>
          </View>
        ) : (
          <View testID="fz-empty" style={{ alignItems: 'center', gap: t.space.sm, padding: t.space.xl, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised }}>
            <FarmMateArt id="materials.stock" size={56} />
            <AppText variant="heading" style={{ textAlign: 'center' }}>{msg('fz.empty.title')}</AppText>
            <AppText variant="bodySm" style={{ textAlign: 'center' }}>{msg('fz.empty.body')}</AppText>
          </View>
        )}
        {s.cards.map((c, i) => (
          <FertCard
            key={c.card.key}
            index={i}
            c={c}
            open={s.open === c.card.key}
            tappers={s.tappers}
            people={s.people}
            costs={costs.get(c.card.key)}
            pctFor={pctFor}
            settleOf={(w) => s.settle[w] ?? 'debt'}
            onUse={() => setS(pickCard(s, c.card.key))}
            onToggle={() => setS(toggleOpen(s, c.card.key))}
            onSacks={(n) => setS(setCardSacks(s, c.card.key, n))}
            onSkip={() => setS(notUsing(s, c.card.key))}
            onTake={(w, n) => setS(setTake(s, c.card.key, w, n))}
            onDebt={(w) => setPctOf(w)}
          />
        ))}
        {ordered.length ? (
          <Pressable testID="fz-ordered" accessibilityRole="button" onPress={onOrders} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.rule }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fz.ordered')}</AppText>
              <AppText variant="bodySm">{ordered.join(' · ')}</AppText>
            </View>
            <ChevronRight color={t.color.ink} />
          </Pressable>
        ) : null}
      </ScrollView>
      <PinnedActions>
        <CTA testID="fz-apply" disabled={problems.length > 0} onPress={apply}>
          {used.length ? msg('fz.apply', { n: used.length }) : msg('fz.notChosen')}
        </CTA>
      </PinnedActions>

      {asked ? (
        <BottomSheet open onClose={() => { setAsking(null); setS({ ...s, open: asked.card.key }); }} testID="fz-partial-sheet" title={msg('fz.partial.title', { name: asked.card.formula, price: fullPrice(asked.card.perSackSatang) })} closeLabel={msg('fz.cards.close')}>
          <PartialBody c={asked} onAnswer={(how) => answer(asked.card.key, how)} />
        </BottomSheet>
      ) : null}
      {discard ? (
        <ConfirmSheet testID="fz-discard-sheet" title={msg('fz.discard.title')} body={msg('fz.discard.body')} confirmLabel={msg('fz.discard.yes')} cancelLabel={msg('fz.discard.no')} onConfirm={onClose} onClose={() => setDiscard(false)} />
      ) : null}
      {pctWorker ? (
        <PctSheet
          name={pctWorker.name}
          pct={pctFor(pctWorker.id)}
          settle={s.settle[pctWorker.id] ?? 'debt'}
          onDone={(pct, settle) => {
            setS(setPct(s, pctWorker.id, pct, settle));
            setPctOf(null);
          }}
          onClose={() => setPctOf(null)}
        />
      ) : null}
    </View>
  );
}

function PartialBody({ c, onAnswer }: { c: EditorCard; onAnswer: (how: 'return' | 'farm' | 'later') => void }) {
  const t = useTheme();
  const msg = useT();
  const given = Object.values(c.takes).reduce((a, x) => a + x.sacks, 0);
  const left = c.sacks - given;
  return (
    <View style={{ gap: t.space.md }}>
      <AppText variant="bodySm">{msg('fz.partial.sub', { given, sacks: c.sacks })}</AppText>
      <View style={{ backgroundColor: t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fz.partial.left', { n: left })}</AppText>
      </View>
      <CTA testID="fz-partial-return" onPress={() => onAnswer('return')}>{msg('fz.partial.return', { n: left })}</CTA>
      <Button testID="fz-partial-farm" size="large" onPress={() => onAnswer('farm')}>{msg('fz.partial.farm', { n: left })}</Button>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <TextLink testID="fz-partial-later" onPress={() => onAnswer('later')}>{msg('fz.partial.later')}</TextLink>
      </View>
    </View>
  );
}

function PctSheet({ name, pct, settle, onDone, onClose }: { name: string; pct: number; settle: 'debt' | 'paid'; onDone: (pct: number, settle: 'debt' | 'paid') => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [p, setP] = useState(pct);
  const [how, setHow] = useState(settle);
  return (
    <BottomSheet open onClose={onClose} testID="fz-pct-sheet" title={msg('fz.pct.title', { name })}>
      <View style={{ gap: t.space.md }}>
        <QuantityField testID="fz-pct-value" label={msg('fz.pct.label')} unit="%" value={p} min={0} max={100} maxDigits={3} onChange={setP} />
        <AppText variant="label">{msg('fz.pct.how')}</AppText>
        <SegmentedControl testID="fz-pct-settle" value={how} onChange={setHow} options={[{ value: 'debt', label: msg('fz.pct.debt') }, { value: 'paid', label: msg('fz.pct.paid') }]} />
        <CTA testID="fz-pct-done" onPress={() => onDone(p, how)}>{msg('fz.pct.done')}</CTA>
      </View>
    </BottomSheet>
  );
}

function FertCard({
  index,
  c,
  open,
  tappers,
  people,
  costs,
  pctFor,
  settleOf,
  onUse,
  onToggle,
  onSacks,
  onSkip,
  onTake,
  onDebt,
}: {
  index: number;
  c: EditorCard;
  open: boolean;
  tappers: EditorState['tappers'];
  people: EditorState['people'];
  costs: Map<string, number> | undefined;
  pctFor: (workerId: string) => number;
  settleOf: (workerId: string) => 'debt' | 'paid';
  onUse: () => void;
  onToggle: () => void;
  onSacks: (n: number) => void;
  onSkip: () => void;
  onTake: (workerId: string, n: number) => void;
  onDebt: (workerId: string) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const id = `fz-card-${index}`;
  const usedCard = c.sacks > 0;
  const given = Object.values(c.takes).reduce((a, x) => a + x.sacks, 0);
  const status = cardStatus(c);
  // Former tappers still on a saved split stay visible after the active ones.
  const cells = [...tappers, ...Object.keys(c.takes).filter((w) => !tappers.some((p) => p.id === w)).map((w) => people[w])];
  const statusColor = status === 'none' || status === 'partial' || status === 'over' ? t.color.warn : t.color.inkSoft;

  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
      <View style={{ width: 56, height: 56, borderRadius: t.radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: usedCard ? t.color.accept : t.color.actionSunk }}>
        {usedCard ? <Check color={t.color.inkInverse} /> : <Plus color={t.color.action} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{c.card.formula}{c.card.brand ? ` ${c.card.brand}` : ''}</AppText>
        <AppText variant="bodySm">
          <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('fz.perSack', { price: fullPrice(c.card.perSackSatang) })}</Text>
          {c.card.sackKg ? ` · ${msg('fz.kg', { kg: c.card.sackKg })}` : ''}
        </AppText>
        {c.card.shops.length ? <AppText variant="bodySm">{c.card.shops.join(' · ')}</AppText> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText testID={`${id}-stock`} variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{String(c.stock)}</AppText>
        <AppText variant="bodySm">{msg('fz.inStock')}</AppText>
      </View>
    </View>
  );

  if (!usedCard) {
    return (
      <Pressable testID={id} accessibilityRole="button" onPress={onUse} style={{ padding: t.space.md, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceSunk, borderWidth: t.border.hair, borderColor: t.color.rule }}>
        {head}
      </Pressable>
    );
  }

  return (
    <View testID={id} style={{ padding: t.space.md, gap: t.space.md, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.thick, borderColor: t.color.ink }}>
      <Pressable accessibilityRole="button" onPress={onToggle}>{head}</Pressable>
      {open ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.md }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fz.put')}</AppText>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <QuantityField testID={`${id}-sacks`} hideLabel label={msg('fz.put')} unit={msg('fz.unit')} value={c.sacks} min={0} onChange={onSacks} />
            </View>
            <TextLink testID={`${id}-skip`} onPress={onSkip}>{msg('fz.skip')}</TextLink>
          </View>
          {c.sacks > c.stock ? <AppText testID={`${id}-over`} style={{ color: t.color.reject, fontWeight: t.font.weight.bold }}>{msg('fz.overStock', { n: c.sacks - c.stock })}</AppText> : null}
          <View style={{ height: t.border.hair, backgroundColor: t.color.rule }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fz.split')}</AppText>
            <AppText variant="bodySm">{msg('fz.splitHint')}</AppText>
          </View>
          {cells.length === 0 ? <AppText variant="bodySm">{msg('fz.noTappers')}</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.space.sm }}>
            {cells.map((p) => {
              const take = c.takes[p.id];
              const sacks = take?.sacks ?? 0;
              const left = Math.max(0, c.sacks - (given - sacks));
              const cost = costs?.get(p.id) ?? 0;
              const paid = settleOf(p.id) === 'paid';
              return (
                <View key={p.id} style={{ width: '48.5%', gap: t.space.xs, padding: t.space.sm, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.xs }}>
                    <FarmMateArt id="people.tapper" size={32} />
                    <AppText style={{ fontWeight: t.font.weight.bold, flexShrink: 1 }}>{p.name}</AppText>
                    {take?.auto ? (
                      <View testID={`${id}-auto-${p.id}`} style={{ paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.actionSunk }}>
                        <AppText variant="bodySm" style={{ color: t.color.action, fontWeight: t.font.weight.bold }}>{msg('fz.auto')}</AppText>
                      </View>
                    ) : null}
                  </View>
                  <QuantityField
                    testID={`${id}-take-${p.id}`}
                    hideLabel
                    label={msg('fz.takeOf', { name: p.name })}
                    unit={msg('fz.unit')}
                    value={sacks}
                    min={0}
                    sheetNote={msg('fz.takeLeft', { n: left })}
                    shortcuts={[
                      { label: msg('fz.takeAll', { n: left }), value: left, testID: `${id}-take-${p.id}-all` },
                      { label: msg('fz.takeNone'), value: 0, testID: `${id}-take-${p.id}-none` },
                    ]}
                    onChange={(n) => onTake(p.id, n)}
                  />
                  {sacks > 0 ? (
                    <>
                      <AppText testID={`${id}-cost-${p.id}`} variant="bodySm">
                        {msg('fz.cost')} <CompactMoney satang={cost} size="bodyLg" />
                      </AppText>
                      <Pressable testID={`${id}-debt-${p.id}`} accessibilityRole="button" onPress={() => onDebt(p.id)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
                        <AppText variant="bodySm" style={{ textDecorationLine: 'underline' }}>
                          {paid ? msg('fz.paidCash') : <>{msg('fz.debt')} <CompactMoney satang={fertilizerSplit(cost, pctFor(p.id)).workerSatang} size="bodyLg" /></>}
                        </AppText>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
          <AppText testID={`${id}-given`} style={{ textAlign: 'center', fontWeight: t.font.weight.bold, color: status === 'full' ? t.color.ink : t.color.warn }}>
            {given > c.sacks ? msg('fz.givenOver', { n: given, over: given - c.sacks }) : given < c.sacks ? msg('fz.givenLeft', { n: given, left: c.sacks - given }) : msg('fz.given', { n: given })}
          </AppText>
          <Pressable testID={`${id}-collapse`} accessibilityRole="button" accessibilityLabel={msg('fz.cards.close')} onPress={onToggle} style={{ minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: '-90deg' }] }}>
              <ChevronRight color={t.color.inkSoft} />
            </View>
          </Pressable>
        </>
      ) : (
        <Pressable testID={`${id}-expand`} accessibilityRole="button" onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', minHeight: t.target.min }}>
          <AppText style={{ flex: 1 }}>
            {msg('fz.put')} <Text style={{ fontWeight: t.font.weight.bold }}>{c.sacks} {msg('fz.unit')}</Text> · <Text style={{ fontWeight: t.font.weight.bold, color: statusColor }}>{msg(`fz.status.${statusKey(c)}`)}</Text>
          </AppText>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <ChevronRight color={t.color.inkSoft} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
