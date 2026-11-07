/**
 * KnowRow: the home page's "ควรรู้ / ควรจัดการ" row (mockup `.row`) — a tile,
 * a small label, a value, facts or a chip, and a chevron; the whole row is the
 * tap target (style A of the round-button review). Shared with the repay
 * sheet's sale card (owner 2026-11-07).
 */
import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type Theme } from '../theme';
import { ChevronRight, IconTile, type IconRender, type TileTone } from '../ui';

const body = (t: Theme) => ({ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.ink });

export function KnowRow({
  testID,
  tone,
  icon,
  label,
  value,
  chip,
  children,
  to,
  onPress,
}: {
  testID: string;
  tone: TileTone;
  icon: IconRender;
  label?: string;
  value?: string;
  chip?: React.ReactNode;
  children?: React.ReactNode;
  /** Where it goes; or `onPress` when the tap must do more first (a sheet closes, then navigates). */
  to?: Href;
  onPress?: () => void;
}) {
  const t = useTheme();
  const row = (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={onPress}
      style={{ minHeight: t.target.min, paddingVertical: t.space.sm, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}
    >
      <IconTile tone={tone} icon={icon} />
      <View style={{ flex: 1, minWidth: 0, gap: t.space.xxs }}>
        {label ? <Text style={{ ...body(t), color: t.color.inkSoft }}>{label}</Text> : null}
        {value ? <Text style={{ ...body(t), fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.semibold, fontVariant: ['tabular-nums'] }}>{value}</Text> : null}
        {chip}
        {children}
      </View>
      <ChevronRight color={t.color.inkFaint} />
    </Pressable>
  );
  return to && !onPress ? (
    <Link href={to} asChild>
      {row}
    </Link>
  ) : (
    row
  );
}
