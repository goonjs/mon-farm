/**
 * DateField (E01-S22) — a date that is picked, never typed. The owner (2026-11-15): where a date was typed it
 * becomes a date picker that looks like one. A picker row in the design system's style (§12.7 Pickers): the
 * field's label above, then a card the whole width with a calendar mark, the date in bold in the user's era,
 * and ›. Tapping anywhere on it opens DatePickerSheet over whatever is showing (a sheet included). Ranges are
 * free unless a caller passes `min`/`max`; an optional date passes `emptyLabel` to offer "no date".
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cardStyle } from './card';
import { DatePickerSheet } from './date-picker-sheet';
import { FieldError, FieldLabel } from './form';
import { CalendarIcon, ChevronRight } from './icons';
import { formatDate } from '../core/finance/money';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export interface DateFieldProps {
  readonly testID: string;
  readonly label: string;
  /** ISO "YYYY-MM-DD", or "" when an optional date is not set. */
  readonly value: string;
  readonly onChange: (iso: string) => void;
  readonly required?: boolean;
  readonly error?: string;
  /** Shown in the row while the value is "" (e.g. "ไม่ระบุวันเริ่ม"). */
  readonly emptyText?: string;
  /** Offers "no date" in the picker with this label (E01-S22 DP-2). */
  readonly emptyLabel?: string;
  /** Title of the picker; defaults to the label. */
  readonly title?: string;
  readonly min?: string;
  readonly max?: string;
}

export function DateField({ testID, label, value, onChange, required, error, emptyText, emptyLabel, title, min, max }: DateFieldProps) {
  const t = useTheme();
  const { era } = useI18n();
  const [open, setOpen] = useState(false);
  const shown = value ? formatDate(value, era) : (emptyText ?? '—');
  return (
    <View style={{ gap: t.space.xs }}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${shown}`}
        onPress={() => setOpen(true)}
        style={[
          cardStyle(t),
          {
            minHeight: t.target.comfortable,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.md,
            paddingHorizontal: t.space.md,
            paddingVertical: t.space.sm,
            borderWidth: error ? t.border.thick : t.border.hair,
            borderColor: error ? t.color.reject : t.color.rule,
          },
        ]}
      >
        <View testID={`${testID}-calendar`} aria-hidden>
          <CalendarIcon color={t.color.action} size={22} />
        </View>
        <Text
          testID={`${testID}-value`}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyLg,
            fontWeight: value ? t.font.weight.bold : t.font.weight.regular,
            color: value ? t.color.ink : t.color.inkSoft,
            fontVariant: ['tabular-nums'],
          }}
        >
          {shown}
        </Text>
        <View testID={`${testID}-chevron`} aria-hidden>
          <ChevronRight color={t.color.inkFaint} />
        </View>
      </Pressable>
      {error ? <FieldError testID={`${testID}-error`}>{error}</FieldError> : null}
      <DatePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
        title={title ?? label.replace(/ \*$/, '')}
        min={min}
        max={max}
        emptyLabel={emptyLabel}
        testID={`${testID}-picker`}
      />
    </View>
  );
}
