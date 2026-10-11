/**
 * ScreenHeader — the one header every screen uses (v1.1.0 mockups): a back
 * chevron (or ☰ on the home screen), title over a soft subtitle, and the
 * sync pill plus any extra actions on the right. Tokens only.
 *
 * The counter keeps its own thin `TopBar` (ui/top-bar.tsx): every
 * pixel of chrome there comes off the public numeral (design-system §4).
 */

import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ChevronLeft, MenuIcon } from './icons';
import { ActionButton, type HeaderPrimaryAction } from './action-button';
import { SyncPill } from './sync-pill';
import { useT } from '../i18n';
import type { SyncStatus } from '../sync/status';
import { useTheme } from '../theme';

export interface HeaderAction {
  readonly onPress?: () => void;
  readonly testID?: string;
}

export interface BackAction extends HeaderAction {
  /** Navigate like a `<Link>` (same semantics the old text buttons had); else `onPress`. */
  readonly href?: Href;
  /** Catalogue label such as "← รายการ" — the arrow is dropped for the accessible name. */
  readonly label: string;
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  menu,
  sync,
  right,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: BackAction;
  menu?: HeaderAction;
  /** Omit for no pill; `null` while loading (no pill yet). */
  sync?: SyncStatus | null;
  right?: React.ReactNode;
  /** Optional primary button in the top-right corner, right of the sync pill. */
  action?: HeaderPrimaryAction;
}) {
  const t = useTheme();
  const msg = useT();
  const square = { minWidth: t.target.min, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <View
      testID="screen-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        minHeight: t.layout.topBarHeight,
        paddingLeft: back || menu ? t.space.xs : t.space.lg,
        paddingRight: action ? t.space.sm : t.space.md,
        paddingVertical: t.space.xs,
        backgroundColor: t.color.appBar,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.ruleFaint,
      }}
    >
      {back ? (
        back.href ? (
          <Link href={back.href} asChild>
            <BackButton back={back} style={square} color={t.color.appBarInk} />
          </Link>
        ) : (
          <BackButton back={back} style={square} color={t.color.appBarInk} />
        )
      ) : menu ? (
        <Pressable
          testID={menu.testID ?? 'open-menu'}
          onPress={menu.onPress}
          accessibilityRole="button"
          accessibilityLabel={msg('menu.open')}
          style={square}
        >
          <MenuIcon color={t.color.appBarInk} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          testID="screen-title"
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.headingLg,
            lineHeight: t.font.size.headingLg * t.font.lineHeight.snug,
            fontWeight: t.font.weight.bold,
            color: t.color.appBarInk,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.inkSoft }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
      {sync ? <SyncPill status={sync} /> : null}
      {action ? <ActionButton action={action} /> : null}
    </View>
  );
}

/** Pressable so `<Link asChild>` can hand it its navigation `onPress`. */
function BackButton({
  back,
  style,
  color,
  onPress,
  ...rest
}: {
  back: BackAction;
  style: object;
  color: string;
  onPress?: (e: unknown) => void;
}) {
  return (
    <Pressable
      {...rest}
      testID={back.testID}
      onPress={onPress ?? back.onPress}
      accessibilityRole="button"
      accessibilityLabel={back.label.replace(/^←\s*/, '')}
      style={style}
    >
      <ChevronLeft color={color} />
    </Pressable>
  );
}
