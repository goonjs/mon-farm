/**
 * "แบ่งให้คนกรีด" (FD-5): per tapper a QuantityField of sacks, "{name}รับส่วนนี้ {amount}" and a chip
 * "50% · หักตอนขายยาง" that opens the % / settle choice. "ไม่แบ่ง" writes `share: null`.
 * One BottomSheet with three views (list, one tapper's %, pick a tapper): a sheet never opens on a sheet,
 * except the number pad of a QuantityField.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Expense } from '../../../core/finance/ledger';
import { formatSatang } from '../../../core/finance/money';
import { lastLineSacks } from '../../../core/finance/share';
import type { ExpensePatch, Payer, ShareSettle } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Button, Card, Check, PersonIcon, Plus, QuantityField, RadioCard, SegmentedControl } from '../../../ui';
import { ItemRow, SheetTitle, SummaryBar } from './parts';
import { itemSacks, tapperPatch, tapperProblems, tapperSplit, type TapperInput } from './tell';
import { SolidCTA } from '../order/solid-cta';

type View_ = 'list' | 'pick' | { pct: number };

export function TappersSheet({
  item,
  tappers,
  catPct,
  onSave,
  onClose,
}: {
  item: Expense;
  /** People with the tapper role. */
  tappers: readonly Payer[];
  /** The category's default tapper %. */
  catPct: number;
  onSave: (patch: ExpensePatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const total = itemSacks(item);
  const [lines, setLines] = useState<readonly TapperInput[]>(() => (item.share?.lines ?? []).map((l) => ({ worker: l.worker, sacks: l.sacks ?? 0, pct: l.workerPct, settle: l.settle })));
  const [view, setView] = useState<View_>('list');
  const [failed, setFailed] = useState(false);

  const given = lines.reduce((s, l) => s + l.sacks, 0);
  const left = Math.max(0, total - given);
  const problems = tapperProblems(item, lines);
  const over = problems.includes('sacks-over');
  const split = tapperSplit(item, lines);
  const setLine = (i: number, p: Partial<TapperInput>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const how = (s: ShareSettle) => msg(s === 'debt' ? 'ordd.tap.debt' : 'ordd.tap.paid');

  const save = async (next: readonly TapperInput[] | null) => {
    if (await onSave(tapperPatch(item, next))) onClose();
    else setFailed(true);
  };

  if (typeof view === 'object') {
    const l = lines[view.pct];
    if (!l) return null;
    return (
      <BottomSheet open onClose={() => setView('list')} testID="ordd-tap-pct-sheet" title={msg('ordd.tap.pctTitle', { name: l.worker.name })}>
        <View style={{ gap: t.space.md }}>
          <QuantityField testID="ordd-tap-pct-value" label={msg('ordd.tap.pctLabel')} unit="%" value={l.pct} min={0} max={100} maxDigits={3} onChange={(n) => setLine(view.pct, { pct: n })} />
          <AppText variant="label">{msg('ordd.tap.how')}</AppText>
          <SegmentedControl testID="ordd-tap-settle" value={l.settle} onChange={(v) => setLine(view.pct, { settle: v })} options={[{ value: 'debt', label: msg('ordd.tap.debt') }, { value: 'paid', label: msg('ordd.tap.paid') }]} />
          {item.stage === 'committed' && l.settle === 'debt' ? <AppText testID="ordd-tap-later" variant="caption">{msg('ordd.tap.later')}</AppText> : null}
          <SolidCTA testID="ordd-tap-pct-done" icon={(c) => <Check color={c} />} onPress={() => setView('list')}>{msg('ordd.tap.done')}</SolidCTA>
        </View>
      </BottomSheet>
    );
  }

  if (view === 'pick') {
    const free = tappers.filter((p) => !lines.some((l) => l.worker.id === p.id));
    return (
      <BottomSheet open onClose={() => setView('list')} testID="ordd-tap-pick-sheet" title={msg('ordd.tap.pick')}>
        <View style={{ gap: t.space.sm }}>
          {free.length === 0 ? <AppText variant="bodySm">{msg('ordd.tap.noPeople')}</AppText> : null}
          {free.map((p) => (
            <RadioCard
              key={p.id}
              testID={`ordd-pick-${p.id}`}
              selected={false}
              title={p.name}
              onPress={() => {
                // The one added gets the sacks the others left.
                setLines((ls) => [...ls, { worker: p, sacks: lastLineSacks(total, ls.map((l) => l.sacks)), pct: catPct, settle: 'debt' }]);
                setView('list');
              }}
            />
          ))}
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} testID="ordd-tappers-sheet" title={msg('ordd.tap.title')}>
      <View style={{ gap: t.space.md }}>
        <SheetTitle>{msg('ordd.tap.sub', { item: item.item, sacks: total })}</SheetTitle>
        <SummaryBar testID="ordd-tap-sum" tone={over ? 'bad' : lines.length ? 'ok' : 'calm'} left={msg('ordd.tap.sum', { given, total })} right={over ? msg('ordd.tap.over', { total }) : lines.length ? msg('ordd.tap.left', { n: left }) : undefined} />
        {lines.length === 0 && tappers.length === 0 ? <AppText variant="bodySm">{msg('ordd.tap.noPeople')}</AppText> : null}
        {lines.map((l, i) => (
          <Card key={l.worker.id} testID={`ordd-tap-${l.worker.id}`} style={{ gap: t.space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <PersonIcon color={t.color.ink} />
              <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{l.worker.name}</AppText>
              <Pressable testID={`ordd-tap-${l.worker.id}-remove`} accessibilityRole="button" accessibilityLabel={`${msg('ordd.tap.remove')} ${l.worker.name}`} onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.sm }}>
                <AppText variant="bodySm" style={{ textDecorationLine: 'underline' }}>{msg('ordd.tap.remove')}</AppText>
              </Pressable>
            </View>
            <QuantityField testID={`ordd-tap-${l.worker.id}-sacks`} label={msg('ordd.tap.sacksOf', { name: l.worker.name })} unit={msg('ordd.zones.unit')} value={l.sacks} min={0} max={total} onChange={(n) => setLine(i, { sacks: n })} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
              <View style={{ flexShrink: 1 }}>
                <AppText testID={`ordd-tap-${l.worker.id}-part`} variant="bodySm">
                  {msg('ordd.tap.part', { name: l.worker.name, amount: split ? formatSatang(split.lines[i].workerSatang) : '-' })}
                </AppText>
              </View>
              <Pressable
                testID={`ordd-tap-${l.worker.id}-chip`}
                accessibilityRole="button"
                onPress={() => setView({ pct: i })}
                style={{ minHeight: t.target.comfortable, justifyContent: 'center', paddingHorizontal: t.space.md, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised, flexShrink: 1 }}
              >
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.ink }}>{msg('ordd.tap.chip', { pct: l.pct, how: how(l.settle) })}</Text>
              </Pressable>
            </View>
          </Card>
        ))}
        {item.stage === 'committed' && lines.some((l) => l.settle === 'debt') ? <AppText testID="ordd-tap-hint" variant="caption">{msg('ordd.tap.later')}</AppText> : null}
        <ItemRow testID="ordd-tap-add" dashed icon={<Plus color={t.color.action} />} title={msg('ordd.tap.add')} onPress={() => setView('pick')} />
        {failed ? <AppText testID="ordd-tap-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
        <SolidCTA testID="ordd-tap-done" disabled={problems.length > 0} icon={(c) => <Check color={c} />} onPress={() => void save(lines.length ? lines : null)}>{msg('ordd.tap.done')}</SolidCTA>
        <Button testID="ordd-tap-none" onPress={() => void save(null)}>{msg('ordd.tap.none')}</Button>
      </View>
    </BottomSheet>
  );
}
