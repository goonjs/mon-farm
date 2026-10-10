/**
 * Drawer — the ☰ app menu (v1.1.0 farm mockup screen 1): a panel from the
 * left over a scrim, holding titled card sections of menu rows. Tokens only.
 *
 * Modal (review S1): it lives in a transparent RN Modal, so focus moves into
 * the panel (web traps it), what is behind is hidden from screen readers,
 * and the Android back button closes it (onRequestClose). Closing is also
 * the scrim (named "ปิดเมนู" for screen readers) or picking an item.
 */

import { Link, type Href } from 'expo-router';
import { Children, Fragment } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { ChevronRight } from './icons';
import { cardStyle } from './card';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  const msg = useT();
  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View
        testID="drawer"
        role="dialog"
        aria-modal
        accessibilityViewIsModal
        accessibilityLabel={msg('menu.open')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
        }}
      >
        <Pressable
          testID="drawer-scrim"
          accessibilityRole="button"
          accessibilityLabel={msg('menu.close')}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.color.scrim,
            opacity: t.opacity.scrim,
          }}
        />
        <View
          testID="drawer-panel"
          style={{
            width: '85%',
            maxWidth: 360,
            height: '100%',
            backgroundColor: t.color.surface,
            borderTopRightRadius: t.radius.xxl,
            borderBottomRightRadius: t.radius.xxl,
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** A small heading over one card of menu rows, rows split by hairlines. */
export function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: t.space.sm }}>
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.caption,
          fontWeight: t.font.weight.semibold,
          color: t.color.inkSoft,
        }}
      >
        {title}
      </Text>
      <View style={{ ...cardStyle(t), paddingHorizontal: t.space.md }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: t.border.hair,
                  backgroundColor: t.color.ruleFaint,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** One menu row: label (+ optional detail line), chevron right. */
export function MenuItem({
  label,
  detail,
  href,
  onPress,
  testID,
}: {
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
  testID?: string;
}) {
  const row = <MenuRow label={label} detail={detail} testID={testID} onItemPress={onPress} />;
  return href ? (
    <Link href={href} asChild>
      {row}
    </Link>
  ) : (
    row
  );
}

function MenuRow({
  label,
  detail,
  testID,
  onItemPress,
  onPress,
  ...rest
}: {
  label: string;
  detail?: string;
  testID?: string;
  onItemPress?: () => void;
  /** Supplied by `<Link asChild>`. */
  onPress?: (e: unknown) => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      {...rest}
      testID={testID}
      accessibilityRole="button"
      onPress={(e) => {
        onItemPress?.();
        onPress?.(e);
      }}
      style={{
        minHeight: t.target.min,
        paddingVertical: t.space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyLg,
            fontWeight: t.font.weight.semibold,
            color: t.color.ink,
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            style={{
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.bodySm,
              color: t.color.inkSoft,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={t.color.inkFaint} />
    </Pressable>
  );
}
