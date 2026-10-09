/**
 * Operator-register chrome: the topbar, state pills and tabs.
 *
 * Kept deliberately thin. Every pixel here is a pixel taken off the numeral,
 * and the numeral's height is the tightest constraint in the product
 * (docs/ux/design-system.md §4).
 */

import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { useTheme } from '../theme';

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
        gap: 5,
        backgroundColor: tones.bg,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space.sm,
        paddingVertical: 3,
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
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: tones.fg,
          fontWeight: tone === 'count' ? t.font.weight.bold : t.font.weight.regular,
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        paddingHorizontal: t.space.sm,
        paddingVertical: t.space.xs,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.rule,
        backgroundColor: t.color.surface,
      }}
    >
      <Text
        testID="crumb"
        numberOfLines={1}
        style={{
          ...t.face(t.font.weight.bold),
          fontSize: t.font.size.small,
          color: t.color.ink,
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
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.rule,
        backgroundColor: t.color.surface,
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
                ...t.face(on ? t.font.weight.bold : t.font.weight.medium),
                fontSize: t.font.size.small,
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
  icon,
  iconAfter,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'destructive';
  disabled?: boolean;
  testID?: string;
  /** Leading icon. Decorative — the button is named by its text. */
  icon?: IconName;
  /** Trailing icon, for forward navigation ("next"). Decorative too. */
  iconAfter?: IconName;
  /** When the visible text alone does not say what the button acts on. */
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const styles = {
    primary: { bg: t.color.action, fg: t.color.inkInverse, border: 'transparent' },
    ghost: { bg: 'transparent', fg: t.color.action, border: t.color.ruleStrong },
    destructive: { bg: 'transparent', fg: t.color.reject, border: t.color.reject },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 40,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.md,
        borderWidth: t.border.hair,
        borderColor: styles.border,
        backgroundColor: styles.bg,
        flexDirection: 'row',
        gap: t.space.xs,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? t.opacity.disabled : 1,
      }}
    >
      {icon ? <Icon name={icon} color={styles.fg} size={t.font.size.small * 1.25} /> : null}
      <Text
        style={{
          ...t.face(t.font.weight.medium),
          fontSize: t.font.size.small,
          color: styles.fg,
        }}
      >
        {children}
      </Text>
      {iconAfter ? <Icon name={iconAfter} color={styles.fg} size={t.font.size.small * 1.25} /> : null}
    </Pressable>
  );
}
