/**
 * MoneyField (E11-S11 UI-2): an amount in baht edited on the on-screen
 * NumberPad (money layout) in a bottom sheet — no OS keyboard. Closed it is a
 * tappable card: grouped whole part big, a small faint ".00" until typed, the
 * unit small. In the sheet the first key replaces the old value; the amount
 * is repeated in Thai words (a long figure is checked by eye); "ตกลง"
 * commits, closing the sheet cancels.
 *
 * Nothing is cut off (AGENTS.md): the numeral size comes from the engine's
 * `moneyTextStep` table (figure → displayXl → displayLg), never from
 * shrink-to-fit, and the unit wraps to its own line instead of overflowing.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { CTA } from './button';
import { cardStyle } from './card';
import { NumberPad } from './number-pad';
import { bahtWords } from '../core/baht-words';
import { formatSatang } from '../core/finance/money';
import {
  entryToSatang,
  moneyTextStep,
  pressKey,
  startEntry,
  viewEntry,
  type EntryConfig,
  type EntryKey,
  type EntryState,
  type EntryView,
} from '../core/number-entry';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const CFG: EntryConfig = { kind: 'money', maxDigits: 8 };
const MAX_SATANG = 9_999_999_999;

const rawOf = (satang: number | null) =>
  satang == null ? '' : satang % 100 === 0 ? String(satang / 100) : `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0').replace(/0$/, '')}`;

export function MoneyField({
  label,
  satang,
  onChange,
  unit,
  minSatang,
  maxSatang = MAX_SATANG,
  words = true,
  below,
  testID,
}: {
  label: string;
  satang: number | null;
  onChange: (satang: number) => void;
  /** e.g. "บาท / กระสอบ". */
  unit: string;
  minSatang?: number;
  maxSatang?: number;
  /** The amount in Thai words under the number (default on). */
  words?: boolean;
  /** A line under the card with the live amount, e.g. "20 × 1,150.00 = 23,000.00". */
  below?: (satang: number | null) => string | undefined;
  testID: string;
}) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EntryState>(() => startEntry(rawOf(satang)));

  const live = entryToSatang(state.raw);
  const view = viewEntry(state, CFG);
  const problem = state.rejected
    ? msg('numpad.tooBig')
    : live != null && minSatang != null && live < minSatang
      ? msg('numpad.minMsg', { min: formatSatang(minSatang) })
      : live != null && live > maxSatang
        ? msg('numpad.maxMsg', { max: formatSatang(maxSatang) })
        : undefined;
  const valid = live != null && problem === undefined;

  const openSheet = () => {
    setState(startEntry(rawOf(satang)));
    setOpen(true);
  };
  const commit = () => {
    if (!valid || live == null) return;
    onChange(live);
    setOpen(false);
  };
  const press = (k: EntryKey) => setState((s) => pressKey(s, k, CFG));

  /** Whole part big, fraction at ~55% (faint until typed). One nowrap run. */
  const amount = (v: EntryView, testId?: string, slim = false) => {
    const step = moneyTextStep(v);
    const size = t.font.size[slim && step === 'figure' ? 'displayXl' : slim && step === 'displayXl' ? 'displayLg' : step];
    const placeholder = v.empty;
    return (
      <Text
        testID={testId}
        numberOfLines={1}
        style={{
          fontFamily: t.font.family.sans,
          fontSize: size,
          fontWeight: t.font.weight.bold,
          fontVariant: ['tabular-nums'],
          color: placeholder ? t.color.inkFaint : t.color.ink,
          letterSpacing: size * t.font.tracking.tight,
        }}
      >
        {placeholder ? '0' : v.whole}
        <Text style={{ fontSize: Math.round(size * 0.55), color: v.fractionTyped ? t.color.ink : t.color.inkFaint }}>
          {`.${v.fraction}`}
        </Text>
      </Text>
    );
  };
  const unitText = (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft }}>{unit}</Text>
  );
  const amountRow = (node: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.sm, flexWrap: 'wrap' }}>
      {node}
      {unitText}
    </View>
  );

  const closedView: EntryView =
    satang == null
      ? { whole: '', fraction: '00', fractionTyped: false, empty: true }
      : {
          whole: formatSatang(satang).split('.')[0],
          fraction: String(satang % 100).padStart(2, '0'),
          fractionTyped: satang % 100 !== 0,
          empty: false,
        };
  const belowText = below?.(live);

  return (
    <>
      <View style={{ gap: t.space.xs }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: t.color.inkSoft }}>
          {label}
        </Text>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={[label, satang == null ? null : `${formatSatang(satang)} ${unit}`].filter(Boolean).join(', ')}
          onPress={openSheet}
          style={[cardStyle(t), { minHeight: t.target.comfortable, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, justifyContent: 'center' }]}
        >
          {amountRow(amount(closedView, undefined, true))}
        </Pressable>
      </View>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} testID={`${testID}-sheet`}>
        <View style={[cardStyle(t), { padding: t.space.lg, gap: t.space.xs, borderWidth: t.border.thick, borderColor: t.color.action }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
            <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.inkSoft }}>
              {label}
            </Text>
            <View style={{ backgroundColor: t.color.action, borderRadius: t.radius.pill, paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>
                {msg('numpad.typing')}
              </Text>
            </View>
          </View>
          {amountRow(amount(view, `${testID}-display`))}
          {words && live != null ? (
            <Text testID={`${testID}-words`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft, textAlign: 'right' }}>
              {bahtWords(live)}
            </Text>
          ) : null}
          {problem ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.reject, textAlign: 'right' }}>
              {problem}
            </Text>
          ) : null}
        </View>
        {belowText ? (
          <Text testID={`${testID}-below`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
            {belowText}
          </Text>
        ) : null}
        <NumberPad variant="money" onKey={press} onDone={commit} testID={`${testID}-pad`} />
        <CTA testID={`${testID}-done`} disabled={!valid} onPress={commit}>
          {msg('numpad.done')}
        </CTA>
      </BottomSheet>
    </>
  );
}
