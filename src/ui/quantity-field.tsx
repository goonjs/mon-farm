/**
 * QuantityField (E11-S11 UI-2): a whole-number field edited on the on-screen
 * NumberPad in a bottom sheet — no OS keyboard, no +/- steppers. Closed it is
 * a small label over a slim (≈56–72) tappable card: number, unit and caption on one
 * line (wrapping, never clipped). In the sheet the first key
 * replaces the old value; ✓ commits, closing the sheet cancels.
 *
 * E01-S20: `decimals` (ไร่ / กก.) switches to the decimal pad with a ตกลง button;
 * the value is then in the smallest stored unit (0.01 ไร่, กรัม). `clear` adds a
 * "เว้นว่าง (…)" link for optional fields, `validate` carries a screen's own
 * parser rule, and `open` / `onOpenChange` let a screen open it (NP-15).
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { CTA } from './button';
import { cardStyle } from './card';
import { FieldHead } from './form';
import { NumberPad } from './number-pad';
import { entryToInt, entryToScaled, pressKey, scaledToEntry, startEntry, viewEntry, type EntryConfig, type EntryKey, type EntryState } from '../core/number-entry';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The stored value as shown: 1250 with 2 decimals → "12.5"; 1000 → "1,000". */
const shownValue = (n: number, decimals: number, grouping = true): string => {
  const raw = scaledToEntry(n, decimals);
  if (!grouping) return raw;
  const [whole, fraction] = raw.split('.');
  return fraction === undefined ? groupDigits(whole) : `${groupDigits(whole)}.${fraction}`;
};

export function QuantityField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  maxDigits = 4,
  caption,
  decimals = 0,
  emptyText,
  clear,
  validate,
  open: openProp,
  onOpenChange,
  grouping = true,
  required,
  hint,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  unit: string;
  min?: number;
  max?: number;
  /** Whole digits allowed. */
  maxDigits?: number;
  /** A line under the number, e.g. "รวม 1,000 กก."; gets the live value. */
  caption?: (value: number | null) => string | undefined;
  /** Digits after the dot (0 = whole numbers). The value is then scaled: 12.5 ไร่ with 2 → 1250. */
  decimals?: number;
  /** Closed card text while the value is null, e.g. "ไม่ทราบ" (default "–"). */
  emptyText?: string;
  /** Optional field: a "เว้นว่าง (…)" link in the sheet that commits "no value". */
  clear?: { label: string; onClear: () => void };
  /** A screen's own rule from its parser: a short reason closes ✓, undefined passes. */
  validate?: (value: number) => string | undefined;
  /** Controlled sheet (NP-15); leave out to let the card open it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** false for a year: 2554, not 2,554. */
  grouping?: boolean;
  /** Red * after the label, like TextField. */
  required?: boolean;
  /** A soft note beside the label, e.g. "ไม่บังคับ". */
  hint?: string;
  testID: string;
}) {
  const t = useTheme();
  const msg = useT();
  const cfg: EntryConfig = decimals > 0 ? { kind: 'decimal', maxDigits, decimals } : { kind: 'int', maxDigits };
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setOpenSelf(o);
    onOpenChange?.(o);
  };
  const initialRaw = () => (value == null ? '' : decimals > 0 ? scaledToEntry(value, decimals) : String(value));
  const [state, setState] = useState<EntryState>(() => startEntry(initialRaw()));
  // A parent-opened sheet starts from the current value too.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setState(startEntry(initialRaw()));
  }

  const live = decimals > 0 ? entryToScaled(state.raw, decimals) : entryToInt(state.raw);
  const view = viewEntry(state, cfg);
  const problem = state.rejected
    ? msg('numpad.tooBig')
    : live != null && min != null && live < min
      ? msg('numpad.minMsg', { min: shownValue(min, decimals, grouping) })
      : live != null && max != null && live > max
        ? msg('numpad.maxMsg', { max: shownValue(max, decimals, grouping) })
        : live != null
          ? validate?.(live)
          : undefined;
  const valid = live != null && problem === undefined;

  const openSheet = () => {
    setState(startEntry(initialRaw()));
    setOpen(true);
  };
  const commit = () => {
    if (!valid || live == null) return;
    onChange(live);
    setOpen(false);
  };
  const clearIt = () => {
    clear?.onClear();
    setOpen(false);
  };
  const whole = grouping ? view.whole : view.whole.replace(/,/g, '');
  const liveText = view.empty ? '–' : view.fractionTyped ? `${whole}.${view.fraction}` : whole;
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
        <FieldHead label={label} required={required} hint={hint} />
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={[label, required ? msg('form.required') : null, hint ?? null, value == null ? (emptyText ?? null) : `${shownValue(value, decimals, grouping)} ${unit}`].filter(Boolean).join(', ')}
          onPress={openSheet}
          style={[cardStyle(t), { minHeight: t.target.comfortable, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, justifyContent: 'center' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', columnGap: t.space.sm, flexWrap: 'wrap' }}>
            {figure(value == null ? (emptyText ?? '–') : shownValue(value, decimals, grouping), value == null ? 'inkFaint' : 'ink', undefined, 'displayXl')}
            {value == null && emptyText ? null : unitText}
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
            accessibilityLabel={view.empty ? msg('numpad.empty') : `${liveText} ${unit}`}
            style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.sm, flexWrap: 'wrap' }}
          >
            {figure(liveText, view.empty ? 'inkFaint' : 'ink', `${testID}-display`)}
            {unitText}
          </View>
          {captionText(live)}
          {problem ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.reject, textAlign: 'right' }}>
              {problem}
            </Text>
          ) : null}
        </View>
        {decimals > 0 ? (
          <>
            <NumberPad variant="decimal" onKey={press} onDone={commit} testID={`${testID}-pad`} />
            <CTA testID={`${testID}-done`} disabled={!valid} onPress={commit}>
              {msg('numpad.done')}
            </CTA>
          </>
        ) : (
          <NumberPad variant="int" onKey={press} onDone={commit} doneDisabled={!valid} testID={`${testID}-pad`} />
        )}
        {clear ? <ClearLink label={clear.label} onPress={clearIt} testID={`${testID}-clear`} /> : null}
      </BottomSheet>
    </>
  );
}

/** The quiet "เว้นว่าง (…)" link under a pad (E01-S20 D2): underlined, ≥ 48 tall, away from ✓. */
export function ClearLink({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={{ minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.inkSoft, textDecorationLine: 'underline', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
