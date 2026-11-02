/**
 * The two ways to enter a short basket's weight (E04-S16, mockup 2026-10-13).
 *
 * `BasisToggle` — on the dial, whether the number follows what the scale
 * reads (scale icon) or the net rubber (leaf icon). `TypedReading` — typing
 * mode: two clearly marked fields, either one can be typed and the other is
 * worked out at once. Both only choose how a number is entered; the screen
 * still records one `short` event with the scale reading.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fieldKg, netFromReading, parseKg, readingFromNet } from '../../core/short-reading';
import { useT } from '../../i18n';
import type { WeighBasis } from '../../store/weigh-mode-preference';
import { useTheme } from '../../theme';
import { pressKey, startEntry, type EntryConfig, type EntryKey, type EntryState } from '../../core/number-entry';
import { AppText, LeafIcon, NumberPad, ScaleIcon } from '../../ui';

export function BasisToggle({ value, onChange }: { value: WeighBasis; onChange: (b: WeighBasis) => void }) {
  const t = useTheme();
  const msg = useT();
  const opts: readonly { v: WeighBasis; label: string; icon: (c: string) => React.ReactNode }[] = [
    { v: 'scale', label: msg('v2s.scaleReads'), icon: (c) => <ScaleIcon color={c} size={18} /> },
    { v: 'net', label: msg('v2s.net'), icon: (c) => <LeafIcon color={c} size={18} /> },
  ];
  return (
    <View style={{ alignSelf: 'center', gap: t.space.xxs, alignItems: 'center' }}>
      <View accessibilityRole="radiogroup" testID="basis" style={{ flexDirection: 'row', backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, padding: t.space.xs, gap: t.space.xs }}>
        {opts.map((o) => {
          const on = o.v === value;
          const fg = on ? t.color.inkInverse : t.color.inkSoft;
          return (
            <Pressable
              key={o.v}
              testID={`basis-${o.v}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => onChange(o.v)}
              style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs, paddingHorizontal: t.space.md, borderRadius: t.radius.pill, backgroundColor: on ? t.color.action : 'transparent' }}
            >
              {o.icon(fg)}
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: fg }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption">{msg(value === 'scale' ? 'v2s.basisHintScale' : 'v2s.basisHintNet')}</AppText>
    </View>
  );
}

type Side = 'scale' | 'net';

/** The old box's limits (E04-S16): three whole digits, one decimal — 999.9 at most. */
const CFG: EntryConfig = { kind: 'decimal', maxDigits: 3, decimals: 1 };

/**
 * Typing mode on the app pad (E01-S20 row 21, mockup D6): two cards — what
 * the scale reads and the net rubber — and the decimal NumberPad right in
 * the sheet, no OS keyboard and no second sheet. Tap a card to type that
 * side; the other is worked out at once. The opening value is the app's
 * guess: shown faint and tagged "ค่าเดา · พิมพ์ทับ" until the first key; a
 * first digit replaces it, a first "." starts at "0.", a first ⌫ removes
 * its last digit (NP-8). Hold ⌫ to clear.
 *
 * Starts from `startKg` (the scale reading). `onChange` gets the scale reading
 * the typed weight means, or `null` while nothing usable is typed.
 */
export function TypedReading({ startKg, offsetKg, onChange }: { startKg: number; offsetKg: number; onChange: (readingKg: number | null) => void }) {
  const t = useTheme();
  const msg = useT();
  const [src, setSrc] = useState<Side>('scale');
  const [entry, setEntry] = useState<EntryState>(() => startEntry(fieldKg(startKg)));
  const [guess, setGuess] = useState(true);
  const typed = parseKg(entry.raw);
  const other = typed === null ? '' : fieldKg(src === 'scale' ? netFromReading(typed, offsetKg) : readingFromNet(typed, offsetKg));
  const shown = (side: Side) => (side === src ? entry.raw : other);

  const report = (side: Side, raw: string) => {
    const v = parseKg(raw);
    onChange(v === null ? null : side === 'scale' ? v : readingFromNet(v, offsetKg));
  };
  const press = (k: EntryKey) => {
    // NP-8: a first ⌫ edits the guess from its end instead of wiping it.
    const next = k === 'back' && entry.fresh ? { raw: entry.raw.slice(0, -1), fresh: false, rejected: false } : pressKey(entry, k, CFG);
    setEntry(next);
    setGuess(false);
    if (next.raw !== entry.raw) report(src, next.raw);
  };
  const pick = (side: Side) => {
    if (side === src) return;
    setSrc(side);
    // A worked-out weight of 0 or less (a too-low reading) is not something to edit: start that side empty.
    const v = shown(side);
    setEntry(startEntry(Number(v) > 0 ? v : ''));
    setGuess(false);
  };

  const field = (side: Side) => {
    const typing = side === src;
    const leaf = side === 'net';
    const ink = leaf ? t.color.accept : t.color.ink;
    const value = shown(side);
    const faint = !typing || (guess && typing);
    const tag = msg(typing ? (guess ? 'numpad.guess' : 'v2s.typing') : 'v2s.calcForYou');
    return (
      <Pressable
        testID={`reading-${side}`}
        accessibilityRole="button"
        accessibilityState={{ selected: typing }}
        accessibilityLabel={`${msg(leaf ? 'v2s.fieldNet' : 'v2s.fieldScale')} ${value || '–'} ${msg('common.kg')}, ${tag}`}
        onPress={() => pick(side)}
        style={{
          gap: t.space.xxs,
          paddingHorizontal: t.space.md,
          paddingVertical: t.space.sm,
          borderRadius: t.radius.lg,
          borderWidth: t.border.thick,
          borderStyle: typing ? 'solid' : 'dashed',
          borderColor: typing ? ink : t.color.ruleStrong,
          backgroundColor: typing ? t.color.surfaceRaised : t.color.surfaceSunk,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, flexWrap: 'wrap' }}>
          {leaf ? <LeafIcon color={t.color.accept} size={18} /> : <ScaleIcon color={t.color.action} size={18} />}
          <AppText style={{ flex: 1, minWidth: 120, fontWeight: t.font.weight.bold }}>{msg(leaf ? 'v2s.fieldNet' : 'v2s.fieldScale')}</AppText>
          <Text
            testID={`reading-${side}-tag`}
            style={{
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.caption,
              fontWeight: t.font.weight.bold,
              color: typing ? t.color.inkInverse : t.color.inkSoft,
              backgroundColor: typing ? t.color.action : 'transparent',
              borderWidth: typing ? 0 : t.border.hair,
              borderColor: t.color.inkSoft,
              borderRadius: t.radius.pill,
              paddingHorizontal: t.space.sm,
              paddingVertical: t.space.xxs,
              overflow: 'hidden',
            }}
          >
            {tag}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: t.space.xs }}>
          <Text
            testID={`reading-${side}-value`}
            accessibilityLiveRegion="polite"
            style={{ fontFamily: t.font.family.sans, fontSize: typing ? 40 : 28, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: faint ? t.color.inkSoft : ink }}
          >
            {value === '' ? '–' : value}
          </Text>
          <AppText>{msg('common.kg')}</AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: t.space.xs }}>
      {field('scale')}
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {msg(offsetKg === 0 ? 'v2s.eqZero' : 'v2s.eqOffset', { n: fieldKg(offsetKg) })}
      </AppText>
      {field('net')}
      <NumberPad variant="decimal" onKey={press} onDone={() => {}} testID="reading-pad" />
    </View>
  );
}
