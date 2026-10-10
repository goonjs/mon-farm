/**
 * Form primitives (v1.1.0 mockups): segmented control, radio card, field
 * label with the red required *, and the inline field error. Tokens only;
 * every state has a non-colour cue (filled segment, filled ring, dashed
 * edge, shape before the error) as NFR-4 requires.
 */

import { Pressable, Text, View } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Each segment gets `${testID}-${value}`. */
  testID: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        backgroundColor: t.color.surfaceSunk,
        borderRadius: t.radius.pill,
        padding: t.space.xs,
        gap: t.space.xs,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: t.target.min,
              borderRadius: t.radius.pill,
              backgroundColor: on ? t.color.action : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: t.space.md,
            }}
          >
            <Text
              style={{
                fontFamily: t.font.family.sans,
                fontSize: t.font.size.bodyMd,
                fontWeight: on ? t.font.weight.bold : t.font.weight.semibold,
                color: on ? t.color.inkInverse : t.color.inkSoft,
                textAlign: 'center',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RadioCard({
  selected,
  title,
  detail,
  onPress,
  disabled,
  testID,
  children,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** Extra content under the title (e.g. an example box). */
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const ring = disabled ? t.color.ruleStrong : selected ? t.color.action : t.color.ruleStrong;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: t.space.md,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: selected ? t.border.thick : t.border.hair,
        borderStyle: disabled ? 'dashed' : 'solid',
        borderColor: selected ? t.color.action : t.color.ruleStrong,
        backgroundColor: disabled ? t.color.disabledFill : selected ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <View
        aria-hidden
        style={{
          width: 22,
          height: 22,
          marginTop: 2,
          borderRadius: 11,
          borderWidth: t.border.thick,
          borderColor: ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ring }} /> : null}
      </View>
      <View style={{ flex: 1, gap: t.space.xxs }}>
        <Text
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyLg,
            fontWeight: t.font.weight.semibold,
            color: disabled ? t.color.disabledInk : t.color.ink,
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            style={{
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.bodySm,
              color: disabled ? t.color.disabledInk : t.color.inkSoft,
            }}
          >
            {detail}
          </Text>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}

/** A field's label; `required` adds the red * the mockups use. */
export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  const t = useTheme();
  const msg = useT();
  return (
    <Text
      style={{
        fontFamily: t.font.family.sans,
        fontSize: t.font.size.bodySm,
        fontWeight: t.font.weight.semibold,
        color: t.color.inkSoft,
      }}
    >
      {children}
      {required ? (
        <Text testID="required-mark" accessibilityLabel={msg('form.required')} style={{ color: t.color.reject }}>
          {' *'}
        </Text>
      ) : null}
    </Text>
  );
}

/** Inline error under a field: red text after a red diamond, announced politely. */
export function FieldError({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}
    >
      <View
        aria-hidden
        style={{ width: 7, height: 7, backgroundColor: t.color.reject, transform: [{ rotate: '45deg' }] }}
      />
      <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.reject }}>
        {children}
      </Text>
    </View>
  );
}
