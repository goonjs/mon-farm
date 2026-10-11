/**
 * /v2/sale/<id>/history?point= — รายการเข่ง, the sale's basket history (sale
 * mockup v1.1.0 page 8d, E04-S15). Read only: every basket recorded, newest
 * first, with its kind, net kg, point, tapper, the time to the second and the
 * total so far. A basket taken back stays in the list, marked with when — the
 * list says what was done — but is not in any total. Above the rows: the sum a
 * person can check against the slip, and a check that the numbers run on with
 * none missing or twice. Filters: kind and tapper (everyone to start with).
 * Rows come from `basketList`; nothing about money is recomputed here, and it
 * works offline.
 */

import { useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { checkNumbers, filterHistory, historyEquation, historySummary, runningTotals, type HistoryKind } from '../../core/basket-history';
import { tapperOn } from '../../core/master';
import { basketList, type BasketRow } from '../../core/sale-points';
import { clockSeconds } from '../../core/thai-date';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, BasketIcon, cardStyle, Check, Chip, ScaleIcon } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { Banner, IconLine, kgText, useSaleView } from './pieces';

const KINDS: readonly HistoryKind[] = ['all', 'full', 'short'];

export function HistoryScreen() {
  const t = useTheme();
  const msg = useT();
  const { point = '' } = useLocalSearchParams<{ point?: string }>();
  const view = useSaleView();
  const { saleId, events, master, day, mode, nameOf, saleTitle } = view;
  const [kind, setKind] = useState<HistoryKind>('all');
  // null = everyone.
  const [tapperId, setTapperId] = useState<string | null>(null);
  const fallback = `/v2/sale/${saleId}/counter?point=${point}` as Href;
  if (!view.ready || !master) return <FarmScreen title={msg('rec.list')} subtitle={saleTitle} fallback={fallback} />;

  const tapperOf = (pointId: string) => tapperOn(master, pointId, day);
  const rows = basketList(events, { withUndone: true });
  const tappers = [...new Set(rows.filter((r) => r.status === 'live').map((r) => tapperOf(r.pointId)).filter((id): id is string => !!id))];
  const shown = filterHistory(rows, { kind, tapperId }, tapperOf);
  // The summary follows the filter, so it always adds up to the rows below it.
  const summary = historySummary(shown);
  const equation = historyEquation(shown);
  const totals = runningTotals(shown);
  const newestLiveId = shown.find((r) => r.status === 'live')?.id;
  const terms = [...equation.full.map((g) => msg('hist.times', { n: g.count, kg: kgText(g.eachG) })), ...equation.shortsG.map(kgText)];
  // Numbers run on within the numbering scope: a tapper, or a point (D-46, D-79).
  const scopeOf = (pointId: string) => (mode === 'per-point' ? pointId : (tapperOf(pointId) ?? pointId));
  const numbers = checkNumbers(rows, scopeOf);
  const scopeName = (scope: string) => nameOf(scope) || master.points.find((p) => p.id === scope)?.name || scope;
  const numbersBad = numbers.problems
    .map((p) => msg('hist.numbersBadItem', { scope: scopeName(p.scope), detail: [p.gaps.length ? msg('hist.gap', { nos: p.gaps.join(', ') }) : '', p.dups.length ? msg('hist.dup', { nos: p.dups.join(', ') }) : ''].filter(Boolean).join(' · ') }))
    .join(' / ');
  const clear = () => {
    setKind('all');
    setTapperId(null);
  };
  const place = (r: BasketRow) => {
    const p = master.points.find((x) => x.id === r.pointId);
    const f = master.properties.find((x) => x.id === p?.propertyId);
    return p && f ? msg('v2s.place', { farm: f.name, point: p.name }) : (p?.name ?? '');
  };

  const chip = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ minHeight: t.target.min, paddingHorizontal: t.space.md, justifyContent: 'center', borderRadius: t.radius.pill, backgroundColor: on ? t.color.action : t.color.surfaceSunk }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: on ? t.color.inkInverse : t.color.inkSoft }}>{label}</Text>
    </Pressable>
  );

  return (
    <FarmScreen title={msg('rec.list')} subtitle={saleTitle} fallback={fallback} testID="history">
      <View testID="hist-summary" style={{ ...cardStyle(t), flexDirection: 'row', flexWrap: 'wrap', gap: t.space.md, paddingHorizontal: t.space.md, paddingVertical: t.space.sm }}>
        <AppText variant="bodySm">{msg('hist.summaryFull', { n: summary.full })}</AppText>
        <AppText variant="bodySm">{msg('hist.summaryShort', { n: summary.short })}</AppText>
        <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold }}>
          {msg('hist.summaryKg', { kg: kgText(summary.netG) })}
        </AppText>
      </View>
      {rows.length === 0 ? (
        <View testID="hist-empty" style={{ ...cardStyle(t), padding: t.space.lg, alignItems: 'center' }}>
          <AppText>{msg('rec.listEmpty')}</AppText>
        </View>
      ) : (
        <>
          {equation.totalG > 0 ? (
            <AppText testID="hist-equation" style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>
              {msg('hist.equation', { terms: terms.join(' + '), total: kgText(equation.totalG) })}
            </AppText>
          ) : null}
          {numbers.ok ? (
            <IconLine testID="hist-numbers-ok" icon={(c) => <Check color={c} size={13} />}>
              {msg('hist.numbersOk')}
            </IconLine>
          ) : (
            <Banner testID="hist-numbers-bad" tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} lines={[msg('hist.numbersBad', { detail: numbersBad })]} />
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
            {KINDS.map((k) => chip(msg(`hist.${k}`), kind === k, () => setKind(k), `hist-kind-${k}`))}
          </View>
          {tappers.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
              {tappers.map((id) => chip(nameOf(id), tapperId === id, () => setTapperId(id), `hist-tapper-${id}`))}
              {chip(msg('hist.everyone'), tapperId === null, () => setTapperId(null), 'hist-tapper-all')}
            </View>
          ) : null}
          {shown.length === 0 ? (
            <View testID="hist-filter-empty" style={{ ...cardStyle(t), padding: t.space.lg, alignItems: 'center', gap: t.space.sm }}>
              <AppText>{msg('hist.noMatch')}</AppText>
              {chip(msg('hist.clear'), false, clear, 'hist-filter-clear')}
            </View>
          ) : (
            <View style={{ ...cardStyle(t), paddingHorizontal: t.space.md }}>
              {shown.map((r, i) => (
                <HistoryRow key={r.id} row={r} top={i === 0} latest={r.id === newestLiveId} place={place(r)} tapper={nameOf(tapperOf(r.pointId))} cumG={totals.get(r.id) ?? null} />
              ))}
            </View>
          )}
        </>
      )}
    </FarmScreen>
  );
}

function HistoryRow({ row, top, latest, place, tapper, cumG }: { row: BasketRow; top: boolean; latest: boolean; place: string; tapper: string; cumG: number | null }) {
  const t = useTheme();
  const msg = useT();
  const voided = row.status === 'voided';
  const undone = row.status === 'undone';
  const dead = voided || undone;
  const bridged = !!row.partsG && row.partsG.length > 1;
  const kindLabel = row.part ? msg('hist.part') : row.short ? msg('hist.short') : msg('hist.full');
  const struck = dead ? ({ textDecorationLine: 'line-through', color: t.color.inkFaint } as const) : null;
  const detail = bridged
    ? msg('hist.parts', { parts: row.partsG!.map(kgText).join(' + ') })
    : row.short && row.reading
      ? msg('hist.reading', { reading: kgText(row.reading.readingG), tare: kgText(row.reading.tareG), net: kgText(row.netG) })
      : null;
  return (
    <View testID={`hist-row-${row.id}`} style={{ flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm, borderTopWidth: top ? 0 : t.border.hair, borderTopColor: t.color.ruleFaint }}>
      <View style={{ minWidth: 48, flexShrink: 0, alignItems: 'center' }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink, ...struck }}>{row.basketNo}</Text>
        {latest ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>{msg('hist.newest')}</Text> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          {row.short ? <ScaleIcon color={dead ? t.color.inkFaint : t.color.warn} size={16} /> : <BasketIcon color={dead ? t.color.inkFaint : t.color.accept} size={16} />}
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{kindLabel}</Text>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink, ...struck }}>{msg('v2f.kg', { n: kgText(row.netG) })}</Text>
        </View>
        <AppText variant="caption">{[place, tapper, clockSeconds(row.by.ts)].filter(Boolean).join(' · ')}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
        {cumG !== null ? (
          <AppText testID={`hist-cum-${row.id}`} variant="caption">
            {msg('hist.cum', { kg: kgText(cumG) })}
          </AppText>
        ) : null}
        {row.backfill || dead || bridged ? (
          <View style={{ flexDirection: 'row', gap: t.space.xs, flexWrap: 'wrap' }}>
            {bridged ? <Chip label={msg('hist.bridged')} /> : null}
            {row.backfill ? <Chip label={msg('rec.backfillTag')} /> : null}
            {voided ? <Chip tone="reject" label={msg('rec.voided')} /> : null}
            {undone ? <Chip tone="reject" label={msg('hist.undone', { time: clockSeconds(row.undoneTs ?? row.by.ts) })} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
