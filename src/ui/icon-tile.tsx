/**
 * IconTile and FactRow (v1.1.0 mockups; D-70: one fact per line).
 *
 * IconTile — a rounded square in a tinted ground with the icon in the
 * matching ink: `{tone}Sunk` + `{tone}` (all contrast-checked pairs).
 * Decorative: whatever sits beside it names the thing.
 *
 * FactRow — a small icon and one short fact in secondary text, one line.
 * Stack several for a card's details instead of joining them with "·".
 */

import { Text, View } from 'react-native';

import { useTheme, type Theme } from '../theme';

export type TileTone =
  | 'accept'
  | 'action'
  | 'cream'
  | 'warn'
  | 'neutral'
  | 'reject'
  | 'category1'
  | 'category2'
  | 'category3'
  | 'category4'
  | 'category5'
  | 'category6';

/** Icons in ui/icons.tsx take their colour; the tile decides it. */
export type IconRender = (colour: string) => React.ReactNode;

export function toneColours(t: Theme, tone: TileTone) {
  switch (tone) {
    case 'accept':
      return { bg: t.color.acceptSunk, fg: t.color.accept };
    case 'warn':
      return { bg: t.color.warnSunk, fg: t.color.warn };
    case 'action':
      // Mockup `t-blue`.
      return { bg: t.color.actionSunk, fg: t.color.action };
    case 'cream':
      // Mockup `t-cream`: warn ink on the cream ground (checked pair).
      return { bg: t.color.brandCream, fg: t.color.warn };
    case 'neutral':
      return { bg: t.color.surfaceSunk, fg: t.color.inkSoft };
    default:
      return { bg: t.color[`${tone}Sunk`], fg: t.color[tone] };
  }
}

/** Mockup `.tile.sm`: the home's module tiles. */
const SMALL = 36;

export function IconTile({
  tone = 'accept',
  size = 'regular',
  icon,
  testID,
}: {
  tone?: TileTone;
  /** `sm` = 36 square, for dense tiles; the tile is decorative, so it is no touch target. */
  size?: 'regular' | 'sm';
  icon: IconRender;
  testID?: string;
}) {
  const t = useTheme();
  const { bg, fg } = toneColours(t, tone);
  const side = size === 'sm' ? SMALL : t.target.min;
  return (
    <View
      testID={testID}
      aria-hidden
      style={{
        width: side,
        height: side,
        borderRadius: size === 'sm' ? t.radius.sm : t.radius.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon(fg)}
    </View>
  );
}

export function FactRow({ icon, children, testID }: { icon?: IconRender; children: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
      {icon ? (
        <View aria-hidden style={{ width: 14, alignItems: 'center' }}>
          {icon(t.color.inkSoft)}
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodySm,
          color: t.color.inkSoft,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
