/**
 * ActionButton — the one filled pill for Save, in a screen header (right of
 * the sync pill) or a sheet's title row. Its own file so BottomSheet does not
 * pull in the header's router import. Disabled and saving are their own
 * states (dashed edge, "กำลังบันทึก"), never a faded copy. Tokens only.
 */

import { Pressable, Text, View } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface HeaderPrimaryAction {
  readonly onPress?: () => void;
  readonly testID?: string;
  readonly label: string;
  readonly disabled?: boolean;
  /** A write is in flight: shows "กำลังบันทึก", busy, and ignores taps. */
  readonly saving?: boolean;
  /** Shown while saving instead of "กำลังบันทึก", so the width does not jump (repay keeps its total). */
  readonly savingLabel?: string;
}

/** `wide`: the full-width pinned Save at the screen's foot (owner 2026-11-07, style I); otherwise a sheet's title-row pill. */
export function ActionButton({ action, wide }: { action: HeaderPrimaryAction; wide?: boolean }) {
  const t = useTheme();
  const msg = useT();
  const off = !!action.disabled || !!action.saving;
  return (
    <Pressable
      testID={action.testID}
      onPress={off ? undefined : action.onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: off, busy: !!action.saving }}
      style={{
        flexShrink: 0,
        minHeight: wide ? t.target.comfortable : t.target.min,
        minWidth: t.target.min,
        alignSelf: wide ? 'stretch' : 'auto',
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: t.border.thick,
        borderStyle: off ? 'dashed' : 'solid',
        borderColor: off ? t.color.ruleStrong : t.color.action,
        backgroundColor: off ? t.color.disabledFill : t.color.action,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: wide ? t.font.size.bodyLg : t.font.size.bodyMd,
          fontWeight: t.font.weight.bold,
          color: off ? t.color.disabledInk : t.color.inkInverse,
          textAlign: 'center',
        }}
      >
        {action.saving ? (action.savingLabel ?? msg('common.saving')) : action.label}
      </Text>
    </Pressable>
  );
}

/**
 * SaveBar — a form's Save, pinned full width at the foot of the screen
 * (owner 2026-11-07, style I: no "บันทึก" pill at the header's right).
 */
export function SaveBar({ action }: { action: HeaderPrimaryAction }) {
  const t = useTheme();
  return (
    <View testID="save-bar" style={{ paddingHorizontal: t.layout.screenPaddingX, paddingVertical: t.space.md, backgroundColor: t.color.surface, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint }}>
      <ActionButton action={action} wide />
    </View>
  );
}
