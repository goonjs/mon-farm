/**
 * The small set of building blocks the farm-data screens share (E03), after
 * the v1.1.0 farm mockup: a header with a back link, white cards on the
 * surface, chips that toggle, a list row, a text field with its error.
 *
 * The counter screen's `chrome.tsx` is deliberately thin to save height for
 * the numeral; these screens are forms, read at arm's length, so they use the
 * body sizes and the 48 dp target floor instead (NFR-4).
 */

import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';

export function FarmScreen({
  title,
  subtitle,
  back,
  children,
  footer,
  right,
  overlay,
}: {
  title: string;
  subtitle?: string;
  back: Href;
  children: ReactNode;
  footer?: ReactNode;
  /** Top-right of the header (mockup: the round "แก้" button on a detail screen). */
  right?: ReactNode;
  /** Over the whole screen, e.g. a `Sheet`. */
  overlay?: ReactNode;
}) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, padding: t.space.md }}>
        <Pressable
          testID="back"
          accessibilityRole="button"
          accessibilityLabel="กลับ"
          // Pop, so going back never stacks a second copy of the parent; `back`
          // is where to land when there is no history (a reload, a deep link).
          onPress={() => (router.canGoBack() ? router.back() : router.replace(back))}
          style={{ minWidth: t.target.min, minHeight: t.target.min, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: t.font.size.headingLg, color: t.color.ink }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, paddingTop: 0, gap: t.space.md }}>
        {children}
      </ScrollView>
      {footer ? <View style={{ padding: t.space.md }}>{footer}</View> : null}
      {overlay}
    </View>
  );
}

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: t.color.surfaceRaised,
        borderRadius: t.radius.lg,
        borderWidth: t.border.hair,
        borderColor: t.color.ruleFaint,
        padding: t.space.md,
        gap: t.space.sm,
      }}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  on,
  onPress,
  testID,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: on ? t.border.thick : t.border.hair,
        borderColor: on ? t.color.action : t.color.ruleStrong,
        backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {on ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>{children}</View>;
}

/** One tappable list row: title, detail lines, and an optional badge. */
export function ListRow({
  title,
  lines = [],
  badge,
  onPress,
  testID,
}: {
  title: string;
  lines?: readonly string[];
  badge?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.target.min, paddingVertical: t.space.xs }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {title}
        </Text>
        {lines.map((l) => (
          <Text key={l} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
            {l}
          </Text>
        ))}
      </View>
      {badge}
      {onPress ? <Text style={{ fontSize: t.font.size.headingLg, color: t.color.inkSoft }}>›</Text> : null}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  testID,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.xs, flex: 1 }}>
      {label ? (
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.color.inkFaint}
        style={{
          minHeight: t.target.min,
          paddingHorizontal: t.space.md,
          borderRadius: t.radius.md,
          borderWidth: error ? t.border.thick : t.border.hair,
          borderColor: error ? t.color.reject : t.color.ruleStrong,
          backgroundColor: t.color.surfaceRaised,
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.body,
          color: t.color.ink,
        }}
      />
      {error ? <FieldError text={error} /> : null}
    </View>
  );
}

export function FieldError({ text }: { text: string }) {
  const t = useTheme();
  const style = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.reject };
  return (
    <View style={{ flexDirection: 'row', gap: t.space.xs }}>
      <Text style={style}>⚠</Text>
      <Text style={[style, { flexShrink: 1 }]}>{text}</Text>
    </View>
  );
}

/** A big, plain label for state that must not be missed — e.g. "ลบแล้ว" (D-74 F13). */
export function StateBadge({ text, testID }: { text: string; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ backgroundColor: t.color.rejectSunk, borderRadius: t.radius.sm, paddingHorizontal: t.space.sm, paddingVertical: t.space.xs }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.reject }}>
        {text}
      </Text>
    </View>
  );
}

/** A small link-styled button — for secondary actions like "กู้คืน" (D-74 F13). */
export function LinkButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.xs }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.action, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A bottom sheet (mockup v1.1.0: delete confirms): a dimmed backdrop that
 * cancels on tap, a rounded top with a handle. Kept here until the shared
 * sheet from the design-system work lands; then this becomes that.
 */
export function Sheet({ children, onClose, testID }: { children: ReactNode; onClose: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ปิด"
        onPress={onClose}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: t.color.ink, opacity: 0.45 }}
      />
      <View
        testID={testID}
        style={{
          backgroundColor: t.color.surfaceRaised,
          borderTopLeftRadius: t.radius.xxl,
          borderTopRightRadius: t.radius.xxl,
          padding: t.space.lg,
          gap: t.space.md,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: t.radius.pill, backgroundColor: t.color.ruleStrong }} />
        {children}
      </View>
    </View>
  );
}
