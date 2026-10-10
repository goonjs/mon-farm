/**
 * Card — the v1.1.0 card (docs/ux/mockups/flow-*-v1.1.0.html): raised
 * surface, a `ruleFaint` hairline so an edge survives in direct sun, and the
 * soft card shadow (owner §12.9 Q4). Ported from the e01-s17 chrome; tokens
 * only.
 */

import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme';

/** The card look, to spread into a View's style. */
export function cardStyle(t: Theme): ViewStyle {
  const sh = t.shadow.card;
  return {
    backgroundColor: t.color.surfaceRaised,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleFaint,
    borderRadius: t.radius.lg,
    boxShadow: `0px ${sh.y}px ${sh.blur}px ${sh.color}`,
  };
}

/** Small heading inside a card — sans, because mono cannot set Thai well. */
export function cardLabelStyle(t: Theme): TextStyle {
  return {
    fontFamily: t.font.family.sans,
    fontSize: t.font.size.bodySm,
    fontWeight: t.font.weight.semibold,
    color: t.color.inkSoft,
  };
}

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  return <View testID={testID} style={[cardStyle(t), { padding: t.space.lg, gap: t.space.sm }, style]}>{children}</View>;
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={cardLabelStyle(t)}>{children}</Text>;
}
