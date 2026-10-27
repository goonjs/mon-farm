/** Small pieces of the order-detail screen: a sheet's sub-title, a tappable row, a summary bar. */

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../../../theme';
import { AppText } from '../../../ui';

export function SheetTitle({ children }: { children: string }) {
  return <AppText variant="bodySm">{children}</AppText>;
}

/** A full-width tappable row (≥ 56): dashed for "+ add". */
export function ItemRow({ testID, title, onPress, icon, dashed }: { testID: string; title: string; onPress: () => void; icon?: ReactNode; dashed?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space.sm,
        minHeight: t.target.comfortable,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: t.border.hair,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: t.color.ruleStrong,
        backgroundColor: dashed ? t.color.surface : t.color.surfaceRaised,
      }}
    >
      {icon ?? null}
      <AppText style={{ fontWeight: t.font.weight.bold, flexShrink: 1, textAlign: 'center' }}>{title}</AppText>
    </Pressable>
  );
}

/** "ใส่แล้ว x / n" bar: tone = ok (full), warn (less), bad (over), calm (nothing yet). */
export function SummaryBar({ testID, tone, left, right }: { testID: string; tone: 'ok' | 'warn' | 'bad' | 'calm'; left: string; right?: string }) {
  const t = useTheme();
  const bg = { ok: t.color.acceptSunk, warn: t.color.warnSunk, bad: t.color.rejectSunk, calm: t.color.surfaceSunk }[tone];
  const fg = { ok: t.color.accept, warn: t.color.warn, bad: t.color.reject, calm: t.color.ink }[tone];
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm, backgroundColor: bg, borderRadius: t.radius.lg, padding: t.space.md }}>
      <AppText style={{ fontWeight: t.font.weight.bold, color: fg }}>{left}</AppText>
      {right ? <AppText variant="bodySm">{right}</AppText> : null}
    </View>
  );
}
