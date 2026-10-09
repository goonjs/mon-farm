import { Pressable, Text, type TextStyle } from 'react-native';

import { dateParts } from '../core/thai-date';
import { useI18n } from '../i18n';
import type { MessageId } from '../i18n/messages';
import { useTheme } from '../theme';

/**
 * A calendar date, in the era the person chose (D-74 F14). Buddhist Era by
 * default; tapping ANY date switches every date in the app and the choice is
 * remembered on the device. Its own line by convention (D-70) — layout is the
 * caller's; this only renders the date.
 */
export function DateText({ ts, testID, style }: { ts: number; testID?: string; style?: TextStyle }) {
  const { t, era, toggleEra } = useI18n();
  const theme = useTheme();
  const p = dateParts(ts, era);
  const date = t('date.short', { day: p.day, month: t(`date.month${p.month}` as MessageId), year: p.year });
  const label = t('date.a11y', {
    date,
    era: t(era === 'be' ? 'date.eraBe' : 'date.eraCe'),
    other: t(era === 'be' ? 'date.eraCe' : 'date.eraBe'),
  });
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={toggleEra} hitSlop={8}>
      <Text style={[{ fontFamily: theme.font.family.sans, fontSize: theme.font.size.bodyMd, color: theme.color.ink }, style]}>
        {date}
      </Text>
    </Pressable>
  );
}
