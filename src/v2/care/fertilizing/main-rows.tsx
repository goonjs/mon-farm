/**
 * The main page's three rows (FZ-1, FZ-6, mockup v3 screens 1 and 6): each row is the tap target
 * with › (no word buttons, phone-form-ux rule 11). The fertilizer row lists one short line per card,
 * its price per sack in full (D-95 (3), D-96 (2)).
 */

import { Platform, Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import type { Fertilizing } from '../../../core/finance/fertilizing';
import { cardStatus, fullPrice, type EditorCard } from '../../../core/finance/fertilizing-editor';
import { formatDate } from '../../../core/finance/money';
import type { FertilizingZone } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, ChevronRight, FarmMateArt } from '../../../ui';
import type { FarmMateArtId } from '../../../ui/farmmate-icons';

export function MainRows({
  date,
  today,
  used,
  where,
  record,
  onDate,
  onFerts,
  onWhere,
  reasonName,
  readOnly,
}: {
  date: string;
  today: string;
  used: readonly EditorCard[];
  where: { readonly zones: readonly FertilizingZone[]; readonly reasons: readonly string[] };
  record: Fertilizing | null;
  onDate: () => void;
  onFerts: () => void;
  onWhere: () => void;
  reasonName: (id: string) => string;
  /** A deleted fertilizing: shown, not editable (review of PR 188 S1). */
  readOnly?: boolean;
}) {
  const msg = useT();
  const t = useTheme();
  const shortDate = formatDate(date).split(' ').slice(0, 2).join(' ');
  const whereLines = [
    where.zones.length ? msg('fz.whereLine', { zones: where.zones.map((z) => z.zoneName).join(' · ') }) : null,
    where.reasons.length ? msg('fz.reasonLine', { reasons: where.reasons.map(reasonName).join(' · ') }) : null,
  ].filter((x): x is string => !!x);
  return (
    <>
      <RowCard testID="fz-date" art="farmwork.calendar" disabled={readOnly} onPress={onDate} label={msg('fz.date')} title={date === today ? msg('fz.dateToday', { date: shortDate }) : formatDate(date)} />
      <RowCard
        testID="fz-ferts"
        art="materials.chemFert"
        disabled={readOnly}
        onPress={onFerts}
        title={used.length ? msg('fz.fertsChosen') : msg('fz.ferts')}
        lines={
          used.length
            ? used.map((c) => (
                <>
                  {msg('fz.line', { name: c.card.formula, price: fullPrice(c.card.perSackSatang), sacks: c.sacks, status: '' })}
                  {/* The split word is one run: it never breaks inside at a large text size (review of PR 188 N3). */}
                  <Text style={NO_WRAP}>{msg(`fz.status.${statusKey(c)}`)}</Text>
                </>
              ))
            : [msg('fz.notChosen')]
        }
      />
      {record && record.over > 0 ? (
        <AppText testID="fz-over" style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('fz.over', { n: record.over })}</AppText>
      ) : null}
      <RowCard testID="fz-where" art="farm.plotZone" disabled={readOnly} onPress={onWhere} title={msg('fz.where')} lines={whereLines.length ? whereLines : [msg('fz.whereHint')]} />
    </>
  );
}

/** A used card's split word on the summary line: unused cards are not listed. */
export function statusKey(c: EditorCard): 'none' | 'partial' | 'full' | 'over' {
  const s = cardStatus(c);
  return s === 'unused' ? 'none' : s;
}

/** Web keeps the run on one line; native Text has no such style and wraps at word ends anyway. */
const NO_WRAP = (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as object;

function RowCard({ testID, art, label, title, lines, onPress, disabled }: { testID: string; art: FarmMateArtId; label?: string; title: string; lines?: readonly ReactNode[]; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.rule }}
    >
      <View style={{ width: 52, height: 52, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, alignItems: 'center', justifyContent: 'center' }}>
        <FarmMateArt id={art} size={40} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {label ? <AppText variant="bodySm">{label}</AppText> : null}
        <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
        {(lines ?? []).map((l, i) => (
          <AppText key={i} variant="bodySm">{l}</AppText>
        ))}
      </View>
      {disabled ? null : <ChevronRight color={t.color.ink} />}
    </Pressable>
  );
}
