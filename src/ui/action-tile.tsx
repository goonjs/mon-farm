/**
 * ActionTile — one of the home screen's action cards (v1.1.0 farm mockup
 * screens 1 and 9: "เตรียมขาย / เริ่มการขาย / บันทึกค่าใช้จ่าย"): a card-shaped
 * button with an IconTile over a short bold word. The main action carries a
 * thick `action` edge, so it stands out by shape as well as colour. Lay three
 * side by side in a row with `flex: 1` each. Tokens only.
 */

import { Link, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { IconTile, type IconRender, type TileTone } from './icon-tile';
import { useTheme } from '../theme';

/** Mockup `.act { min-height: 104px }`: tile + two lines of label. */
const MIN_HEIGHT = 104;

export function ActionTile({
  label,
  sub,
  icon,
  tone = 'action',
  main,
  href,
  onPress,
  testID,
}: {
  label: string;
  /** A short second line under the label (e.g. progress "2/4"); absent = the tile is as before. */
  sub?: string;
  icon: IconRender;
  tone?: TileTone;
  /** The screen's primary action (thick action-coloured edge). */
  main?: boolean;
  href?: Href;
  onPress?: () => void;
  testID?: string;
}) {
  const tile = <Tile label={label} sub={sub} icon={icon} tone={tone} main={main} testID={testID} onTilePress={onPress} />;
  return href ? (
    <Link href={href} asChild>
      {tile}
    </Link>
  ) : (
    tile
  );
}

function Tile({
  label,
  sub,
  icon,
  tone,
  main,
  testID,
  onTilePress,
  onPress,
  ...rest
}: {
  label: string;
  sub?: string;
  icon: IconRender;
  tone: TileTone;
  main?: boolean;
  testID?: string;
  onTilePress?: () => void;
  /** Supplied by `<Link asChild>`. */
  onPress?: (e: unknown) => void;
}) {
  const t = useTheme();
  const sh = t.shadow.card;
  return (
    <Pressable
      {...rest}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label} ${sub}` : label}
      onPress={(e) => {
        onTilePress?.();
        onPress?.(e);
      }}
      style={{
        flex: 1,
        minHeight: MIN_HEIGHT,
        paddingVertical: t.space.md,
        paddingHorizontal: t.space.xs,
        borderRadius: t.radius.lg,
        backgroundColor: t.color.surfaceRaised,
        borderWidth: main ? t.border.thick : t.border.hair,
        borderColor: main ? t.color.action : t.color.ruleFaint,
        boxShadow: `0px ${sh.y}px ${sh.blur}px ${sh.color}`,
        alignItems: 'center',
        gap: t.space.sm,
      }}
    >
      <IconTile tone={tone} icon={icon} />
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodyMd,
          lineHeight: t.font.size.bodyMd * t.font.lineHeight.snug,
          fontWeight: t.font.weight.bold,
          color: t.color.ink,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      {sub ? (
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.inkSoft, textAlign: 'center' }}>{sub}</Text>
      ) : null}
    </Pressable>
  );
}
