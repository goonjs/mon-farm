/**
 * ActionTile — one of the home screen's action cards (v1.1.0 farm mockup
 * screens 1 and 9: "เตรียมขาย / เริ่มการขาย / บันทึกค่าใช้จ่าย"): a card-shaped
 * button with an IconTile over a short bold word. The main action carries a
 * thick `action` edge, so it stands out by shape as well as colour. Lay three
 * side by side in a row with `flex: 1` each. Tokens only.
 *
 * `tint` (E15-S06) paints the frame and ground in a state colour and `badge` floats a small round word or icon at
 * the top right, over the tile: neither adds a line nor changes the tile's size, so three tiles side by side never
 * move between states. Without them the tile is as it always was.
 */

import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconTile, type IconRender, type TileTone } from './icon-tile';
import { useTheme } from '../theme';

/** Mockup `.act { min-height: 104px }`: tile + two lines of label. */
const MIN_HEIGHT = 104;

export type TileState = 'warn' | 'action' | 'accept';

export interface TileBadge {
  /** A word or number … */
  readonly text?: string;
  /** … or an icon, drawn in the ink-on-colour tone. */
  readonly icon?: (colour: string) => ReactNode;
  readonly tone: 'warn' | 'action' | 'accept' | 'reject';
  /** What a screen reader says; the tile's own label then carries it too. */
  readonly label: string;
}

export function ActionTile({
  label,
  icon,
  tone = 'action',
  main,
  tint,
  badge,
  href,
  onPress,
  testID,
}: {
  label: string;
  icon: IconRender;
  tone?: TileTone;
  /** The screen's primary action (thick action-coloured edge). */
  main?: boolean;
  /** A state colour for the frame and ground (yellow warn, blue action, green accept). */
  tint?: TileState;
  badge?: TileBadge;
  href?: Href;
  onPress?: () => void;
  testID?: string;
}) {
  const tile = <Tile label={label} icon={icon} tone={tone} main={main} tint={tint} badge={badge} testID={testID} onTilePress={onPress} />;
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
  icon,
  tone,
  main,
  tint,
  badge,
  testID,
  onTilePress,
  onPress,
  ...rest
}: {
  label: string;
  icon: IconRender;
  tone: TileTone;
  main?: boolean;
  tint?: TileState;
  badge?: TileBadge;
  testID?: string;
  onTilePress?: () => void;
  /** Supplied by `<Link asChild>`. */
  onPress?: (e: unknown) => void;
}) {
  const t = useTheme();
  const sh = t.shadow.card;
  const ground = tint ? { warn: t.color.warnSunk, action: t.color.actionSunk, accept: t.color.acceptSunk }[tint] : t.color.surfaceRaised;
  const frame = tint ? t.color[tint] : main ? t.color.action : t.color.ruleFaint;
  const thick = !!tint || !!main;
  // A thicker frame is paid for in padding, so the content box does not move between states.
  const extra = tint ? t.border.thick - t.border.hair : 0;
  return (
    <Pressable
      {...rest}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} ${badge.label}` : label}
      onPress={(e) => {
        onTilePress?.();
        onPress?.(e);
      }}
      style={{
        flex: 1,
        minHeight: MIN_HEIGHT,
        paddingVertical: t.space.md - extra,
        paddingHorizontal: t.space.xs - extra,
        borderRadius: t.radius.lg,
        backgroundColor: ground,
        borderWidth: thick ? t.border.thick : t.border.hair,
        borderColor: frame,
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
      {badge ? (
        <View
          testID={testID ? `${testID}-badge` : undefined}
          accessibilityLabel={badge.label}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: t.radius.pill,
            backgroundColor: t.color[badge.tone],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badge.icon ? (
            badge.icon(t.color.inkInverse)
          ) : (
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.black, color: t.color.inkInverse, fontVariant: ['tabular-nums'] }}>{badge.text}</Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}
