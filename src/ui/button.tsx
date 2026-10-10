/**
 * Button / CTA and PinnedActions (v1.1.0 mockups), ported from the e01-s17
 * chrome as new code. Pill buttons at the 48pt field floor; `size="large"`
 * is the 56pt pinned call to action. Disabled is its own state (disabled
 * fill, readable label, dashed edge), never a faded copy. Tokens only; the
 * row chevron is drawn, not a glyph.
 */

import { Children } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronRight } from './icons';
import { useTheme } from '../theme';

export type ButtonVariant = 'primary' | 'ghost' | 'destructive' | 'row';

export function Button({
  children,
  onPress,
  variant = 'ghost',
  size = 'regular',
  icon,
  disabled,
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** `row`: a list row inside a card — text left, chevron right. */
  variant?: ButtonVariant;
  /** `large`: the 56pt pinned call to action. */
  size?: 'regular' | 'large';
  /** Leading icon from ui/icons, painted in the label colour. */
  icon?: (colour: string) => React.ReactNode;
  disabled?: boolean;
  testID?: string;
  /** When the visible text alone does not say what the button acts on. */
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const a11y = {
    testID,
    accessibilityLabel,
    accessibilityRole: 'button' as const,
    accessibilityState: { disabled: !!disabled },
    onPress,
    disabled,
  };

  if (variant === 'row') {
    return (
      <Pressable
        {...a11y}
        style={{
          minHeight: t.target.min,
          borderWidth: 0,
          borderRadius: t.radius.md,
          paddingHorizontal: t.space.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyLg,
            fontWeight: t.font.weight.semibold,
            color: disabled ? t.color.disabledInk : t.color.ink,
            textAlign: 'left',
          }}
        >
          {children}
        </Text>
        <View testID={testID ? `${testID}-chevron` : undefined} aria-hidden>
          <ChevronRight color={t.color.inkFaint} />
        </View>
      </Pressable>
    );
  }

  const tone = disabled
    ? { bg: t.color.disabledFill, fg: t.color.disabledInk, border: t.color.ruleStrong }
    : {
        primary: { bg: t.color.action, fg: t.color.inkInverse, border: t.color.action },
        ghost: { bg: t.color.surfaceRaised, fg: t.color.action, border: t.color.action },
        destructive: { bg: t.color.surfaceRaised, fg: t.color.reject, border: t.color.reject },
      }[variant];

  return (
    <Pressable
      {...a11y}
      style={{
        minHeight: size === 'large' ? t.target.comfortable : t.target.min,
        paddingHorizontal: size === 'large' ? t.space.xl : t.space.lg,
        borderRadius: t.radius.pill,
        borderWidth: t.border.thick,
        borderStyle: disabled ? 'dashed' : 'solid',
        borderColor: tone.border,
        backgroundColor: tone.bg,
        flexDirection: 'row',
        gap: t.space.sm,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? <View aria-hidden>{icon(tone.fg)}</View> : null}
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: variant === 'primary' || size === 'large' ? t.font.size.bodyLg : t.font.size.bodyMd,
          fontWeight: variant === 'primary' ? t.font.weight.bold : t.font.weight.semibold,
          color: tone.fg,
          textAlign: 'center',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** The large pinned call to action: a primary, 56pt Button. */
export function CTA(props: Omit<React.ComponentProps<typeof Button>, 'size' | 'variant'>) {
  return <Button {...props} variant="primary" size="large" />;
}

/**
 * The pinned bottom bar for a screen's main action(s): a large pill CTA on
 * the screen ground, no rule above it. Children share the width; put it
 * after the ScrollView, outside it.
 */
export function PinnedActions({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: t.space.sm,
        paddingHorizontal: t.layout.screenPaddingX,
        paddingVertical: t.space.md,
        backgroundColor: t.color.surface,
      }}
    >
      {Children.map(children, (child) => (child ? <View style={{ flex: 1 }}>{child}</View> : null))}
    </View>
  );
}
