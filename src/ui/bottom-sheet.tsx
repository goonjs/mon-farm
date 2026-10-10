/**
 * BottomSheet — the v1.1.0 mockups' sheet: a raised panel rising from the
 * bottom with large top corners and a grab handle, over the `scrim` at
 * `opacity.scrim` (the story's darker scrim, which keeps the sheet clear in
 * sun). Tapping the scrim closes it; the scrim is named for screen readers.
 *
 * Modal (review S1): a transparent RN Modal moves focus into the panel,
 * hides what is behind from screen readers, and closes on Android back.
 * Gesture drag-to-dismiss is not included (YAGNI until a screen needs it).
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  testID = 'sheet',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View
        testID={testID}
        role="dialog"
        aria-modal
        accessibilityViewIsModal
        accessibilityLabel={title}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          testID={`${testID}-scrim`}
          accessibilityRole="button"
          accessibilityLabel={msg('common.cancel')}
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
          testID={`${testID}-panel`}
          style={{
            maxHeight: '85%',
            backgroundColor: t.color.surfaceRaised,
            borderTopLeftRadius: t.radius.xxl,
            borderTopRightRadius: t.radius.xxl,
            paddingTop: t.space.sm,
            boxShadow: `0px -${t.shadow.floating.y}px ${t.shadow.floating.blur}px ${t.shadow.floating.color}`,
          }}
        >
          <View
            testID={`${testID}-handle`}
            aria-hidden
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.rule,
              marginBottom: t.space.sm,
            }}
          />
          {title ? (
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: t.font.family.sans,
                fontSize: t.font.size.headingMd,
                fontWeight: t.font.weight.bold,
                color: t.color.ink,
                paddingHorizontal: t.layout.screenPaddingX,
                paddingBottom: t.space.sm,
              }}
            >
              {title}
            </Text>
          ) : null}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: t.layout.screenPaddingX,
              paddingBottom: t.space.xl,
              gap: t.space.md,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
