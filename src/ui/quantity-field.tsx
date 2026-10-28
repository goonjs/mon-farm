/**
 * QuantityField (E11-S11 UI-2): a whole-number field edited on the on-screen
 * NumberPad in a bottom sheet — no OS keyboard, no +/- steppers. Closed it is
 * a small label over a slim (≈56–72) tappable card: number, unit and caption on one
 * line (wrapping, never clipped). In the sheet the first key
 * replaces the old value; ✓ commits, closing the sheet cancels.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { cardStyle } from './card';
import { NumberPad } from './number-pad';
import { entryToInt, pressKey, startEntry, viewEntry, type EntryConfig, type EntryKey, type EntryState } from '../core/number-entry';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function QuantityField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  maxDigits = 4,
  caption,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  unit: string;
  min?: number;
  max?: number;
  maxDigits?: number;
  /** A line under the number, e.g. "รวม 1,000 กก."; gets the live value. */
  caption?: (value: number | null) => string | undefined;
  testID: string;
}) {
  const t = useTheme();
  const msg = useT();
  const cfg: EntryConfig = { kind: 'int', maxDigits };
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EntryState>(() => startEntry(value == null ? '' : String(value)));

  const live = entryToInt(state.raw);
  const view = viewEntry(state, cfg);
  const problem =
    state.rejected
      ? msg('numpad.tooBig')
      : live != null && min != null && live < min
        ? msg('numpad.minMsg', { min: group(min) })
        : live != null && max != null && live > max
          ? msg('numpad.maxMsg', { max: group(max) })
          : undefined;
  const valid = live != null && problem === undefined;

  const openSheet = () => {
    setState(startEntry(value == null ? '' : String(value)));
    setOpen(true);
  };
  const commit = () => {
    if (!valid || live == null) return;
    onChange(live);
    setOpen(false);
  };
  const press = (k: EntryKey) => setState((s) => pressKey(s, k, cfg));

  const figure = (text: string, tone: 'ink' | 'inkFaint', testId?: string, step: 'figure' | 'displayXl' = 'figure') => (
    <Text
      testID={testId}
      style={{
        fontFamily: t.font.family.sans,
        fontSize: t.font.size[step],
        fontWeight: t.font.weight.bold,
        fontVariant: ['tabular-nums'],
        color: t.color[tone],
        letterSpacing: t.font.size[step] * t.font.tracking.tight,
      }}
    >
      {text}
    </Text>
  );
  const unitText = (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, color: t.color.inkSoft }}>{unit}</Text>
  );
  const captionText = (v: number | null, inline = false) => {
    const c = caption?.(v);
    return c ? (
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft, textAlign: inline ? 'left' : 'right' }}>{c}</Text>
    ) : null;
  };

  return (
    <>
      <View style={{ gap: t.space.xs }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: t.color.inkSoft }}>
          {label}
        </Text>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={[label, value == null ? null : `${group(value)} ${unit}`].filter(Boolean).join(', ')}
          onPress={openSheet}
          style={[cardStyle(t), { minHeight: t.target.comfortable, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, justifyContent: 'center' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', columnGap: t.space.sm, flexWrap: 'wrap' }}>
            {figure(value == null ? '–' : group(value), value == null ? 'inkFaint' : 'ink', undefined, 'displayXl')}
            {unitText}
            {captionText(value, true)}
          </View>
        </Pressable>
      </View>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} testID={`${testID}-sheet`}>
        <View
          style={[
            cardStyle(t),
            { padding: t.space.lg, gap: t.space.xs, borderWidth: t.border.thick, borderColor: t.color.action },
          ]}
        >
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
          <View
            accessibilityLabel={view.empty ? msg('numpad.empty') : `${view.whole} ${unit}`}
            style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.sm, flexWrap: 'wrap' }}
          >
            {figure(view.empty ? '–' : view.whole, view.empty ? 'inkFaint' : 'ink', `${testID}-display`)}
            {unitText}
          </View>
          {captionText(live)}
          {problem ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.reject, textAlign: 'right' }}>
              {problem}
            </Text>
          ) : null}
        </View>
        <NumberPad variant="int" onKey={press} onDone={commit} doneDisabled={!valid} testID={`${testID}-pad`} />
      </BottomSheet>
    </>
  );
}
