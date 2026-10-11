/**
 * TopBar — the thin operator bar for the counter, ported from the e01-s17
 * chrome. Kept deliberately thin: every pixel here comes off the public
 * numeral (docs/ux/design-system.md §4). Other screens use ScreenHeader.
 */

import { Fragment } from 'react';
import { Text, View } from 'react-native';

import { ChevronRight } from './icons';
import { useTheme } from '../theme';

export function TopBar({ crumb, right }: { crumb: string | readonly string[]; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      testID="top-bar"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.xs,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.ruleFaint,
        backgroundColor: t.color.appBar,
      }}
    >
      <Text
        testID="crumb"
        // Drawn separators are silent; give screen readers the pauses.
        accessibilityLabel={typeof crumb === 'string' ? undefined : crumb.join(', ')}
        numberOfLines={1}
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.headingSm,
          lineHeight: t.font.size.headingSm * t.font.lineHeight.snug,
          fontWeight: t.font.weight.bold,
          color: t.color.appBarInk,
          flexShrink: 1,
        }}
      >
        {typeof crumb === 'string'
          ? crumb
          : crumb.map((part, i) => (
              <Fragment key={i}>
                {i > 0 ? (
                  <View testID="crumb-sep" aria-hidden style={{ paddingHorizontal: t.space.xs }}>
                    <ChevronRight color={t.color.inkSoft} size={7} />
                  </View>
                ) : null}
                {part}
              </Fragment>
            ))}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>{right}</View>
    </View>
  );
}
