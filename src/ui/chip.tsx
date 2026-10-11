/**
 * Chip — a status chip: a drawn icon plus a word on a tinted ground, never
 * colour alone (NFR-4). Tones are contrast-checked `{tone}Sunk` + `{tone}`
 * pairs. The word is the accessible name; the icon is decorative.
 */

import { Text, View } from 'react-native';

import { Check, Minus } from './icons';
import { useTheme, type Theme } from '../theme';

export type ChipTone = 'accept' | 'warn' | 'reject' | 'neutral';

function tone(t: Theme, k: ChipTone) {
  return {
    accept: { bg: t.color.acceptSunk, fg: t.color.accept },
    warn: { bg: t.color.warnSunk, fg: t.color.warn },
    reject: { bg: t.color.rejectSunk, fg: t.color.reject },
    neutral: { bg: t.color.surfaceSunk, fg: t.color.inkSoft },
  }[k];
}

/** accept = check, warn = half disc, reject = diamond, neutral = dash. */
function ChipIcon({ k, color }: { k: ChipTone; color: string }) {
  const testID = `chip-icon-${k}`;
  if (k === 'accept') {
    return (
      <View testID={testID} aria-hidden>
        <Check color={color} size={10} />
      </View>
    );
  }
  if (k === 'neutral') {
    return (
      <View testID={testID} aria-hidden>
        <Minus color={color} size={10} />
      </View>
    );
  }
  if (k === 'reject') {
    return <View testID={testID} aria-hidden style={{ width: 8, height: 8, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
  }
  return (
    <View
      testID={testID}
      aria-hidden
      style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: color, overflow: 'hidden', flexDirection: 'row' }}
    >
      <View style={{ flex: 1, backgroundColor: color }} />
      <View style={{ flex: 1 }} />
    </View>
  );
}

export function Chip({ label, tone: k = 'neutral', testID }: { label: string; tone?: ChipTone; testID?: string }) {
  const t = useTheme();
  const { bg, fg } = tone(t, k);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: t.space.xs,
        backgroundColor: bg,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.xxs,
      }}
    >
      <ChipIcon k={k} color={fg} />
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.semibold, color: fg }}>
        {label}
      </Text>
    </View>
  );
}
