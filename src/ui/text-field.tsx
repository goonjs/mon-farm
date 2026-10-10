/**
 * TextField (v1.1.0 mockups): label with the red required *, the input, and
 * either helper text or an inline error under it. The input carries the
 * label (plus "required") as its accessible name and the helper/error as
 * its hint, so a screen reader hears all of it on focus. The error has a
 * non-colour cue too: a diamond and a thicker edge (NFR-4).
 */

import { TextInput, View, type TextInputProps } from 'react-native';

import { FieldError, FieldLabel } from './form';
import { AppText } from './type';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export function TextField({
  label,
  required,
  helper,
  error,
  testID,
  ...input
}: Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'accessibilityHint'> & {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  testID: string;
}) {
  const t = useTheme();
  const msg = useT();
  const hint = error ?? helper;

  return (
    <View style={{ gap: t.space.xs }}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <TextInput
        {...input}
        testID={testID}
        accessibilityLabel={required ? `${label}, ${msg('form.required')}` : label}
        accessibilityHint={hint}
        aria-invalid={!!error}
        placeholderTextColor={t.color.inkFaint}
        style={{
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
      {error ? (
        <FieldError testID={`${testID}-error`}>{error}</FieldError>
      ) : helper ? (
        <AppText variant="bodySm">{helper}</AppText>
      ) : null}
    </View>
  );
}
