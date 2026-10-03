import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { isNoValue, type FieldDataState } from '../core/field-state';
import { useT } from '../i18n';
import { useTheme } from '../theme';

/**
 * The one badge for a field's data state (SYNC-12, E01-S15), drawn per
 * design-system §12.9 item 9. Every state carries a word (and, where the
 * design gives one, a mark) — never colour alone (NFR-4).
 *
 * - Unknown / Not recorded: soft ink, dashed `ruleStrong` border — "no value"
 * - Estimated: "≈" before the word
 * - AI suggested: a chip on `surfaceSunk` (not blue, not green)
 * - User provided / System calculated: the word alone
 *
 * Icons ("?" for Unknown, a sparkle for AI) come from E01-S13's `Icon`
 * component: `ICONS` is the slot they go in.
 */
const ICONS: Partial<Record<FieldDataState, ReactNode>> = {};

export function DataStateBadge({ state }: { state: FieldDataState }) {
  const t = useT();
  const theme = useTheme();
  const label = t(`dataState.${state}`);
  const noValue = isNoValue(state);
  const ai = state === 'ai-suggested';
  const icon = ICONS[state];

  return (
    <View
      testID={`data-state-${state}`}
      accessible
      accessibilityLabel={t('dataState.a11y', { label })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.space.xs,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xxs,
        borderRadius: theme.radius.pill,
        ...(noValue && { borderWidth: theme.border.hair, borderStyle: 'dashed', borderColor: theme.color.ruleStrong }),
        ...(ai && { backgroundColor: theme.color.surfaceSunk }),
      }}
    >
      {icon}
      <Text
        testID={`data-state-${state}-label`}
        style={{
          ...theme.face(theme.font.weight.regular),
          fontSize: theme.font.size.small,
          color: noValue ? theme.color.inkSoft : theme.color.ink,
        }}
      >
        {state === 'estimated' ? t('dataState.estimatedBadge', { mark: t('dataState.estimatedMark'), label }) : label}
      </Text>
    </View>
  );
}
