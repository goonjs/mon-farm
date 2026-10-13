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
import { Pressable, Text, TextInput, View } from 'react-native';

import { fieldKg, netFromReading, parseKg, readingFromNet } from '../../core/short-reading';
import { useT } from '../../i18n';
import type { WeighBasis } from '../../store/weigh-mode-preference';
import { useTheme } from '../../theme';
import { AppText, IconTile, LeafIcon, ScaleIcon } from '../../ui';

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

/** Digits and at most one point, one decimal, three whole digits. */
const clean = (text: string): string => {
  const k = text.replace(/[^0-9.]/g, '');
  const i = k.indexOf('.');
  if (i < 0) return k.slice(0, 3);
  return `${k.slice(0, Math.min(i, 3))}.${k.slice(i + 1).replace(/\./g, '').slice(0, 1)}`;
};

type Side = 'scale' | 'net';

/**
 * Starts from `startKg` (the scale reading). `onChange` gets the scale reading
 * the typed weight means, or `null` while nothing usable is typed.
 */
export function TypedReading({ startKg, offsetKg, onChange }: { startKg: number; offsetKg: number; onChange: (readingKg: number | null) => void }) {
  const t = useTheme();
  const msg = useT();
  const [src, setSrc] = useState<Side>('scale');
  const [text, setText] = useState(() => fieldKg(startKg));
  const typed = parseKg(text);
  const other = typed === null ? '' : fieldKg(src === 'scale' ? netFromReading(typed, offsetKg) : readingFromNet(typed, offsetKg));
  const shown = (side: Side) => (side === src ? text : other);

  const type = (side: Side, raw: string) => {
    const next = clean(raw);
    const v = parseKg(next);
    setSrc(side);
    setText(next);
    onChange(v === null ? null : side === 'scale' ? v : readingFromNet(v, offsetKg));
  };

  const field = (side: Side) => {
    const typing = side === src;
    const leaf = side === 'net';
    const ink = leaf ? t.color.accept : t.color.ink;
    return (
      <View
        testID={`reading-${side}`}
        style={{
          gap: t.space.xs,
          padding: t.space.md,
          borderRadius: t.radius.lg,
          borderWidth: t.border.thick,
          borderStyle: typing ? 'solid' : 'dashed',
          borderColor: typing ? ink : t.color.ruleStrong,
          backgroundColor: typing ? t.color.surfaceRaised : t.color.surfaceSunk,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <IconTile tone={leaf ? 'accept' : 'action'} icon={(c) => (leaf ? <LeafIcon color={c} size={22} /> : <ScaleIcon color={c} size={22} />)} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg(leaf ? 'v2s.fieldNet' : 'v2s.fieldScale')}</AppText>
            <AppText variant="caption">{msg(leaf ? 'v2s.fieldNetSub' : 'v2s.fieldScaleSub')}</AppText>
          </View>
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
            {msg(typing ? 'v2s.typing' : 'v2s.calcForYou')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
          <TextInput
            testID={`reading-${side}-input`}
            value={shown(side)}
            onChangeText={(v) => type(side, v)}
            keyboardType="decimal-pad"
            inputMode="decimal"
            selectTextOnFocus
            maxLength={5}
            accessibilityLabel={`${msg(leaf ? 'v2s.fieldNet' : 'v2s.fieldScale')} ${msg('common.kg')}`}
            style={{ flex: 1, minWidth: 0, minHeight: 56, textAlign: 'right', fontFamily: t.font.family.sans, fontSize: 44, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: typing ? ink : t.color.inkSoft, padding: 0 }}
          />
          <AppText>{msg('common.kg')}</AppText>
        </View>
      </View>
    );
  };

  return (
    <View style={{ gap: t.space.xs }}>
      {field('scale')}
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {msg(offsetKg === 0 ? 'v2s.eqZero' : 'v2s.eqOffset', { n: fieldKg(offsetKg) })}
      </AppText>
      {field('net')}
    </View>
  );
}
