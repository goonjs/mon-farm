/**
 * The last thing on เครื่องนี้ (owner 2026-11-02): a way into the icon
 * catalogue at /v2/dev/icons. It only shows icons and changes nothing, so it
 * is set apart from the settings above it: its own small "ดูอย่างเดียว"
 * heading over a rule, and a flat row on the page background instead of a
 * raised white card. Not dashed — a dashed edge means "disabled" in this
 * design system (src/ui/button.tsx).
 */

import type { Href } from 'expo-router';
import { View } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';
import { AppText, FarmMateIcon, FARMMATE_ICONS, MenuItem } from '../ui';

const ICON_CATALOG = '/v2/dev/icons' as Href;
const SAMPLE = ['nav.myFarm', 'sale.weigh', 'finance.income', 'people.tapper'] as const;

export function DevIconsLink() {
  const t = useTheme();
  const msg = useT();
  const tile = t.target.min;
  const mini = Math.round((tile - t.space.xs * 3) / 2);
  return (
    <View style={{ gap: t.space.sm, marginTop: t.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <AppText variant="label" style={{ color: t.color.inkFaint }}>
          {msg('v2.devIconsSection')}
        </AppText>
        <View style={{ flex: 1, height: t.border.hair, backgroundColor: t.color.rule }} />
      </View>
      <View
        style={{
          borderWidth: t.border.hair,
          borderColor: t.color.rule,
          borderRadius: t.radius.lg,
          paddingHorizontal: t.space.md,
          paddingVertical: t.space.xs,
        }}
      >
        <MenuItem
          testID="device-dev-icons"
          href={ICON_CATALOG}
          label={msg('v2.devIcons')}
          detail={msg('v2.devIconsDetail', { n: FARMMATE_ICONS.length })}
          leading={
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: t.radius.md,
                backgroundColor: t.color.surfaceSunk,
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignContent: 'center',
                justifyContent: 'center',
                gap: t.space.xs,
              }}
            >
              {SAMPLE.map((id) => (
                <FarmMateIcon key={id} id={id} size={mini} />
              ))}
            </View>
          }
        />
      </View>
    </View>
  );
}
