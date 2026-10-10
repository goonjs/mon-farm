/**
 * Operator-register chrome: the topbar, state pills and tabs.
 *
 * Kept deliberately thin. Every pixel here is a pixel taken off the numeral,
 * and the numeral's height is the tightest constraint in the product
 * (docs/ux/design-system.md §4).
 */

import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme';

/**
 * The v1.1.0 card (docs/ux/mockups/flow-*-v1.1.0.html): raised surface, a
 * `ruleFaint` hairline so an edge survives in direct sun, and the soft card
 * shadow (owner §12.9 Q4). Spread into a View's style.
 */
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

export function CardLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[cardLabelStyle(t), { marginBottom: t.space.sm }]}>{children}</Text>;
}

export type PillTone = 'neutral' | 'accept' | 'warn' | 'count';

export function Pill({
  children,
  tone = 'neutral',
  dot,
  testID,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  /** Non-colour encoding — F-16 requires shape as well as hue. */
  dot?: 'filled' | 'hollow' | 'half';
  testID?: string;
}) {
  const t = useTheme();
  const tones = {
    neutral: { bg: t.color.surfaceSunk, fg: t.color.inkSoft },
    accept: { bg: t.color.acceptSunk, fg: t.color.accept },
    warn: { bg: t.color.warnSunk, fg: t.color.warn },
    count: { bg: t.color.ink, fg: t.color.inkInverse },
  }[tone];

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        backgroundColor: tones.bg,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space.md,
        // xxs, not xs: pills sit in the counter's top bar, whose height comes
        // straight off the public numeral (see TopBar).
        paddingVertical: t.space.xxs,
      }}
    >
      {dot ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dot === 'hollow' ? 'transparent' : tones.fg,
            borderWidth: dot === 'filled' ? 0 : 2,
            borderColor: tones.fg,
          }}
        />
      ) : null}
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.caption,
          color: tones.fg,
          fontWeight: tone === 'count' ? t.font.weight.bold : t.font.weight.semibold,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function TopBar({ crumb, right }: { crumb: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      testID="top-bar"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        paddingHorizontal: t.space.md,
        // Vertical padding stays at xs: on the counter every pixel of chrome
        // comes off the public numeral, and its F-9.7 height floor (e2e) has
        // only a few px of slack at the 390px-high landscape phone.
        paddingVertical: t.space.xs,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.ruleFaint,
        backgroundColor: t.color.appBar,
      }}
    >
      <Text
        testID="crumb"
        numberOfLines={1}
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.headingSm,
          lineHeight: t.font.size.headingSm * t.font.lineHeight.snug,
          fontWeight: t.font.weight.bold,
          color: t.color.appBarInk,
          flexShrink: 1,
        }}
      >
        {crumb}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>{right}</View>
    </View>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        paddingHorizontal: t.space.xs,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.ruleFaint,
        backgroundColor: t.color.appBar,
      }}
    >
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(tab.key)}
            style={{
              paddingHorizontal: t.space.lg,
              paddingVertical: t.space.xs,
              borderBottomWidth: 3,
              borderBottomColor: on ? t.color.action : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: t.font.family.sans,
                fontSize: t.font.size.small,
                fontWeight: on ? t.font.weight.bold : t.font.weight.medium,
                color: on ? t.color.action : t.color.inkSoft,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({
  children,
  onPress,
  variant = 'ghost',
  disabled,
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** `row`: a list row inside a card (v1.1.0 home) — text left, chevron right. */
  variant?: 'primary' | 'ghost' | 'destructive' | 'row';
  disabled?: boolean;
  testID?: string;
  /** When the visible text alone does not say what the button acts on. */
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  if (variant === 'row') {
    return (
      <Pressable
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        style={{
          minHeight: t.target.min,
          borderWidth: 0,
          borderRadius: t.radius.md,
          paddingHorizontal: t.space.xs,
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: t.space.sm,
        }}
      >
        <Text
          style={{
            flex: 1,
            alignSelf: 'center',
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyLg,
            fontWeight: t.font.weight.semibold,
            color: disabled ? t.color.disabledInk : t.color.ink,
            textAlign: 'left',
          }}
        >
          {children}
        </Text>
        <Text
          aria-hidden
          style={{
            alignSelf: 'center',
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.headingLg,
            color: t.color.inkFaint,
          }}
        >
          ›
        </Text>
      </Pressable>
    );
  }
  // v1.1.0 mockups: pill buttons. Primary = navy fill; secondary ("ghost") =
  // raised fill with a navy outline; destructive = red outline. Disabled is a
  // state of its own (story recipe) rather than a faded copy: a disabled fill,
  // a label that still reads at AA, and a dashed control border.
  const styles = disabled
    ? { bg: t.color.disabledFill, fg: t.color.disabledInk, border: t.color.ruleStrong }
    : {
        primary: { bg: t.color.action, fg: t.color.inkInverse, border: t.color.action },
        ghost: { bg: t.color.surfaceRaised, fg: t.color.action, border: t.color.action },
        destructive: { bg: t.color.surfaceRaised, fg: t.color.reject, border: t.color.reject },
      }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: t.target.min,
        paddingHorizontal: t.space.lg,
        borderRadius: t.radius.pill,
        borderWidth: t.border.thick,
        borderStyle: disabled ? 'dashed' : 'solid',
        borderColor: styles.border,
        backgroundColor: styles.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: variant === 'primary' ? t.font.size.bodyLg : t.font.size.bodyMd,
          fontWeight: variant === 'primary' ? t.font.weight.bold : t.font.weight.semibold,
          color: styles.fg,
          textAlign: 'center',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
