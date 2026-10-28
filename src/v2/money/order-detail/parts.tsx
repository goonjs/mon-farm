/** Small pieces of the order-detail screen: a sheet's sub-title, a tappable row, a summary bar. */

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Button, Check } from '../../../ui';

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

/** "จำไว้" tick with a one-line hint (copied from the old fertilizer flow so that flow can be deleted). */
export function RememberTick({ on, onPress, testID, hint }: { on: boolean; onPress: () => void; testID: string; hint: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: on ? t.color.accept : t.color.ruleStrong, backgroundColor: on ? t.color.acceptSunk : t.color.surfaceRaised }}
    >
      <View aria-hidden style={{ width: 26, height: 26, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: on ? t.color.accept : t.color.ruleStrong, backgroundColor: on ? t.color.accept : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Check color={t.color.inkInverse} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.rememberAll')}</AppText>
        <AppText variant="caption">{hint}</AppText>
      </View>
    </Pressable>
  );
}

/** A confirm step before a delete: what will happen, a destructive button and "ไม่ลบ". */
export function ConfirmSheet({ testID, title, body, confirmLabel, cancelLabel, failed, onConfirm, onClose }: { testID: string; title: string; body: string; confirmLabel: string; cancelLabel: string; failed?: string; onConfirm: () => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <BottomSheet open onClose={onClose} testID={testID} title={title}>
      <View style={{ gap: t.space.md }}>
        <AppText>{body}</AppText>
        {failed ? <AppText testID={`${testID}-failed`} style={{ color: t.color.reject }}>{failed}</AppText> : null}
        <Button testID={`${testID}-yes`} variant="destructive" size="large" onPress={onConfirm}>{confirmLabel}</Button>
        <Button testID={`${testID}-no`} onPress={onClose}>{cancelLabel}</Button>
      </View>
    </BottomSheet>
  );
}
