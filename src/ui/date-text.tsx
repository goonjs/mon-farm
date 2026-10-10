/**
 * DateText — a slot for dates. It takes either a ready string or a Date plus
 * a formatter `(date, locale) => string`, so the real date logic (Buddhist /
 * Gregorian era toggle, D-74) can plug in later without touching screens.
 * With a Date and no formatter it shows the ISO day, plainly a stand-in.
 */

import { Text, type TextStyle } from 'react-native';

import { useI18n, type Locale } from '../i18n';
import { useTheme } from '../theme';

export type DateFormatter = (date: Date, locale: Locale) => string;

export function DateText({
  value,
  format,
  testID,
  style,
}: {
  value: string | Date;
  format?: DateFormatter;
  testID?: string;
  style?: TextStyle;
}) {
  const t = useTheme();
  const { locale } = useI18n();
  const text = typeof value === 'string' ? value : format ? format(value, locale) : value.toISOString().slice(0, 10);
  return (
    <Text
      testID={testID}
      style={[
        {
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodySm,
          fontVariant: ['tabular-nums'],
          color: t.color.inkSoft,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}
