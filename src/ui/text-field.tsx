/**
 * TextField (v1.1.0 mockups): label with the red required *, the input, and
 * either helper text or an inline error under it. The input carries the
 * label (plus "required") as its accessible name and the helper/error as
 * its hint, so a screen reader hears all of it on focus. The error has a
 * non-colour cue too: a diamond and a thicker edge (NFR-4).
 */

import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { FieldError, FieldLabel } from './form';
import { AppText } from './type';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export function TextField({
  label,
  required,
  hint: labelHint,
  helper,
  error,
  aside,
  testID,
  ...input
}: Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'accessibilityHint'> & {
  label: string;
  required?: boolean;
  /** A short soft note beside the label ("ไม่บังคับ"). */
  hint?: string;
  helper?: string;
  error?: string;
  /** Beside the input: a unit, or a field-state label such as "ไม่ทราบ". */
  aside?: React.ReactNode;
  testID: string;
}) {
  const t = useTheme();
  const msg = useT();
  const hint = error ?? helper;
  const name = [label, required ? msg('form.required') : null, labelHint ?? null].filter(Boolean).join(', ');

  const field = (
    <TextInput
      {...input}
      testID={testID}
      accessibilityLabel={name}
      accessibilityHint={hint}
      aria-invalid={!!error}
      placeholderTextColor={t.color.inkFaint}
      style={{
        flex: 1,
        minHeight: t.target.min,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.md,
        borderWidth: error ? t.border.thick : t.border.hair,
        borderColor: error ? t.color.reject : t.color.ruleStrong,
        backgroundColor: t.color.surfaceRaised,
        color: t.color.ink,
        fontFamily: t.font.family.sans,
        fontSize: t.font.size.bodyLg,
      }}
    />
  );

  return (
    <View style={{ gap: t.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs, flexWrap: 'wrap' }}>
        <FieldLabel required={required}>{label}</FieldLabel>
        {labelHint ? (
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>{labelHint}</Text>
        ) : null}
      </View>
      {/* Always the same row, aside or not: swapping the input's parent would
          remount it, and focus (and the phone keyboard) would go with it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        {field}
        {aside ?? null}
      </View>
      {error ? (
        <FieldError testID={`${testID}-error`}>{error}</FieldError>
      ) : helper ? (
        <AppText variant="bodySm">{helper}</AppText>
      ) : null}
    </View>
  );
}
