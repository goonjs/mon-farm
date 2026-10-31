/**
 * E05-S11 · small shared pieces of the "สรุปจ่ายเงิน" page and its sheets:
 * the round icon button (34 in 48, CO-17), the card icon with its red count
 * or blue ✓, plain label/amount rows, and the netting moves every sheet
 * uses. Display only — every figure comes from `useCloseout()`.
 */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CloseoutWorker } from '../../../core/finance/closeout';
import { formatSatang } from '../../../core/finance/money';
import { useTheme } from '../../../theme';
import { AppText, Check, ChevronRight, FarmMateIcon, toneColours, type TileTone } from '../../../ui';
import type { CloseoutDraft } from './use-closeout';

export const baht = formatSatang;

/**
 * Direction marks, added in code beside the words (as `WayLabel` does): the
 * message catalogue keeps to its tested glyph set (i18n/resolve.test.ts).
 * ↘ tapper → farm (debt), ↗ farm → tapper, ↑ "the card above", ⇄ transfer, Σ total.
 */
export const MARK = { in: '↘', out: '↗', up: '↑', swap: '⇄', sum: 'Σ' } as const;

const ROUND = 34;

/** A small round icon button: a 34 circle inside a 48 target, with a spoken label (summary-lines §4). */
export function RoundButton({
  label,
  onPress,
  testID,
  strong,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  /** Filled navy: the card still needs the owner. */
  strong?: boolean;
  disabled?: boolean;
  icon?: (colour: string) => ReactNode;
}) {
  const t = useTheme();
  const fg = strong ? t.color.inkInverse : t.color.action;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={0}
      style={{ width: t.target.min, height: t.target.min, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: ROUND, height: ROUND, borderRadius: t.radius.pill, backgroundColor: strong ? t.color.action : t.color.actionSunk, alignItems: 'center', justifyContent: 'center' }}>
        {icon ? icon(fg) : <ChevronRight color={fg} size={9} />}
      </View>
    </Pressable>
  );
}

/** One FarmMate icon on a tile; a red count (no blinking) until checked, then a blue ✓ (CO-17). */
export function CardIcon({ id, tone = 'cream', badge, checked, testID, small }: { id: string; tone?: TileTone; badge?: number; checked?: boolean; testID?: string; small?: boolean }) {
  const t = useTheme();
  const { bg } = toneColours(t, tone);
  const side = small ? 40 : t.target.min;
  const dot = 20;
  return (
    <View style={{ width: side, height: side }}>
      <View aria-hidden style={{ width: side, height: side, borderRadius: t.radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <FarmMateIcon id={id} size={small ? 28 : 32} />
      </View>
      {badge ? (
        <View testID={testID} accessibilityLabel={String(badge)} style={{ position: 'absolute', top: -t.space.xs, right: -t.space.xs, minWidth: dot, height: dot, paddingHorizontal: t.space.xxs, borderRadius: t.radius.pill, backgroundColor: t.color.reject, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>{badge}</Text>
        </View>
      ) : null}
      {checked ? (
        <View aria-hidden style={{ position: 'absolute', top: -t.space.xs, right: -t.space.xs, width: dot, height: dot, borderRadius: t.radius.pill, backgroundColor: t.color.action, alignItems: 'center', justifyContent: 'center' }}>
          <Check color={t.color.inkInverse} size={9} />
        </View>
      ) : null}
    </View>
  );
}

/** Label left, figure right, wrapping instead of clipping. */
export function Line({ label, value, testID, strong, tone, valueTone }: { label: ReactNode; value: ReactNode; testID?: string; strong?: boolean; tone?: string; valueTone?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm, flexWrap: 'wrap' }}>
      <AppText style={{ flexShrink: 1, color: tone ?? t.color.inkSoft, fontWeight: strong ? t.font.weight.bold : t.font.weight.regular }}>{label}</AppText>
      <AppText style={{ marginLeft: 'auto', fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: valueTone ?? t.color.ink }}>{value}</AppText>
    </View>
  );
}

/** "−3,250.00" with a real minus. */
export const minus = (satang: number) => (satang > 0 ? `−${baht(satang)}` : baht(0));

/** Set one worker's draft, leaving the rest. */
export function withWorker(d: CloseoutDraft, id: string, patch: { totalSatang?: number | null; nettingSatang?: number }): CloseoutDraft {
  return { ...d, workers: { ...d.workers, [id]: { ...(d.workers[id] ?? {}), ...patch } } };
}

const add = (list: readonly string[], id: string) => (list.includes(id) ? list : [...list, id]);
export const addId = add;

/**
 * Netting pressed by the owner (CO-7, CO-26): use what the farm may net and
 * raise this sale's deduction by it, never past the worker's whole debt.
 */
export function netOn(d: CloseoutDraft, w: CloseoutWorker): CloseoutDraft {
  const net = w.netCapSatang;
  const balance = w.totalSatang + w.debtLeftSatang;
  const base = w.totalSatang - w.nettingSatang;
  const next = withWorker(d, w.id, { nettingSatang: net, totalSatang: Math.min(base + net, balance) });
  return { ...next, owedChoice: { ...next.owedChoice, [w.id]: 'net' } };
}

/** Netting taken back ("เอาออก" / "ไว้ก่อน"): the deduction drops by what was netted. */
export function netOff(d: CloseoutDraft, w: CloseoutWorker): CloseoutDraft {
  const next = w.nettingSatang > 0 ? withWorker(d, w.id, { nettingSatang: 0, totalSatang: Math.max(0, w.totalSatang - w.nettingSatang) }) : d;
  return { ...next, owedChoice: { ...next.owedChoice, [w.id]: 'hold' } };
}
